import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres changes on one or more tables and invalidate
 * the given React Query keys whenever any change is received.
 * Use on customer-facing pages so admin edits propagate instantly.
 */
export function useRealtimeInvalidate(
  tables: ReadonlyArray<string>,
  queryKeys: ReadonlyArray<ReadonlyArray<unknown>>,
) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`rt:${tables.join(",")}:${Math.random().toString(36).slice(2, 8)}`);
    for (const table of tables) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          for (const key of queryKeys) {
            qc.invalidateQueries({ queryKey: key as unknown[] });
          }
        },
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
}