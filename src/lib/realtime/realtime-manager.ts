import { supabase } from "@/integrations/supabase/client";

/**
 * Shared Supabase Realtime multiplexer.
 *
 * Problem it solves: every component that wanted live data used to open its own
 * `supabase.channel(...)`. A single admin page could hold 3-5 websocket channels
 * and the storefront duplicated `delivery_zones` up to four times, each one
 * re-processing the same event and firing the same query invalidations.
 *
 * Design: subscriptions are grouped by row filter. All unfiltered subscriptions
 * share ONE websocket channel with one `postgres_changes` binding per table
 * (bindings are cheap, channel joins are rate-limited), and each distinct
 * filter (e.g. `user_id=eq.<id>`) gets its own channel. Subscribers are
 * reference-counted, so a table binding disappears when the last consumer
 * unmounts.
 *
 * It also:
 *  - re-subscribes with the current access token on SIGNED_IN / TOKEN_REFRESHED
 *    so RLS is evaluated as the signed-in user,
 *  - tears every channel down on SIGNED_OUT (no stale authed sockets),
 *  - suspends channels while the tab/WebView has been hidden for a grace period
 *    and resumes + resyncs when it becomes visible again,
 *  - resyncs subscribers on (re)connect so nothing is missed while suspended.
 */

export type RealtimeEvent = {
  eventType: string;
  table: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

type Subscriber = {
  onEvent: (e: RealtimeEvent) => void;
  onResync: () => void;
  /**
   * Keep this subscription's channel open while the tab is hidden. Used for
   * alerting consumers (new-order toasts, customer push/sound notifications)
   * that must fire even when the app is in the background.
   */
  keepAlive?: boolean;
};

type Group = {
  filter?: string;
  /** table -> subscribers listening to it */
  tables: Map<string, Set<Subscriber>>;
  channel: ReturnType<typeof supabase.channel> | null;
  /** tables the currently-open channel is bound to */
  boundTables: string[];
  rebuildTimer: ReturnType<typeof setTimeout> | null;
  building: boolean;
};

/** How long the tab may stay hidden before we drop the websocket channels. */
const HIDDEN_GRACE_MS = 60_000;
/** Coalesce mount bursts so we join once instead of once per component. */
const REBUILD_DEBOUNCE_MS = 40;

const groups = new Map<string, Group>();
let suspended = false;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

const groupKey = (filter?: string) => filter ?? "__all__";

function allSubscribers(group: Group): Subscriber[] {
  const out = new Set<Subscriber>();
  for (const set of group.tables.values()) for (const s of set) out.add(s);
  return [...out];
}

function hasKeepAlive(group: Group): boolean {
  for (const set of group.tables.values()) for (const s of set) if (s.keepAlive) return true;
  return false;
}

function closeChannel(group: Group) {
  if (group.channel) {
    void supabase.removeChannel(group.channel);
    group.channel = null;
    group.boundTables = [];
  }
}

function scheduleRebuild(group: Group) {
  if (group.rebuildTimer) clearTimeout(group.rebuildTimer);
  group.rebuildTimer = setTimeout(() => {
    group.rebuildTimer = null;
    void rebuild(group);
  }, REBUILD_DEBOUNCE_MS);
}

async function rebuild(group: Group) {
  if (group.building) {
    scheduleRebuild(group);
    return;
  }
  const wanted = [...group.tables.keys()].sort();
  if (wanted.length === 0 || (suspended && !hasKeepAlive(group))) {
    closeChannel(group);
    return;
  }
  if (group.channel && group.boundTables.join(",") === wanted.join(",")) return;

  group.building = true;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      try {
        supabase.realtime.setAuth(token);
      } catch {
        /* older clients: ignore */
      }
    }
    if (suspended && !hasKeepAlive(group)) {
      closeChannel(group);
      return;
    }
    closeChannel(group);

    const name = `rt:${groupKey(group.filter)}:${Math.random().toString(36).slice(2, 10)}`;
    let channel = supabase.channel(name);
    for (const table of wanted) {
      channel = channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          ...(group.filter ? { filter: group.filter } : {}),
        },
        (payload: RealtimeEvent) => {
          const subs = group.tables.get(table);
          if (!subs) return;
          for (const s of [...subs]) s.onEvent({ ...payload, table });
        },
      );
    }
    channel.subscribe((status) => {
      // Catch rows changed during the (re)connect handshake.
      if (status === "SUBSCRIBED") for (const s of allSubscribers(group)) s.onResync();
    });
    group.channel = channel;
    group.boundTables = wanted;
  } finally {
    group.building = false;
  }
}

function reopenAll() {
  for (const group of groups.values()) {
    closeChannel(group);
    scheduleRebuild(group);
  }
}

function bindGlobalListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      reopenAll();
    } else if (event === "SIGNED_OUT") {
      for (const group of groups.values()) closeChannel(group);
    }
  });

  const resume = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!suspended) return;
    suspended = false;
    for (const group of groups.values()) {
      scheduleRebuild(group);
      // Resync immediately: data may have changed while we were suspended.
      for (const s of allSubscribers(group)) s.onResync();
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      resume();
      return;
    }
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      suspended = true;
      // Groups with a keep-alive subscriber stay connected so background
      // alerts (new orders, notifications) still arrive.
      for (const group of groups.values()) if (!hasKeepAlive(group)) closeChannel(group);
    }, HIDDEN_GRACE_MS);
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onVisibility);
  window.addEventListener("online", resume);
  window.addEventListener("focus", resume);
}

/** Subscribe to a table (optionally row-filtered). Returns an unsubscribe fn. */
export function subscribeTable(
  table: string,
  subscriber: Subscriber,
  filter?: string,
): () => void {
  bindGlobalListeners();
  const key = groupKey(filter);
  let group = groups.get(key);
  if (!group) {
    group = {
      filter,
      tables: new Map(),
      channel: null,
      boundTables: [],
      rebuildTimer: null,
      building: false,
    };
    groups.set(key, group);
  }
  const set = group.tables.get(table) ?? new Set<Subscriber>();
  set.add(subscriber);
  group.tables.set(table, set);
  scheduleRebuild(group);

  return () => {
    const g = groups.get(key);
    if (!g) return;
    const subs = g.tables.get(table);
    if (!subs) return;
    subs.delete(subscriber);
    if (subs.size === 0) g.tables.delete(table);
    if (g.tables.size === 0) {
      if (g.rebuildTimer) clearTimeout(g.rebuildTimer);
      g.rebuildTimer = null;
      closeChannel(g);
      groups.delete(key);
    } else {
      scheduleRebuild(g);
    }
  };
}

/** Number of live websocket channels — used by regression/perf tests. */
export function activeChannelCount(): number {
  let n = 0;
  for (const g of groups.values()) if (g.channel) n++;
  return n;
}

/** Debug snapshot of the multiplexer state. */
export function realtimeDebugSnapshot() {
  return {
    suspended,
    channels: [...groups.entries()].map(([key, g]) => ({
      key,
      tables: [...g.tables.keys()],
      subscribers: allSubscribers(g).length,
      open: Boolean(g.channel),
    })),
  };
}

if (typeof window !== "undefined") {
  // Exposed for the regression suite to count channels in the live page.
  (window as unknown as Record<string, unknown>).__realtimeDebug = realtimeDebugSnapshot;
}
