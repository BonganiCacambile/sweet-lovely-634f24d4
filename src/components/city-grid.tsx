import { Reveal } from "@/components/reveal";

export interface City {
  id: string;
  name: string;
  color: string;
  image?: string;
}

interface CityGridProps {
  cities: City[];
}

/** City background images — Unsplash CDN, well-known city landmarks. */
const CITY_IMAGES: Record<string, string> = {
  nyc: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=70",
  london: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?auto=format&fit=crop&w=600&q=70",
  ams: "https://images.unsplash.com/photo-1534351590666-13e3e96c5017?auto=format&fit=crop&w=600&q=70",
  berlin: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=600&q=70",
  bucharest: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=600&q=70",
};

export function CityGrid({ cities }: CityGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-5">
      {cities.map((c, i) => {
        const img = c.image ?? CITY_IMAGES[c.id];
        return (
          <Reveal key={c.id} delay={Math.min(i, 8) * 60}>
            <button
            type="button"
            className="group relative aspect-square w-full overflow-hidden rounded-3xl"
            style={{
              backgroundImage: img ? `url(${img})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0 mix-blend-multiply"
              style={{ backgroundColor: c.color }}
            />
            <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xl font-extrabold text-white drop-shadow md:text-2xl">
              {c.name}
            </span>
            </button>
          </Reveal>
        );
      })}
    </div>
  );
}