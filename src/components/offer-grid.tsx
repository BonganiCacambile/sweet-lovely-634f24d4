import OfferCradFramerComponent from "@/framer/menu-products/offer-crad";

type DealVariant =
  | "Spicy Duo Deal"
  | "Cheese Lovers Pair"
  | "Meat Feast Combo"
  | "Veggie Delight Duo"
  | "Sweet & Savory Combo";

function DealCard({ variant, big = false }: { variant: DealVariant; big?: boolean }) {
  const mobileVariant = big ? "Meat Feast Combo - Mobile" : `${variant} - Mobile`;
  const tabletVariant = big ? "Meat Feast Combo - Mobile - Tablet" : mobileVariant;
  const desktopVariant = big ? "Meat Feast Combo - Big" : variant;

  return (
    <>
      <div className="block md:hidden">
        <OfferCradFramerComponent variant={mobileVariant} />
      </div>
      <div className="hidden md:block xl:hidden">
        <OfferCradFramerComponent variant={tabletVariant} />
      </div>
      <div className="hidden xl:block">
        <OfferCradFramerComponent variant={desktopVariant} />
      </div>
    </>
  );
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