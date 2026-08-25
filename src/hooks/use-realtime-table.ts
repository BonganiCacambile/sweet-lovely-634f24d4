import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeTable, type RealtimeEvent } from "@/lib/realtime/realtime-manager";

/**
 * Subscribes to all postgres_changes on `table` and invalidates the given
 * React Query keys (prefix match) on every event.
 *
 * Channels are multiplexed by the shared realtime manager, so multiple
 * components asking for the same table share ONE websocket channel. Auth
 * changes, tab-visibility suspension and reconnect resyncs are handled there.
 */
export function useRealtimeTable(
  table: string,
  invalidateKeys: ReadonlyArray<ReadonlyArray<unknown>>,
  onEvent?: (e: { eventType: string }) => void,
  filter?: string,
) {
  const qc = useQueryClient();
  const keysRef = useRef(invalidateKeys);
  const onEventRef = useRef(onEvent);
  keysRef.current = invalidateKeys;
  onEventRef.current = onEvent;

  useEffect(() => {
    const invalidateAll = () => {
      for (const key of keysRef.current) {
        qc.invalidateQueries({ queryKey: key as unknown[] });
      }
    };

    return subscribeTable(
      table,
      {
        onEvent: (payload: RealtimeEvent) => {
          invalidateAll();
          onEventRef.current?.(payload);
        },
        onResync: invalidateAll,
      },
      filter,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}
