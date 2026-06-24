import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to all postgres_changes on `table` and invalidates the given
 * React Query keys (prefix match) on every event. Re-subscribes on auth
 * changes so the realtime socket is authed with the current user's JWT —
 * critical for RLS-gated tables like `orders`, where an anon-authed
 * subscription silently receives zero rows.
 */
export function useRealtimeTable(
  table: string,
  invalidateKeys: ReadonlyArray<ReadonlyArray<unknown>>,
  onEvent?: (e: { eventType: string }) => void,
) {
  const qc = useQueryClient();
  const keysRef = useRef(invalidateKeys);
  const onEventRef = useRef(onEvent);
  keysRef.current = invalidateKeys;
  onEventRef.current = onEvent;

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const invalidateAll = () => {
      for (const key of keysRef.current) {
        qc.invalidateQueries({ queryKey: key as unknown[] });
      }
    };

    const subscribe = async () => {
      // Ensure the realtime socket has the current access token so RLS
      // evaluates as the signed-in user (otherwise admin-only tables yield
      // no broadcasts).
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        try {
          supabase.realtime.setAuth(token);
        } catch {
          // older client versions: setAuth may not be a promise; ignore
        }
      }
      if (cancelled) return;

      const name = `rt:${table}:${Math.random().toString(36).slice(2, 10)}`;
      channel = supabase
        .channel(name)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "*", schema: "public", table },
          (payload: { eventType: string }) => {
            invalidateAll();
            onEventRef.current?.(payload);
          },
        )
        .subscribe((status) => {
          // Catch any rows inserted during the (re)connect handshake.
          if (status === "SUBSCRIBED") invalidateAll();
        });
    };

    void subscribe();

    // Re-subscribe on sign-in / token refresh so a stale anon socket is replaced.
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (channel) {
          void supabase.removeChannel(channel);
          channel = null;
        }
        void subscribe();
      }
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}