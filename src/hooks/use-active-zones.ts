import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { listActiveZones, type PublicZone } from "@/lib/zones.functions";
import type { City } from "@/components/city-grid";

const ZONES_KEY = ["zones", "active"] as const;

/** Live list of active delivery zones, mapped to CityGrid shape. */
export function useActiveZoneCities(): { cities: City[]; isLoading: boolean } {
  const fetchZones = useServerFn(listActiveZones);
  const { data, isLoading } = useQuery({
    queryKey: ZONES_KEY,
    queryFn: () => fetchZones(),
  });
  useRealtimeTable("delivery_zones", [ZONES_KEY]);
  const cities: City[] = (data ?? []).map((z: PublicZone) => ({
    id: z.id,
    name: z.name,
    color: z.color,
    image: z.image_url,
  }));
  return { cities, isLoading };
}

/** Live list of active zones with public contact details for the Contact page. */
export function useActiveZones(): { zones: PublicZone[]; isLoading: boolean } {
  const fetchZones = useServerFn(listActiveZones);
  const { data, isLoading } = useQuery({
    queryKey: ZONES_KEY,
    queryFn: () => fetchZones(),
  });
  useRealtimeTable("delivery_zones", [ZONES_KEY]);
  return { zones: data ?? [], isLoading };
}