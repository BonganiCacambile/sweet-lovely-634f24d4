import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { playNotificationPing, vibrate } from "@/lib/notification-sound";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  read: boolean;
  created_at: string;
};

type Ctx = {
  unread: number;
  recent: NotificationRow[];
  rtStatus: "idle" | "connecting" | "SUBSCRIBED" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT";
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
};

const NotificationsContext = createContext<Ctx | null>(null);

/** Reads notification_prefs.{sound,vibration} from the cached profile. */
function readDevicePrefs(profile: unknown): { sound: boolean; vibration: boolean; pushOrders: boolean; pushPromotions: boolean; pushAccount: boolean } {
  const p = (profile as { notification_prefs?: Record<string, unknown> } | null)?.notification_prefs ?? {};
  const sound = p.sound !== false; // default on
  const vibration = p.vibration !== false; // default on
  const push = (p.push ?? {}) as Record<string, unknown>;
  return {
    sound,
    vibration,
    pushOrders: push.orders !== false,
    pushPromotions: push.promotions === true,
    pushAccount: push.account !== false,
  };
}

function categoryAllowed(category: string | null | undefined, prefs: ReturnType<typeof readDevicePrefs>) {
  const c = String(category ?? "").toLowerCase();
  if (c.includes("promo")) return prefs.pushPromotions;
  if (c.includes("account") || c.includes("security")) return prefs.pushAccount;
  // Default bucket: order / delivery / refund / cancellation
  return prefs.pushOrders;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin } = useAuth();
  const qc = useQueryClient();

  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<NotificationRow[]>([]);
  const [rtStatus, setRtStatus] = useState<Ctx["rtStatus"]>("idle");
  const prefsRef = useRef(readDevicePrefs(profile));
  prefsRef.current = readDevicePrefs(profile);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnread(0);
      setRecent([]);
      return;
    }
    // Admins also see broadcast notifications (user_id IS NULL), which the
    // notify_admin_on_new_order trigger emits for every new order.
    const scope = (q: ReturnType<typeof supabase.from>) =>
      isAdmin ? q.or(`user_id.eq.${user.id},user_id.is.null`) : q.eq("user_id", user.id);
    const [{ data: rows }, { count }] = await Promise.all([
      scope(
        supabase
          .from("notifications")
          .select("id, title, body, category, read, created_at"),
      )
        .order("created_at", { ascending: false })
        .limit(20),
      scope(
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true }),
      ).eq("read", false),
    ]);
    setRecent((rows ?? []) as NotificationRow[]);
    setUnread(count ?? 0);
  }, [user, isAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime subscription for *this* user's notifications.
  useEffect(() => {
    if (!user) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const subscribe = async () => {
      setRtStatus("connecting");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        try {
          supabase.realtime.setAuth(token);
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;
      const name = `rt:user-notifications:${user.id}:${Math.random().toString(36).slice(2, 8)}`;
      let ch = supabase.channel(name);

      const handleInsert = (payload: { new: NotificationRow }) => {
        const row = payload.new;
        setRecent((prev) => [row, ...prev].slice(0, 20));
        if (!row.read) setUnread((n) => n + 1);
        qc.invalidateQueries({ queryKey: ["my-notifications"] });
        qc.invalidateQueries({ queryKey: ["account-overview"] });
        const prefs = prefsRef.current;
        if (!categoryAllowed(row.category, prefs)) return;
        if (prefs.sound) playNotificationPing();
        if (prefs.vibration) {
          const important = /deliver|out_for|ready|cancel|refund|order/i.test(
            `${row.title} ${row.body ?? ""}`,
          );
          vibrate(important ? [40, 60, 40] : 30);
        }
        toast(row.title, {
          description: row.body ?? undefined,
          icon: <Bell className="h-4 w-4" />,
          duration: 6000,
        });
      };

      ch = ch
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          handleInsert,
        )
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => {
            void refresh();
          },
        )
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => {
            void refresh();
          },
        );

      if (isAdmin) {
        // Admin broadcast notifications (user_id IS NULL) — new order alerts, etc.
        ch = ch.on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=is.null" },
          handleInsert,
        );
      }

      channel = ch.subscribe((status) => {
          setRtStatus(status as Ctx["rtStatus"]);
          // On (re)connect, resync to catch anything missed while offline.
          if (status === "SUBSCRIBED") void refresh();
        });
    };

    void subscribe();

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (channel) {
          void supabase.removeChannel(channel);
          channel = null;
        }
        void subscribe();
      }
    });

    // Resync on tab focus / network reconnect for offline-queue catch-up.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user, qc, refresh]);
  // isAdmin is captured via refresh dep chain; explicit for lint clarity.

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setUnread(0);
    setRecent((prev) => prev.map((n) => ({ ...n, read: true })));
    qc.invalidateQueries({ queryKey: ["my-notifications"] });
  }, [user, qc]);

  const markOneRead = useCallback(
    async (id: string) => {
      if (!user) return;
      await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
      setRecent((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((n) => Math.max(0, n - 1));
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    },
    [user, qc],
  );

  const value = useMemo<Ctx>(
    () => ({ unread, recent, rtStatus, refresh, markAllRead, markOneRead }),
    [unread, recent, rtStatus, refresh, markAllRead, markOneRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    // Allow components to render outside the provider (e.g. on /auth) by returning a no-op shape.
    return {
      unread: 0,
      recent: [],
      rtStatus: "idle",
      refresh: async () => {},
      markAllRead: async () => {},
      markOneRead: async () => {},
    };
  }
  return ctx;
}