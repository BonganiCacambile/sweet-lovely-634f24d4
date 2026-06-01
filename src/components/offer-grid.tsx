import OfferCardFramerComponent from "@/framer/menu-products/offer-crad";

type DealVariant =
  | "Spicy Duo Deal"
  | "Cheese Lovers Pair"
  | "Veggie Delight Duo"
  | "Sweet & Savory Combo"
  | "Meat Feast Combo";

function Offer({ name }: { name: DealVariant }) {
  return (
    <OfferCardFramerComponent.Responsive
      variants={{ base: name, mobile: `${name} - Mobile` as never }}
    />
  );
}

/**
 * Matches the design: 2-up row, full-width Meat Feast hero, then 2-up row.
 */
export function OfferGrid() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 justify-items-center gap-6 md:grid-cols-2">
        <Offer name="Spicy Duo Deal" />
        <Offer name="Cheese Lovers Pair" />
      </div>
      <div className="flex justify-center">
        <OfferCardFramerComponent.Responsive
          variants={{
            base: "Meat Feast Combo - Big",
            tablet: "Meat Feast Combo - Mobile - Tablet" as never,
            mobile: "Meat Feast Combo - Mobile" as never,
          }}
        />
      </div>
      <div className="grid grid-cols-1 justify-items-center gap-6 md:grid-cols-2">
        <Offer name="Veggie Delight Duo" />
        <Offer name="Sweet & Savory Combo" />
      </div>
    </div>
  );
}