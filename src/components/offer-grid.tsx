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
          ? "min-h-[560px] px-6 pb-[280px] pt-6 md:min-h-[690px] md:px-12 md:pb-[340px] md:pt-12"
          : "min-h-[460px] px-6 pb-[220px] pt-6 md:min-h-[491px] md:px-12 md:pb-[240px] md:pt-12"
      }`}
    >
      <h3 className="relative z-10 text-[28px] font-extrabold leading-[1.2] tracking-normal">
        {variant}
      </h3>
      <ul className="relative z-10 mt-6 flex flex-col gap-3 text-[20px] leading-[1.35] tracking-normal">
        {items.map((item) => (
          <li key={item} className="flex gap-4">
            <span className="mt-[0.6em] h-[6px] w-[6px] shrink-0 rounded-full bg-current" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="relative z-10 mt-6 flex w-full flex-wrap items-center justify-between gap-3 pt-3">
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

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] overflow-hidden ${
          big ? "h-[260px] md:h-[340px]" : "h-[200px] md:h-[240px]"
        }`}
        aria-hidden
      >
        <img
          src={images[0]}
          alt=""
          loading="eager"
          className={`absolute bottom-[-30%] select-none object-contain transition-transform duration-700 ease-out group-hover:-rotate-6 group-hover:scale-105 ${
            big
              ? "left-[-8%] h-[380px] w-[380px] md:h-[520px] md:w-[520px]"
              : "left-[-6%] h-[280px] w-[280px] md:h-[340px] md:w-[340px]"
          }`}
        />
        <img
          src={images[1]}
          alt=""
          loading="eager"
          className={`absolute bottom-[-30%] select-none object-contain transition-transform duration-700 ease-out group-hover:rotate-6 group-hover:scale-105 ${
            big
              ? "right-[-8%] h-[380px] w-[380px] md:h-[520px] md:w-[520px]"
              : "right-[-6%] h-[280px] w-[280px] md:h-[340px] md:w-[340px]"
          }`}
        />
      </div>
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