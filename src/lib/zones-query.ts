import { queryOptions } from "@tanstack/react-query";
import { listActiveZones, type PublicZone } from "@/lib/zones.functions";

/**
 * Single canonical query for the active delivery zones.
 *
 * Every consumer (zone context, zone cities grid, contact page, delivery FAQ)
 * must use this so the list is fetched once per cache window instead of once
 * per component.
 */
export const ZONES_KEY = ["zones", "active"] as const;

export const zonesQueryOptions = queryOptions<PublicZone[]>({
  queryKey: ZONES_KEY,
  queryFn: () => listActiveZones(),
  staleTime: 5 * 60_000,
});
