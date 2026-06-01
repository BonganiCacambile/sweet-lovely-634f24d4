import OfferCardFramerComponent from "@/framer/menu-products/offer-crad";

type DealVariant =
  | "Spicy Duo Deal"
  | "Cheese Lovers Pair"
  | "Veggie Delight Duo"
  | "Sweet & Savory Combo"
  | "Meat Feast Combo"
  | "Meat Feast Combo - Big";

/**
 * Render the underlying (non-Responsive) component directly so the `variant`
 * prop is honored. The unframer `.Responsive` wrapper auto-picks a variant per
 * breakpoint and ignores `variant`.
 */
function Offer({ name }: { name: DealVariant }) {
  return <OfferCardFramerComponent variant={name} />;
}

/** Matches the design: 2-up row, full-width Meat Feast hero, then 2-up row. */
export function OfferGrid() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full grid-cols-1 justify-items-center gap-6 md:grid-cols-2">
        <Offer name="Spicy Duo Deal" />
        <Offer name="Cheese Lovers Pair" />
      </div>
      <Offer name="Meat Feast Combo - Big" />
      <div className="grid w-full grid-cols-1 justify-items-center gap-6 md:grid-cols-2">
        <Offer name="Veggie Delight Duo" />
        <Offer name="Sweet & Savory Combo" />
      </div>
    </div>
  );
}