/**
 * Hand-built deal cards (the Framer offer-card variant system doesn't
 * propagate the variant prop through unframer's Responsive wrapper, so we
 * recreate the visual design here with Tailwind to match the screenshots
 * exactly).
 */

interface DealCardProps {
  title: string;
  items: string[];
  price: string;
  save: string;
  bg: string;
  textColor?: string;
  buttonText?: string;
  big?: boolean;
}

function DealCard({
  title,
  items,
  price,
  save,
  bg,
  textColor = "text-white",
  big = false,
}: DealCardProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl ${bg} ${textColor} ${
        big ? "min-h-[420px] md:min-h-[460px]" : "min-h-[420px]"
      } flex flex-col p-8 md:p-10`}
    >
      <h3 className="text-2xl font-extrabold md:text-3xl">{title}</h3>
      <ul className="mt-4 space-y-2 text-base md:text-lg">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          className="rounded-full bg-white px-6 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
        >
          Order Now
        </button>
        <p className="text-lg font-bold md:text-xl">
          {price} <span className="font-normal opacity-80">- Save {save}</span>
        </p>
      </div>
    </div>
  );
}

export function OfferGrid() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DealCard
          title="Spicy Duo Deal"
          items={["1 Medium Firecracker Inferno", "1 Medium Buffalo Bliss"]}
          price="$21.99"
          save="$4"
          bg="bg-[#ff003c]"
        />
        <DealCard
          title="Cheese Lovers Pair"
          items={["1 Medium Cheese Avalanche", "1 Medium Truffle Temptation"]}
          price="$22.99"
          save="$5"
          bg="bg-[#ffc91a]"
          textColor="text-neutral-900"
        />
      </div>
      <DealCard
        title="Meat Feast Combo"
        items={["1 Medium Meat Lover's Feast", "1 Medium BBQ Blaze"]}
        price="$23.99"
        save="$6"
        bg="bg-neutral-900"
        big
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DealCard
          title="Veggie Delight Duo"
          items={["1 Medium Mediterranean Marvel", "1 Medium Garlic Supreme"]}
          price="$21.99"
          save="$4"
          bg="bg-[#1aaa1a]"
        />
        <DealCard
          title="Sweet & Savory Combo"
          items={["1 Medium Hawaiian Heatwave", "1 Medium Pepperoni Popper"]}
          price="$22.99"
          save="$5"
          bg="bg-[#ff8a1a]"
        />
      </div>
    </div>
  );
}