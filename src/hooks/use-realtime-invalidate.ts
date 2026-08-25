import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeTable } from "@/lib/realtime/realtime-manager";

/**
 * Subscribe to Postgres changes on one or more tables and invalidate
 * the given React Query keys whenever any change is received.
 *
 * Backed by the shared realtime manager: one channel per table across the
 * whole app, cleaned up when the last subscriber unmounts, suspended while
 * the tab is hidden and resynced on resume.
 */
export function useRealtimeInvalidate(
  tables: ReadonlyArray<string>,
  queryKeys: ReadonlyArray<ReadonlyArray<unknown>>,
) {
  const qc = useQueryClient();
  const keysJson = JSON.stringify(queryKeys);
  const tablesKey = tables.join(",");

  useEffect(() => {
    const keys = JSON.parse(keysJson) as unknown[][];
    const invalidateAll = () => {
      for (const key of keys) qc.invalidateQueries({ queryKey: key });
    };
    const unsubs = tablesKey
      .split(",")
      .filter(Boolean)
      .map((table) => subscribeTable(table, { onEvent: invalidateAll, onResync: invalidateAll }));
    return () => {
      for (const u of unsubs) u();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, keysJson]);
}
