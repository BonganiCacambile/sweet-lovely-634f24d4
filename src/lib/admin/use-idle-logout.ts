import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Signs the employee out after a period of inactivity, with a warning one
 * minute before. Purely a UX guard — the server independently rejects
 * revoked or disabled sessions.
 */
export function useIdleLogout(idleMinutes: number | undefined) {
  const navigate = useNavigate();
  const warned = useRef(false);
  const timers = useRef<{ warn?: ReturnType<typeof setTimeout>; out?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const minutes = idleMinutes && idleMinutes > 0 ? idleMinutes : 0;
    if (!minutes) return;
    const idleMs = minutes * 60_000;
    const warnMs = Math.max(idleMs - 60_000, idleMs / 2);

    const signOut = async () => {
      await supabase.auth.signOut();
      toast.error("Signed out", { description: "You were inactive for too long." });
      void navigate({ to: "/auth/admin", replace: true });
    };

    const reset = () => {
      warned.current = false;
      if (timers.current.warn) clearTimeout(timers.current.warn);
      if (timers.current.out) clearTimeout(timers.current.out);
      timers.current.warn = setTimeout(() => {
        warned.current = true;
        toast.warning("You'll be signed out shortly", { description: "Move the mouse to stay signed in." });
      }, warnMs);
      timers.current.out = setTimeout(() => void signOut(), idleMs);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart", "visibilitychange"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timers.current.warn) clearTimeout(timers.current.warn);
      if (timers.current.out) clearTimeout(timers.current.out);
    };
  }, [idleMinutes, navigate]);
}
