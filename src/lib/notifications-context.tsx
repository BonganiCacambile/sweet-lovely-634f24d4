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
import { subscribeTable } from "@/lib/realtime/realtime-manager";
import { useAuth } from "@/lib/auth-context";
import { playNotificationPing, vibrate } from "@/lib/notification-sound";
import { deliverLocally } from "@/lib/push/push-service";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown> | null;
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
  const { user, profile } = useAuth();
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
    const [{ data: rows }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, body, category, read, created_at, data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
    ]);
    setRecent((rows ?? []) as NotificationRow[]);
    setUnread(count ?? 0);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime subscription for *this* user's notifications.
  // Single filtered channel (user_id=eq.<id>) shared through the realtime
  // manager, which also handles auth refresh, sign-out teardown, hidden-tab
  // suspension and reconnect resync.
  useEffect(() => {
    if (!user) {
      setRtStatus("idle");
      return;
    }
    setRtStatus("connecting");

    const unsub = subscribeTable(
      "notifications",
      {
        onEvent: (payload) => {
          if (payload.eventType !== "INSERT") {
            void refresh();
            return;
          }
          const row = payload.new as unknown as NotificationRow;
          // Update local state immediately.
          setRecent((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, 20)));
          if (!row.read) setUnread((n) => n + 1);
          // Invalidate any queries reading notifications.
          qc.invalidateQueries({ queryKey: ["my-notifications"] });
          qc.invalidateQueries({ queryKey: ["account-overview"] });

          // Alert (sound + vibrate + toast), filtered by user prefs.
          const prefs = prefsRef.current;
          if (!categoryAllowed(row.category, prefs)) return;
          // Background/closed tab → real system notification (web channel).
          void deliverLocally({ id: row.id, title: row.title, body: row.body, data: row.data ?? null });
          if (prefs.sound) playNotificationPing();
          if (prefs.vibration) {
            const important = /deliver|out_for|ready|cancel|refund/i.test(
              `${row.title} ${row.body ?? ""}`,
            );
            vibrate(important ? [40, 60, 40] : 30);
          }
          toast(row.title, {
            description: row.body ?? undefined,
            icon: <Bell className="h-4 w-4" />,
            duration: 6000,
          });
        },
        keepAlive: true,
        onResync: () => {
          setRtStatus("SUBSCRIBED");
          void refresh();
        },
      },
      `user_id=eq.${user.id}`,
    );

    return () => {
      unsub();
      setRtStatus("idle");
    };
  }, [user, qc, refresh]);


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