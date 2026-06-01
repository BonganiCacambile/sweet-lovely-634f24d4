import OfferCardFramerComponent from "@/framer/menu-products/offer-crad";
import type { Deal } from "@/data/menu";

interface OfferGridProps {
  deals: Deal[];
}

/** Two-column grid of Framer offer cards (the colored deal blocks). */
export function OfferGrid({ deals }: OfferGridProps) {
  return (
    <div className="grid grid-cols-1 justify-items-center gap-6 md:grid-cols-2">
      {deals.map((d) => (
        <OfferCardFramerComponent.Responsive key={d.id} variant={d.variant} />
      ))}
    </div>
  );
}