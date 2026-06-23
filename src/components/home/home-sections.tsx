import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Reveal } from "@/components/reveal";
import { ProductGrid, type Product } from "@/components/product-grid";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { useServerFn } from "@tanstack/react-start";
import { trackHomeEvent } from "@/lib/public-home.functions";

interface PopularItem {
  id: string; title: string; description: string | null; image_url: string | null;
  price: string | null; product_slug: string | null; category: string | null;
}
interface HotDeal {
  id: string; title: string; description: string | null; image_url: string | null;
  product_slug: string | null; original_price: number | null; discounted_price: number | null;
  discount_pct: number | null; label: string | null;
}
interface Special {
  id: string; title: string; description: string | null; image_url: string | null;
  price: string | null; product_slugs: string[]; kind: string;
}
interface Banner {
  id: string; title: string; subtitle: string | null; image_url: string | null;
  cta_label: string | null; cta_href: string | null;
}

function useTrackViews(ids: string[], contentType: "popular" | "hot_deal" | "special" | "banner", zoneId: string | null) {
  const trackFn = useServerFn(trackHomeEvent);
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const id of ids) {
      void trackFn({ data: { contentId: id, contentType, eventType: "view", zoneId } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);
}

/* ---------------- Popular ---------------- */

export function HomePopularSection({ items, zoneId }: { items: PopularItem[]; zoneId: string | null }) {
  useTrackViews(items.map(i => i.id), "popular", zoneId);
  if (items.length === 0) return null;
  const products: Product[] = items.map(i => ({
    id: i.id,
    title: i.title,
    price: i.price ?? "",
    allergens: i.category ?? undefined,
    nutrition: i.description ?? undefined,
    content: i.description ?? undefined,
    image: i.image_url ?? undefined,
  }));
  return (
    <section className="w-full bg-[#fff5f7] px-4 py-20 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center">
        <Reveal className="mb-11 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Fan Favorites</h2>
          <p className="mt-7 text-base text-neutral-900 md:text-lg">From classic combinations to bold flavors, these pizzas top our list for a reason.</p>
        </Reveal>
        <ProductGrid products={products} imageOnly isPizza />
        <div className="mt-12 flex justify-center">
          <Link to="/menu/full-menu" className="btn-pop inline-flex items-center rounded-full bg-neutral-900 px-8 py-4 text-base font-semibold text-white hover:bg-neutral-800">View Pizza Menu</Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Hot Deals ---------------- */

const DEAL_BG = ["bg-[#ff003c]","bg-[#ffcc00]","bg-[#333333]","bg-[#0a9900]","bg-[#ff9100]"];
const DARK_TEXT = new Set(["bg-[#ffcc00]"]);

export function HomeHotDealsSection({ deals, zoneId }: { deals: HotDeal[]; zoneId: string | null }) {
  useTrackViews(deals.map(d => d.id), "hot_deal", zoneId);
  const trackFn = useServerFn(trackHomeEvent);
  if (deals.length === 0) return null;
  return (
    <section id="deals" className="w-full px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-12 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Hot Pizza, Hotter Deals</h2>
          <p className="mt-4 text-base text-neutral-700 md:text-lg">From family-sized deals to solo slices, find the perfect offer for your pizza cravings.</p>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d, i) => {
            const bg = DEAL_BG[i % DEAL_BG.length];
            const dark = DARK_TEXT.has(bg);
            const savings = d.original_price && d.discounted_price ? Number(d.original_price) - Number(d.discounted_price) : null;
            return (
              <Reveal key={d.id} delay={Math.min(i, 6) * 80}>
                <article className={`hover-zoom group relative w-full overflow-hidden rounded-[24px] transition-transform duration-300 hover:-translate-y-1.5 ${bg} ${dark ? "text-neutral-900" : "text-white"} min-h-[420px] px-6 pb-[180px] pt-6 md:min-h-[491px] md:px-12 md:pb-[240px] md:pt-12`}>
                  {d.label && <span className="relative z-10 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{d.label}</span>}
                  <h3 className="relative z-10 mt-3 text-[28px] font-extrabold leading-[1.2]">{d.title}</h3>
                  {d.description && <p className="relative z-10 mt-3 text-[15px] opacity-90">{d.description}</p>}
                  <div className="relative z-10 mt-6 flex w-full flex-wrap items-center justify-between gap-3 pt-3" onClick={() => void trackFn({ data: { contentId: d.id, contentType: "hot_deal", eventType: "click", zoneId } })}>
                    <AddToCartButton
                      item={{ id: `deal-${d.id}`, title: d.title, price: d.discounted_price ? `R${Number(d.discounted_price).toFixed(2)}` : "", image: d.image_url ?? undefined }}
                      className="h-9 px-6 text-[15px]"
                    />
                    <p className="flex items-end gap-2 whitespace-nowrap text-[20px] font-extrabold leading-none md:text-[22px]">
                      {d.discounted_price ? `R${Number(d.discounted_price).toFixed(2)}` : ""}
                      {savings && <span className="text-[18px] font-light leading-none md:text-[22px]">- Save R{savings.toFixed(2)}</span>}
                      {!savings && d.discount_pct ? <span className="text-[18px] font-light leading-none">- {d.discount_pct}% off</span> : null}
                    </p>
                  </div>
                  {d.image_url && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex items-start justify-center overflow-visible h-[160px] sm:h-[200px] md:h-[216px]" aria-hidden>
                      <img src={d.image_url} alt="" loading="eager" className="absolute top-0 select-none object-contain transition-transform duration-700 ease-out group-hover:scale-105 left-[-5px] h-[210px] w-[210px] sm:left-[-60px] sm:h-[340px] sm:w-[340px] md:left-[-48px] md:h-[400px] md:w-[400px]" />
                    </div>
                  )}
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Specials ---------------- */

export function HomeSpecialsSection({ specials, zoneId }: { specials: Special[]; zoneId: string | null }) {
  useTrackViews(specials.map(s => s.id), "special", zoneId);
  const trackFn = useServerFn(trackHomeEvent);
  if (specials.length === 0) return null;
  return (
    <section className="w-full bg-neutral-50 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-12 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Today's Specials</h2>
          <p className="mt-4 text-base text-neutral-700 md:text-lg">Hand-picked combos, meal deals and seasonal favorites.</p>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {specials.map((s, i) => (
            <Reveal key={s.id} delay={Math.min(i, 6) * 80}>
              <article className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                {s.image_url && <img src={s.image_url} alt={s.title} className="h-48 w-full object-cover transition group-hover:scale-105" />}
                <div className="p-5">
                  <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-amber-800">{s.kind}</span>
                  <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
                  {s.description && <p className="mt-2 text-sm text-neutral-600">{s.description}</p>}
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-lg font-bold text-[#ff003c]">{s.price ?? ""}</p>
                    <span onClick={() => void trackFn({ data: { contentId: s.id, contentType: "special", eventType: "click", zoneId } })}>
                      <AddToCartButton item={{ id: `special-${s.id}`, title: s.title, price: s.price ?? "", image: s.image_url ?? undefined }} className="h-9 px-5 text-sm" />
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Banners ---------------- */

export function HomeBannersSection({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;
  return (
    <section className="w-full px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {banners.map((b) => {
          const inner = (
            <div className="relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-gradient-to-r from-[#ff003c] to-[#ff7a45] p-6 text-white sm:flex-row sm:items-center sm:p-8">
              {b.image_url && <img src={b.image_url} alt="" className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-30" />}
              <div className="relative z-10 flex-1">
                <h3 className="text-2xl font-bold sm:text-3xl">{b.title}</h3>
                {b.subtitle && <p className="mt-1 text-sm sm:text-base">{b.subtitle}</p>}
              </div>
              {b.cta_label && (
                <span className="relative z-10 inline-flex w-fit items-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#ff003c]">{b.cta_label}</span>
              )}
            </div>
          );
          if (b.cta_href) return <a key={b.id} href={b.cta_href}>{inner}</a>;
          return <div key={b.id}>{inner}</div>;
        })}
      </div>
    </section>
  );
}
