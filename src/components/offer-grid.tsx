import OfferCradFramerComponent from "@/framer/menu-products/offer-crad";

type DealVariant =
  | "Spicy Duo Deal"
  | "Cheese Lovers Pair"
  | "Meat Feast Combo"
  | "Veggie Delight Duo"
  | "Sweet & Savory Combo";

function DealCard({ variant, big = false }: { variant: DealVariant; big?: boolean }) {
  const variants = big
    ? {
        base: "Meat Feast Combo - Mobile",
        tablet: "Meat Feast Combo - Mobile - Tablet",
        xl: "Meat Feast Combo - Big",
      }
    : {
        base: `${variant} - Mobile`,
        xl: variant,
      };

  return <OfferCradFramerComponent.Responsive variants={variants as never} />;
}

export function OfferGrid() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6">
      <div className="grid w-full grid-cols-1 justify-items-center gap-6 lg:grid-cols-2">
        <DealCard variant="Spicy Duo Deal" />
        <DealCard variant="Cheese Lovers Pair" />
      </div>
      <DealCard variant="Meat Feast Combo" big />
      <div className="grid w-full grid-cols-1 justify-items-center gap-6 lg:grid-cols-2">
        <DealCard variant="Veggie Delight Duo" />
        <DealCard variant="Sweet & Savory Combo" />
      </div>
    </div>
  );
}