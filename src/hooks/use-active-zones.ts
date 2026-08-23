import { useQuery } from "@tanstack/react-query";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { ZONES_KEY, zonesQueryOptions } from "@/lib/zones-query";
import type { PublicZone } from "@/lib/zones.functions";
import type { City } from "@/components/city-grid";

/** Live list of active delivery zones, mapped to CityGrid shape. */
export function useActiveZoneCities(): { cities: City[]; isLoading: boolean } {
  const { data, isLoading } = useQuery(zonesQueryOptions);
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
  const { data, isLoading } = useQuery(zonesQueryOptions);
  useRealtimeTable("delivery_zones", [ZONES_KEY]);
  return { zones: data ?? [], isLoading };
}
