import type { MenuItem } from "@/data/menu";
import { ORDER_URL } from "@/data/menu";
import { Reveal } from "@/components/reveal";

/** Horizontal menu item card matching the Pepper Framer "Others - Menu - Desktop" variant. */
export function MenuCard({ item }: { item: MenuItem }) {
  return (
    <Reveal as="article" className="group flex flex-col items-start gap-8 border-b border-neutral-200 py-10 transition-transform duration-300 hover:-translate-y-1 md:flex-row md:items-center md:gap-12">
      <div className="hover-zoom-img relative aspect-square w-full max-w-[280px] shrink-0 overflow-hidden md:w-[260px]">
        <img
          src={item.image}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-contain transition-transform duration-700 ease-out group-hover:rotate-6 group-hover:scale-110"
        />
      </div>
      <div className="flex w-full flex-1 flex-col gap-5">
        <h3 className="text-2xl font-bold tracking-tight transition-colors duration-300 group-hover:text-[#ff003c] md:text-[28px]">{item.title}</h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-[140px_1fr] md:text-base">
          {item.content && (
            <>
              <dt className="text-neutral-500">Ingredients:</dt>
              <dd className="text-neutral-900">{item.content}</dd>
            </>
          )}
          {item.nutrition && (
            <>
              <dt className="text-neutral-500">Nutritional Info:</dt>
              <dd className="text-neutral-900">{item.nutrition}</dd>
            </>
          )}
          {item.allergens && (
            <>
              <dt className="text-neutral-500">Alergens:</dt>
              <dd className="text-neutral-900">{item.allergens}</dd>
            </>
          )}
        </dl>
        <div className="mt-2 flex items-center justify-between gap-6">
          <a
            href={item.orderUrl ?? ORDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-pop inline-flex h-11 items-center justify-center rounded-full bg-[#ff003c] px-7 text-sm font-medium text-white"
          >
            Order Now
          </a>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-neutral-500">{item.portion ?? ""}</span>
            <span className="text-2xl font-bold md:text-[28px]">{item.price}</span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}