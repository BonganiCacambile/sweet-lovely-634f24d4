import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { pingPresence, endPresence } from "@/lib/admin/presence.functions";

const HEARTBEAT_MS = 20_000;
const IDLE_MS = 5 * 60_000;
const AWAY_MS = 15 * 60_000;

type Status = "online" | "active" | "idle" | "away" | "offline";

/**
 * Mount once inside the admin shell. Tracks the signed-in admin's activity
 * (mouse/keyboard/touch + tab visibility) and posts heartbeats to the
 * server every 20s. Transitions between active → idle (5m) → away (15m or
 * tab hidden) and reports offline on sign-out / page close.
 */
export function useAdminPresence() {
  const { user, isAdmin } = useAuth();
  const ping = useServerFn(pingPresence);
  const end = useServerFn(endPresence);
  const lastActivityRef = useRef<number>(Date.now());
  const currentStatusRef = useRef<Status>("offline");
  const sentLoginRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user || !isAdmin) {
      currentStatusRef.current = "offline";
      sentLoginRef.current = false;
      return;
    }

    let cancelled = false;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined;

    const send = (next: Status, isLogin = false) => {
      if (cancelled) return;
      currentStatusRef.current = next;
      void ping({ data: { status: next, userAgent: ua, isLogin } }).catch(() => {});
    };

    const compute = (): Status => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return "away";
      }
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= AWAY_MS) return "away";
      if (idleFor >= IDLE_MS) return "idle";
      return "active";
    };

    const tick = () => {
      const next = compute();
      // Re-send periodically even if status unchanged, so the server can
      // detect stale heartbeats and mark a user offline if the tab dies.
      send(next);
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      if (currentStatusRef.current !== "active") {
        send("active");
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastActivityRef.current = Date.now();
        send("active");
      } else {
        send("away");
      }
    };

    const onUnload = () => {
      // Best-effort offline marker via sendBeacon — server fn would race the
      // tab teardown otherwise.
      try {
        navigator.sendBeacon?.(
          "/_serverFn/src_lib_admin_presence_functions_ts--endPresence_createServerFn_handler",
          new Blob(["{}"], { type: "application/json" }),
        );
      } catch {
        // ignore
      }
      void end({});
    };

    // Initial login ping.
    if (!sentLoginRef.current) {
      sentLoginRef.current = true;
      send("active", true);
    } else {
      send("active");
    }

    const interval = window.setInterval(tick, HEARTBEAT_MS);
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      void end({}).catch(() => {});
    };
  }, [user, isAdmin, ping, end]);
}