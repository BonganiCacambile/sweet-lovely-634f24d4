import CityCardFramerComponent from "@/framer/locations-and-delivery/city-card";

export interface City {
  id: string;
  name: string;
  color: string;
}

interface CityGridProps {
  cities: City[];
}

export function CityGrid({ cities }: CityGridProps) {
  return (
    <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((c) => (
        <CityCardFramerComponent.Responsive
          key={c.id}
          vyZs0CzOx={c.name}
          GxcvqcosD={c.color}
        />
      ))}
    </div>
  );
}