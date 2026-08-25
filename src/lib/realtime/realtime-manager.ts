import { supabase } from "@/integrations/supabase/client";

/**
 * Shared Supabase Realtime multiplexer.
 *
 * Problem it solves: every component that wanted live data used to open its own
 * `supabase.channel(...)`. A single admin page could hold 3-5 websocket channels
 * and the storefront duplicated `delivery_zones` up to four times, each one
 * re-processing the same event and firing the same query invalidations.
 *
 * This module keeps ONE channel per (table, filter) pair, reference-counted
 * across all subscribers. It also:
 *  - re-subscribes with the current access token on SIGNED_IN / TOKEN_REFRESHED
 *    so RLS is evaluated as the signed-in user,
 *  - tears every channel down on SIGNED_OUT (no stale authed sockets),
 *  - suspends channels while the tab/WebView has been hidden for a grace period
 *    and resumes + resyncs when it becomes visible again,
 *  - resyncs subscribers on reconnect so nothing is missed while suspended.
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
};

type Entry = {
  table: string;
  filter?: string;
  subscribers: Set<Subscriber>;
  channel: ReturnType<typeof supabase.channel> | null;
  connecting: boolean;
};

/** How long the tab may stay hidden before we drop the websocket channels. */
const HIDDEN_GRACE_MS = 60_000;

const entries = new Map<string, Entry>();
let suspended = false;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

function keyOf(table: string, filter?: string) {
  return filter ? `${table}|${filter}` : table;
}

async function openChannel(entry: Entry) {
  if (entry.channel || entry.connecting || suspended || entry.subscribers.size === 0) return;
  entry.connecting = true;
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
    if (suspended || entry.subscribers.size === 0) return;

    const name = `rt:${keyOf(entry.table, entry.filter)}:${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase.channel(name).on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table: entry.table,
        ...(entry.filter ? { filter: entry.filter } : {}),
      },
      (payload: RealtimeEvent) => {
        for (const s of [...entry.subscribers]) s.onEvent({ ...payload, table: entry.table });
      },
    );
    channel.subscribe((status) => {
      // Catch rows changed during the (re)connect handshake.
      if (status === "SUBSCRIBED") for (const s of [...entry.subscribers]) s.onResync();
    });
    entry.channel = channel;
  } finally {
    entry.connecting = false;
  }
}

function closeChannel(entry: Entry) {
  if (entry.channel) {
    void supabase.removeChannel(entry.channel);
    entry.channel = null;
  }
}

function reopenAll() {
  for (const entry of entries.values()) {
    closeChannel(entry);
    void openChannel(entry);
  }
}

function bindGlobalListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      reopenAll();
    } else if (event === "SIGNED_OUT") {
      for (const entry of entries.values()) closeChannel(entry);
    }
  });

  const resume = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!suspended) return;
    suspended = false;
    for (const entry of entries.values()) {
      void openChannel(entry);
      // Resync immediately: data may have changed while we were offline.
      for (const s of [...entry.subscribers]) s.onResync();
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
      for (const entry of entries.values()) closeChannel(entry);
    }, HIDDEN_GRACE_MS);
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onVisibility);
  window.addEventListener("online", resume);
  window.addEventListener("focus", resume);
}

/** Subscribe to a table (optionally filtered). Returns an unsubscribe function. */
export function subscribeTable(
  table: string,
  subscriber: Subscriber,
  filter?: string,
): () => void {
  bindGlobalListeners();
  const key = keyOf(table, filter);
  let entry = entries.get(key);
  if (!entry) {
    entry = { table, filter, subscribers: new Set(), channel: null, connecting: false };
    entries.set(key, entry);
  }
  entry.subscribers.add(subscriber);
  void openChannel(entry);

  return () => {
    const e = entries.get(key);
    if (!e) return;
    e.subscribers.delete(subscriber);
    if (e.subscribers.size === 0) {
      closeChannel(e);
      entries.delete(key);
    }
  };
}

/** Number of live websocket channels — used by regression/perf tests. */
export function activeChannelCount(): number {
  let n = 0;
  for (const e of entries.values()) if (e.channel) n++;
  return n;
}

/** Debug snapshot of the multiplexer state. */
export function realtimeDebugSnapshot() {
  return {
    suspended,
    channels: [...entries.entries()].map(([key, e]) => ({
      key,
      subscribers: e.subscribers.size,
      open: Boolean(e.channel),
    })),
  };
}

if (typeof window !== "undefined") {
  // Exposed for the regression suite to count channels in the live page.
  (window as unknown as Record<string, unknown>).__realtimeDebug = realtimeDebugSnapshot;
}
