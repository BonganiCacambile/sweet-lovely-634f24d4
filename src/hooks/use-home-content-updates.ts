import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getHomeContentFingerprint } from "@/lib/home-content.functions";

const HOME_TABLES = [
  "home_popular_items",
  "home_hot_deals",
  "home_specials",
  "home_banners",
  "home_desserts",
  "featured_items",
  "home_section_visibility",
  "products",
  "categories",
] as const;

/** How often we re-check the cheap fingerprint while the tab is visible. */
const CHECK_INTERVAL_MS = 60_000;

/**
 * Detects home-content changes for storefront (including anonymous) visitors
 * without weakening RLS.
 *
 * Two complementary signals:
 *  1. Realtime `postgres_changes` on the home tables — catches inserts and
 *     updates to rows the visitor is allowed to see.
 *  2. A lightweight id-only fingerprint — catches changes Realtime cannot
 *     deliver, most importantly `is_active: true → false`, where the row
 *     leaves the anon RLS SELECT scope and Postgres correctly withholds the
 *     UPDATE. Checked on realtime events, on tab focus / reconnect, and at a
 *     slow interval while the tab is visible only.
 *
 * Nothing is swapped underneath the user: we surface `updateAvailable` and let
 * them press Refresh, which refetches the home query (active rows only).
 */
export function useHomeContentUpdates() {
  const qc = useQueryClient();
  const fetchFingerprint = useServerFn(getHomeContentFingerprint);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const { fingerprint } = await fetchFingerprint();
      if (baselineRef.current == null) {
        baselineRef.current = fingerprint;
        return;
      }
      if (fingerprint !== baselineRef.current) setUpdateAvailable(true);
    } catch {
      // Network hiccup — keep the current baseline and try again later.
    } finally {
      checkingRef.current = false;
    }
  }, [fetchFingerprint]);

  const refresh = useCallback(async () => {
    baselineRef.current = null;
    setUpdateAvailable(false);
    await qc.invalidateQueries({ queryKey: ["home-content"] });
    await check();
  }, [qc, check]);

  const dismiss = useCallback(() => setUpdateAvailable(false), []);

  useEffect(() => {
    let cancelled = false;
    void check();

    const channel = supabase.channel(`rt:home-content:${Math.random().toString(36).slice(2, 10)}`);
    for (const table of HOME_TABLES) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          if (cancelled) return;
          // A row the visitor is allowed to see actually changed (new item,
          // edited title/price, …). The id-only fingerprint cannot see those
          // edits, so surface the pill directly. Nothing is swapped until the
          // visitor presses Refresh.
          setUpdateAvailable(true);
          void check();
        },
      );
    }
    channel.subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [check]);

  return { updateAvailable, refresh, dismiss };
}