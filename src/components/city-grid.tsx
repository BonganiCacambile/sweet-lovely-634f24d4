import { Reveal } from "@/components/reveal";
import { MapPin } from "lucide-react";

export interface City {
  id: string;
  name: string;
  color?: string | null;
  image?: string | null;
}

interface CityGridProps {
  cities: City[];
}

const DEFAULT_ZONE_COLOR = "#ff003c";

export function CityGrid({ cities }: CityGridProps) {
  if (cities.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-neutral-400 shadow-sm">
          <MapPin className="h-6 w-6" aria-hidden />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-neutral-900">
          No delivery zones have been configured yet.
        </h3>
        <p className="mt-2 text-sm text-neutral-600">
          Once an administrator adds and activates delivery zones from the Admin Dashboard,
          they will appear here automatically.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-5">
      {cities.map((c, i) => {
        const img = c.image ?? null;
        const color = c.color ?? DEFAULT_ZONE_COLOR;
        return (
          <Reveal key={c.id} delay={Math.min(i, 8) * 60}>
            <button
            type="button"
            className="group relative aspect-square w-full overflow-hidden rounded-3xl transition-transform duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:shadow-xl"
            style={{
              backgroundImage: img ? `url(${img})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: img ? undefined : color,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0 mix-blend-multiply transition-opacity duration-300 group-hover:opacity-80"
              style={{ backgroundColor: color }}
            />
            <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xl font-extrabold text-white drop-shadow transition-transform duration-300 group-hover:scale-110 md:text-2xl">
              {c.name}
            </span>
            </button>
          </Reveal>
        );
      })}
    </div>
  );
}