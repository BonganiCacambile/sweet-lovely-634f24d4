import { Reveal } from "@/components/reveal";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";

type DealVariant =
  | "Spicy Duo Deal"
  | "Cheese Lovers Pair"
  | "Meat Feast Combo"
  | "Veggie Delight Duo"
  | "Sweet & Savory Combo";

interface DealCardProps {
  variant: DealVariant;
  items: string[];
  price: string;
  save: string;
  bg: string;
  images: [string, string];
  darkText?: boolean;
  big?: boolean;
}

function DealCard({ variant, items, price, save, bg, images, darkText = false, big = false }: DealCardProps) {
  const textColor = darkText ? "text-neutral-900" : "text-white";

  return (
    <article
      className={`hover-zoom group relative w-full overflow-hidden rounded-[24px] transition-transform duration-300 hover:-translate-y-1.5 ${bg} ${textColor} ${
        big
          ? "min-h-[420px] p-6 md:min-h-[460px] md:p-10"
          : "min-h-[360px] p-6 md:min-h-[400px] md:p-10"
      } flex flex-col`}
    >
      <h3 className="relative z-10 max-w-[60%] text-[28px] font-extrabold leading-[1.2] tracking-normal md:text-[32px]">
        {variant}
      </h3>
      <p className="relative z-10 mt-3 max-w-[55%] text-[16px] leading-[1.4] tracking-normal md:text-[18px]">
        {items.join(" + ")}
      </p>
      <div className="relative z-10 mt-auto flex w-full flex-wrap items-center justify-between gap-3 pt-8">
        <AddToCartButton
          item={{
            id: `deal-${variant.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            title: variant,
            price,
            image: images[0],
            variation: items.join(" + "),
          }}
          className="h-9 px-6 text-[15px]"
        />
        <p className="flex items-end gap-2 whitespace-nowrap text-[20px] font-extrabold leading-none tracking-normal md:text-[22px]">
          {price}
          <span className="text-[18px] font-light leading-none md:text-[22px]">- Save {save}</span>
        </p>
      </div>

      <img
        src={images[0]}
        alt=""
        loading="eager"
        aria-hidden
        className={`pointer-events-none absolute z-[1] select-none rounded-full object-cover shadow-2xl transition-transform duration-700 ease-out group-hover:rotate-6 group-hover:scale-105 ${
          big
            ? "right-[-70px] top-[-70px] h-[320px] w-[320px] md:right-[-90px] md:top-[-90px] md:h-[420px] md:w-[420px]"
            : "right-[-60px] top-[-60px] h-[260px] w-[260px] md:right-[-80px] md:top-[-80px] md:h-[340px] md:w-[340px]"
        }`}
      />
    </article>
  );
}

const fr = (h: string) => `https://framerusercontent.com/images/${h}?width=1200&height=1200`;

export function OfferGrid() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6">
      <div className="grid w-full grid-cols-1 justify-items-center gap-6 lg:grid-cols-2">
        <Reveal className="w-full"><DealCard variant="Spicy Duo Deal" items={["1 Medium Firecracker Inferno", "1 Medium Buffalo Bliss"]} price="R220" save="R40" bg="bg-[#ff003c]" images={[fr("lp6wNgrYu7ClOrMG4ibaVQNDWLo.png"), fr("fOcW4cqVIKe7O6jovEeqZ46Cg.png")]} /></Reveal>
        <Reveal className="w-full" delay={120}><DealCard variant="Cheese Lovers Pair" items={["1 Medium Cheese Avalanche", "1 Medium Truffle Temptation"]} price="R230" save="R50" bg="bg-[#ffcc00]" darkText images={[fr("Q4djsExkm2dVJLND8pnRkbmHKy8.png"), fr("EvzWDEqJkdunx7f5YzmUVnArM4.png")]} /></Reveal>
      </div>
      <Reveal className="w-full"><DealCard variant="Meat Feast Combo" items={["1 Medium Meat Lover's Feast", "1 Medium BBQ Blaze"]} price="R240" save="R60" bg="bg-[#333333]" images={[fr("ilD3FzfskejkXM7jRyVgKSBEE5I.png"), fr("dQKnVrygQTPBTqZDioB8akNs.png")]} big /></Reveal>
      <div className="grid w-full grid-cols-1 justify-items-center gap-6 lg:grid-cols-2">
        <Reveal className="w-full"><DealCard variant="Veggie Delight Duo" items={["1 Medium Mediterranean Marvel", "1 Medium Garlic Supreme"]} price="R220" save="R40" bg="bg-[#0a9900]" images={[fr("vtNegrYfppnZJV5SpQd607Hls8.png"), fr("Q2rEr3IGpX893CKsEuhm5IGMKk.png")]} /></Reveal>
        <Reveal className="w-full" delay={120}><DealCard variant="Sweet & Savory Combo" items={["1 Medium Hawaiian Heatwave", "1 Medium Pepperoni Popper"]} price="R230" save="R50" bg="bg-[#ff9100]" images={[fr("z0tpcmuGY42myUTNyLF9LCXg.png"), fr("bo5PFGtg1mLU0lWO3J9CWKVAcM.png")]} /></Reveal>
      </div>
    </div>
  );
}