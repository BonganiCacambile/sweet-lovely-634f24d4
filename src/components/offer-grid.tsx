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
      className={`relative w-full overflow-hidden rounded-[24px] ${bg} ${textColor} ${
        big
          ? "min-h-[520px] px-6 pb-[220px] pt-6 md:min-h-[690px] md:px-12 md:pb-[440px] md:pt-12"
          : "min-h-[420px] px-6 pb-[180px] pt-6 md:min-h-[491px] md:px-12 md:pb-[240px] md:pt-12"
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
        <button className="h-9 rounded-full bg-white px-6 text-[16px] font-medium leading-none text-neutral-900" type="button">
          Order Now
        </button>
        <p className="flex items-end gap-2 whitespace-nowrap text-[20px] font-extrabold leading-none tracking-normal md:text-[22px]">
          {price}
          <span className="text-[18px] font-light leading-none md:text-[22px]">- Save {save}</span>
        </p>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex items-start justify-center overflow-visible ${
          big ? "h-[260px] md:h-[456px]" : "h-[200px] md:h-[216px]"
        }`}
        aria-hidden
      >
        <img
          src={images[0]}
          alt=""
          loading="eager"
          className={`absolute top-0 select-none object-contain ${
            big
              ? "left-[-60px] h-[380px] w-[380px] sm:left-[-100px] sm:h-[520px] sm:w-[520px] md:left-[-120px] md:h-[720px] md:w-[720px]"
              : "left-[-50px] h-[280px] w-[280px] sm:left-[-60px] sm:h-[340px] sm:w-[340px] md:left-[-48px] md:h-[400px] md:w-[400px]"
          }`}
        />
        <img
          src={images[1]}
          alt=""
          loading="eager"
          className={`absolute top-0 select-none object-contain ${
            big
              ? "right-[-60px] h-[380px] w-[380px] sm:right-[-100px] sm:h-[520px] sm:w-[520px] md:right-[-120px] md:h-[720px] md:w-[720px]"
              : "right-[-50px] h-[280px] w-[280px] sm:right-[-60px] sm:h-[340px] sm:w-[340px] md:right-[-48px] md:h-[400px] md:w-[400px]"
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
        <DealCard variant="Spicy Duo Deal" items={["1 Medium Firecracker Inferno", "1 Medium Buffalo Bliss"]} price="$21.99" save="$4" bg="bg-[#ff003c]" images={[fr("lp6wNgrYu7ClOrMG4ibaVQNDWLo.png"), fr("fOcW4cqVIKe7O6jovEeqZ46Cg.png")]} />
        <DealCard variant="Cheese Lovers Pair" items={["1 Medium Cheese Avalanche", "1 Medium Truffle Temptation"]} price="$22.99" save="$5" bg="bg-[#ffcc00]" darkText images={[fr("Q4djsExkm2dVJLND8pnRkbmHKy8.png"), fr("EvzWDEqJkdunx7f5YzmUVnArM4.png")]} />
      </div>
      <DealCard variant="Meat Feast Combo" items={["1 Medium Meat Lover's Feast", "1 Medium BBQ Blaze"]} price="$23.99" save="$6" bg="bg-[#333333]" images={[fr("ilD3FzfskejkXM7jRyVgKSBEE5I.png"), fr("dQKnVrygQTPBTqZDioB8akNs.png")]} big />
      <div className="grid w-full grid-cols-1 justify-items-center gap-6 lg:grid-cols-2">
        <DealCard variant="Veggie Delight Duo" items={["1 Medium Mediterranean Marvel", "1 Medium Garlic Supreme"]} price="$21.99" save="$4" bg="bg-[#0a9900]" images={[fr("vtNegrYfppnZJV5SpQd607Hls8.png"), fr("Q2rEr3IGpX893CKsEuhm5IGMKk.png")]} />
        <DealCard variant="Sweet & Savory Combo" items={["1 Medium Hawaiian Heatwave", "1 Medium Pepperoni Popper"]} price="$22.99" save="$5" bg="bg-[#ff9100]" images={[fr("z0tpcmuGY42myUTNyLF9LCXg.png"), fr("bo5PFGtg1mLU0lWO3J9CWKVAcM.png")]} />
      </div>
    </div>
  );
}