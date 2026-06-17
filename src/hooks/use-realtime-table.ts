import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeTable(
  table: string,
  invalidateKeys: ReadonlyArray<ReadonlyArray<unknown>>,
  onEvent?: (e: { eventType: string }) => void,
) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}:${Math.random().toString(36).slice(2)}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        (payload: { eventType: string }) => {
          for (const key of invalidateKeys) {
            qc.invalidateQueries({ queryKey: key as unknown[] });
          }
          onEvent?.(payload);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}