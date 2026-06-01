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
  images: [string, string];
}

function DealCard({
  title,
  items,
  price,
  save,
  bg,
  textColor = "text-white",
  big = false,
  images,
}: DealCardProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl ${bg} ${textColor} ${
        big ? "min-h-[420px] md:min-h-[460px]" : "min-h-[420px]"
      } flex flex-col p-8 md:p-10`}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src={images[0]}
          alt=""
          className={`absolute select-none object-contain drop-shadow-2xl ${
            big
              ? "right-[6%] top-1/2 h-[78%] w-[40%] -translate-y-1/2"
              : "-right-[12%] -top-[18%] h-[75%] w-[75%] rotate-[12deg]"
          }`}
        />
        <img
          src={images[1]}
          alt=""
          className={`absolute select-none object-contain drop-shadow-2xl ${
            big
              ? "right-[34%] top-1/2 h-[78%] w-[40%] -translate-y-1/2"
              : "-right-[6%] bottom-[-22%] h-[75%] w-[75%] -rotate-[8deg]"
          }`}
        />
      </div>
      <div className="relative z-10 flex h-full flex-col">
      <h3 className="text-2xl font-extrabold md:text-3xl">{title}</h3>
      <ul className="mt-4 space-y-2 text-base md:text-lg">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-6">
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
    </div>
  );
}

const fr = (h: string) =>
  `https://framerusercontent.com/images/${h}?scale-down-to=512`;

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
          images={[fr("lp6wNgrYu7ClOrMG4ibaVQNDWLo.png"), fr("fOcW4cqVIKe7O6jovEeqZ46Cg.png")]}
        />
        <DealCard
          title="Cheese Lovers Pair"
          items={["1 Medium Cheese Avalanche", "1 Medium Truffle Temptation"]}
          price="$22.99"
          save="$5"
          bg="bg-[#ffc91a]"
          textColor="text-neutral-900"
          images={[fr("Q4djsExkm2dVJLND8pnRkbmHKy8.png"), fr("EvzWDEqJkdunx7f5YzmUVnArM4.png")]}
        />
      </div>
      <DealCard
        title="Meat Feast Combo"
        items={["1 Medium Meat Lover's Feast", "1 Medium BBQ Blaze"]}
        price="$23.99"
        save="$6"
        bg="bg-neutral-900"
        big
        images={[fr("ilD3FzfskejkXM7jRyVgKSBEE5I.png"), fr("dQKnVrygQTPBTqZDioB8akNs.png")]}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DealCard
          title="Veggie Delight Duo"
          items={["1 Medium Mediterranean Marvel", "1 Medium Garlic Supreme"]}
          price="$21.99"
          save="$4"
          bg="bg-[#1aaa1a]"
          images={[fr("vtNegrYfppnZJV5SpQd607Hls8.png"), fr("Q2rEr3IGpX893CKsEuhm5IGMKk.png")]}
        />
        <DealCard
          title="Sweet & Savory Combo"
          items={["1 Medium Hawaiian Heatwave", "1 Medium Pepperoni Popper"]}
          price="$22.99"
          save="$5"
          bg="bg-[#ff8a1a]"
          images={[fr("z0tpcmuGY42myUTNyLF9LCXg.png"), fr("bo5PFGtg1mLU0lWO3J9CWKVAcM.png")]}
        />
      </div>
    </div>
  );
}