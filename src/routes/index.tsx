import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/section";
import { ProductGrid } from "@/components/product-grid";
import { CityGrid } from "@/components/city-grid";
import { DeliveryFaqList } from "@/components/delivery-faq-list";
import { SiteFooter } from "@/components/site-footer";
import { Testimonials } from "@/components/testimonials";
import { Reveal } from "@/components/reveal";
import MenuTabFramerComponent from "@/framer/menu-products/menu-tab";
import { DESSERTS, TESTIMONIALS } from "@/data/menu";
import { useActiveZoneCities } from "@/hooks/use-active-zones";
import { getHomeContent } from "@/lib/home-content.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import type { Product } from "@/components/product-grid";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sweet & Lovely — Pizza & Delivery" },
      { name: "description", content: "Fresh pizza, fast delivery. Browse the menu and find a Sweet & Lovely near you." },
      { property: "og:title", content: "Sweet & Lovely — Pizza & Delivery" },
      { property: "og:description", content: "Fresh pizza, fast delivery. Browse the menu and find a Sweet & Lovely near you." },
      { property: "og:url", content: "https://sweet-n-lovely-pizza.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://sweet-n-lovely-pizza.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Restaurant",
          name: "Sweet & Lovely",
          url: "https://sweet-n-lovely-pizza.lovable.app/",
          image: "https://sweet-n-lovely-pizza.lovable.app/logo.png",
          servesCuisine: ["Pizza", "Italian"],
          priceRange: "$$",
          acceptsReservations: false,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Do you deliver?",
              acceptedAnswer: { "@type": "Answer", text: "Yes — we deliver across our active zones. Enter your address at checkout to confirm availability and fees." },
            },
            {
              "@type": "Question",
              name: "How fast is delivery?",
              acceptedAnswer: { "@type": "Answer", text: "Most orders arrive within 30–60 minutes. Each delivery zone shows an estimated time at checkout." },
            },
            {
              "@type": "Question",
              name: "Can I order for pickup?",
              acceptedAnswer: { "@type": "Answer", text: "Yes, pickup is available at every Sweet & Lovely location during opening hours." },
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { cities } = useActiveZoneCities();
  const fetchContent = useServerFn(getHomeContent);
  const { data: content } = useQuery({
    queryKey: ["home-content"],
    queryFn: () => fetchContent(),
    staleTime: 30_000,
  });
  useRealtimeInvalidate(
    ["home_popular_items", "home_hot_deals", "home_specials", "home_banners", "featured_items", "home_section_visibility"],
    [["home-content"]],
  );

  const visibility = content?.visibility ?? {};
  const showSection = (key: string) => visibility[key] !== false;

  const popular: Product[] = (content?.popular ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price ?? "",
    image: p.image_url ?? undefined,
    content: p.description ?? undefined,
    nutrition: "from",
  }));

  const banners = (content?.banners ?? []).filter((b) => b.is_active !== false);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />

      {banners.length > 0 && showSection("banners") && <HeroBanners banners={banners} />}

      <section className="relative h-[calc(100vh-88px)] max-h-[640px] min-h-[560px] w-full overflow-hidden px-4 pt-12 sm:px-6 md:pt-20 lg:px-8">
        <HeroIngredients />
        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center text-center">
          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight md:text-7xl">
            Your Pizza Party Starts Here!
          </h1>
          <p className="mt-6 max-w-xl text-base text-neutral-700 md:text-lg">
            Gather your friends and family and enjoy the best pizza in town.
            Freshly made and delivered hot!
          </p>
          <div className="mt-10">
            <Link
              to="/menu/full-menu"
              className="btn-pop inline-flex items-center rounded-full bg-[#ff003c] px-8 py-3.5 text-base font-medium text-white shadow-[0_0_10px_rgba(255,0,60,0)] hover:bg-[#e6003a]"
            >
              View Our Menu
            </Link>
          </div>
          <div className="pointer-events-none absolute bottom-[-360px] left-1/2 z-0 w-[620px] max-w-none -translate-x-1/2 md:bottom-[-820px] md:w-[1000px]">
            <img
              src="https://framerusercontent.com/images/TselH8OEkb2YNE35eIM1vVAfb6s.png?scale-down-to=1024"
              alt="Pizza Margheritta"
              width={1000}
              height={1000}
              fetchPriority="high"
              className="h-auto w-full select-none animate-spin-slow"
            />
          </div>
        </div>
      </section>

      {/* Fan Favorites */}
      {showSection("popular") && popular.length > 0 && <FanFavoritesSection items={popular} />}

      {/* Hot Pizza, Hotter Deals */}
      {showSection("hot_deals") && (content?.hotDeals ?? []).length > 0 && (
      <section id="deals" className="w-full px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-12 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Hot Pizza, Hotter Deals
            </h2>
            <p className="mt-4 text-base text-neutral-700 md:text-lg">
              From family-sized deals to solo slices, find the perfect offer for your pizza cravings.
            </p>
          </Reveal>
          <HotDealGrid deals={content?.hotDeals ?? []} />
        </div>
      </section>
      )}

      {/* Specials */}
      {showSection("specials") && (content?.specials ?? []).length > 0 && (
        <section className="w-full bg-white px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-12 text-center">
              <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Today&apos;s Specials</h2>
              <p className="mt-4 text-base text-neutral-700 md:text-lg">
                Handpicked combos and meal deals — for a limited time only.
              </p>
            </Reveal>
            <SpecialsGrid specials={content?.specials ?? []} />
          </div>
        </section>
      )}

      {/* Desserts */}
      {showSection("desserts") && (
      <section id="desserts" className="w-full bg-white px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-12 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Save Room for Dessert!
            </h2>
            <p className="mt-4 text-base text-neutral-700 md:text-lg">
              Our desserts are worth it. Trust us, you won&apos;t want to miss these sweet delights.
            </p>
          </Reveal>
          <ProductGrid products={DESSERTS} />
          <div className="mt-12 flex justify-center">
            <Link
              to="/menu/full-menu"
              className="btn-pop inline-flex items-center rounded-full bg-neutral-900 px-8 py-4 text-base font-semibold text-white hover:bg-neutral-800"
            >
              View Deserts Menu
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Find Your Nearest Pizza Spot */}
      <section id="locations" className="w-full bg-neutral-50 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-12 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Find Your Nearest Pizza Spot
            </h2>
            <p className="mt-4 text-base text-neutral-700 md:text-lg">
              Locate our stores, check delivery zones, and pick the best option for you!
            </p>
          </Reveal>
          <CityGrid cities={cities} />
        </div>
      </section>

      {/* Delivery FAQ */}
      <Section id="delivery">
        <DeliveryFaqList />
      </Section>

      {/* Testimonials */}
      <section className="w-full px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Testimonials items={TESTIMONIALS} />
        </div>
      </section>

      {/* Newsletter */}
      <NewsletterSection />

      <SiteFooter />
    </div>
  );
}

function HeroBanners({ banners }: { banners: Array<{ id: string; title: string; subtitle: string | null; image_url: string | null; cta_label: string | null; cta_href: string | null }> }) {
  return (
    <div className="w-full bg-[#fff5f7] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl grid gap-3 md:grid-cols-2">
        {banners.slice(0, 4).map((b) => (
          <a
            key={b.id}
            href={b.cta_href ?? "#"}
            className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-lg"
          >
            {b.image_url && (
              <img src={b.image_url} alt={b.title} className="h-32 w-full object-cover transition group-hover:scale-105" />
            )}
            <div className="p-4">
              <p className="text-base font-bold text-neutral-900">{b.title}</p>
              {b.subtitle && <p className="text-sm text-neutral-600">{b.subtitle}</p>}
              {b.cta_label && (
                <span className="mt-2 inline-flex items-center rounded-full bg-[#ff003c] px-3 py-1 text-xs font-semibold text-white">
                  {b.cta_label}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

const hotDealPizzaAsset = (hash: string) =>
  `https://framerusercontent.com/images/${hash}?width=1200&height=1200`;

const hotDealImagePairs = [
  {
    match: "spicy",
    images: [hotDealPizzaAsset("lp6wNgrYu7ClOrMG4ibaVQNDWLo.png"), hotDealPizzaAsset("fOcW4cqVIKe7O6jovEeqZ46Cg.png")],
  },
  {
    match: "cheese",
    images: [hotDealPizzaAsset("Q4djsExkm2dVJLND8pnRkbmHKy8.png"), hotDealPizzaAsset("EvzWDEqJkdunx7f5YzmUVnArM4.png")],
  },
  {
    match: "meat",
    images: [hotDealPizzaAsset("ilD3FzfskejkXM7jRyVgKSBEE5I.png"), hotDealPizzaAsset("dQKnVrygQTPBTqZDioB8akNs.png")],
  },
  {
    match: "veggie",
    images: [hotDealPizzaAsset("vtNegrYfppnZJV5SpQd607Hls8.png"), hotDealPizzaAsset("Q2rEr3IGpX893CKsEuhm5IGMKk.png")],
  },
  {
    match: "sweet",
    images: [hotDealPizzaAsset("z0tpcmuGY42myUTNyLF9LCXg.png"), hotDealPizzaAsset("bo5PFGtg1mLU0lWO3J9CWKVAcM.png")],
  },
] as const;

function getHotDealImages(deal: { title: string; image_url: string | null }) {
  const normalizedTitle = deal.title.toLowerCase();
  const matchedPair = hotDealImagePairs.find((pair) => normalizedTitle.includes(pair.match));
  if (matchedPair) return matchedPair.images;
  if (deal.image_url) return [deal.image_url, deal.image_url] as const;
  return hotDealImagePairs[0].images;
}

function HotDealGrid({ deals }: { deals: Array<{ id: string; title: string; description: string | null; image_url: string | null; original_price: number | null; discounted_price: number | null; discount_pct: number | null; label: string | null }> }) {
  const colors = ["bg-[#ff003c] text-white", "bg-[#ffcc00] text-neutral-900", "bg-[#333333] text-white", "bg-[#0a9900] text-white", "bg-[#ff9100] text-white"];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {deals.map((d, i) => {
        const orig = d.original_price != null ? Number(d.original_price) : null;
        const disc = d.discounted_price != null ? Number(d.discounted_price) : null;
        const save = orig != null && disc != null ? (orig - disc).toFixed(0) : null;
        const raw = (d.label ?? d.description ?? "").trim();
        const items = raw
          ? raw
              .split(/\r?\n|(?:\s*[+•·]\s*)|(?:,\s*)/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const [firstPizza, secondPizza] = getHotDealImages(d);
        return (
          <Reveal key={d.id} className="w-full" delay={i * 60}>
            <article className={`group relative flex min-h-[520px] flex-col overflow-hidden rounded-[24px] px-8 pb-[260px] pt-10 transition-transform hover:-translate-y-1.5 md:min-h-[560px] md:px-12 md:pb-[300px] md:pt-12 ${colors[i % colors.length]}`}>
              <h3 className="relative z-10 text-[28px] font-extrabold leading-[1.15] md:text-[32px]">{d.title}</h3>
              {items.length > 0 ? (
                <ul className="relative z-10 mt-6 flex flex-col gap-3 text-[18px] leading-[1.35] md:text-[20px]">
                  {items.map((it, idx) => (
                    <li key={`${it}-${idx}`} className="flex gap-3">
                      <span className="mt-[0.55em] h-[6px] w-[6px] shrink-0 rounded-full bg-current" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="relative z-10 mt-auto flex flex-wrap items-end justify-between gap-3 pt-8">
                <AddToCartButton
                  item={{
                    id: `deal-${d.id}`,
                    title: d.title,
                    price: disc != null ? `R${disc.toFixed(0)}` : "",
                    image: d.image_url ?? undefined,
                    variation: d.label ?? undefined,
                  }}
                  className="h-10 px-6 text-[15px]"
                />
                <p className="flex items-end gap-2 whitespace-nowrap text-[20px] font-extrabold leading-none md:text-[22px]">
                  {disc != null ? `R${disc.toFixed(0)}` : ""}
                  {save && <span className="text-[18px] font-light md:text-[20px]">- Save R{save}</span>}
                </p>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[245px] md:h-[285px]" aria-hidden>
                <img
                  src={firstPizza}
                  alt=""
                  loading="eager"
                  className="absolute bottom-[-44%] left-[-6%] h-[310px] w-[310px] select-none rounded-full object-cover transition-transform duration-700 group-hover:-rotate-6 group-hover:scale-105 md:bottom-[-48%] md:left-[2%] md:h-[390px] md:w-[390px]"
                />
                <img
                  src={secondPizza}
                  alt=""
                  loading="eager"
                  className="absolute bottom-[-46%] right-[-8%] h-[310px] w-[310px] select-none rounded-full object-cover transition-transform duration-700 group-hover:rotate-6 group-hover:scale-105 md:bottom-[-48%] md:right-[2%] md:h-[390px] md:w-[390px]"
                />
              </div>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}

function SpecialsGrid({ specials }: { specials: Array<{ id: string; title: string; description: string | null; image_url: string | null; price: string | null; kind: string }> }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {specials.map((s, i) => (
        <Reveal key={s.id} delay={i * 60}>
          <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-[#fff5f7] transition-shadow hover:shadow-lg">
            {s.image_url && (
              <img src={s.image_url} alt={s.title} className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            )}
            <div className="flex flex-1 flex-col p-5">
              <span className="inline-block w-fit rounded-full bg-[#ff003c] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {s.kind.replace("_", " ")}
              </span>
              <h3 className="mt-2 text-xl font-extrabold">{s.title}</h3>
              {s.description && <p className="mt-1 text-sm text-neutral-600 line-clamp-3">{s.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-lg font-bold text-[#ff003c]">{s.price ?? ""}</span>
                <AddToCartButton
                  item={{ id: `special-${s.id}`, title: s.title, price: s.price ?? "", image: s.image_url ?? undefined }}
                  className="h-9 px-5 text-[13px]"
                />
              </div>
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  );
}

function NewsletterSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#fff5f7] px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2">
        <div className="relative flex justify-center md:justify-start">
          <img
            src="https://framerusercontent.com/images/TselH8OEkb2YNE35eIM1vVAfb6s.png?scale-down-to=1024"
            alt="Pizza Margheritta"
            className="h-auto w-[320px] select-none md:w-[460px] animate-spin-slow"
          />
        </div>
        <div className="text-center md:text-left">
          <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            Delicious Deals,
            <br />
            Just for You
          </h2>
          <p className="mt-4 text-base text-neutral-700 md:text-lg">
            Sign up for our newsletter and receive exclusive offers on new pizzas!
          </p>
          <form
            className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row md:mx-0"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              required
              placeholder="your-email@example.com"
              className="h-12 flex-1 rounded-full border border-neutral-200 bg-white px-5 text-sm text-neutral-900 outline-none transition focus:border-[#ff003c]"
            />
            <button
              type="submit"
              className="btn-pop h-12 rounded-full bg-[#ff003c] px-8 text-sm font-semibold text-white hover:bg-[#e6003a]"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function FanFavoritesSection({ items }: { items: Product[] }) {
  const [showPopular, setShowPopular] = useState(true);

  return (
    <section className="w-full bg-[#fff5f7] px-4 py-20 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center">
        <Reveal className="mb-11 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            Fan Favorites
          </h2>
          <p className="mt-7 text-base text-neutral-900 md:text-lg">
            From classic combinations to bold flavors, these pizzas top our list for a reason.
          </p>
        </Reveal>
        <button
          type="button"
          onClick={() => setShowPopular((v) => !v)}
          aria-pressed={showPopular}
          className={`group mb-10 inline-flex items-center gap-3 rounded-full border pl-2 pr-6 py-2 text-base font-semibold transition-all duration-300 ease-out shadow-sm hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#ff003c] ${
            showPopular
              ? "bg-neutral-900 text-white border-neutral-900"
              : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-900"
          }`}
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#fff5f7] overflow-hidden ring-1 ring-black/5">
            <img
              src="https://framerusercontent.com/images/bo5PFGtg1mLU0lWO3J9CWKVAcM.png?scale-down-to=512"
              alt=""
              className="h-9 w-9 object-contain transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
            />
          </span>
          <span className="tracking-tight">Popular</span>
          <span
            aria-hidden="true"
            className={`ml-1 relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${
              showPopular ? "bg-[#ff003c]" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300 ${
                showPopular ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
        {showPopular && <ProductGrid products={items} imageOnly isPizza />}
        <div className="mt-12 flex justify-center">
          <Link
            to="/menu/full-menu"
            className="btn-pop inline-flex items-center rounded-full bg-neutral-900 px-8 py-4 text-base font-semibold text-white hover:bg-neutral-800"
          >
            View Pizza Menu
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Floating ingredient decorations scattered around the hero, like the Framer template. */
function HeroIngredients() {
  const items: { src: string; alt: string; className: string }[] = [
    { src: "https://framerusercontent.com/images/kP2NqpJxzs3mxd89TNdxyZvyms.png?scale-down-to=512", alt: "basil", className: "left-[4%] top-[18%] h-24 w-24 md:h-28 md:w-28" },
    { src: "https://framerusercontent.com/images/4PC0Gy5LJt9gx1LT596KEeOxVk0.png?scale-down-to=512", alt: "mushroom", className: "left-[16%] top-[4%] h-20 w-20 md:h-24 md:w-24" },
    { src: "https://framerusercontent.com/images/Okjb0nB1GOkYPwcntjxG2t9dOU.png?scale-down-to=512", alt: "olive", className: "left-[2%] top-[55%] h-16 w-16 md:h-20 md:w-20" },
    { src: "https://framerusercontent.com/images/Oh7T6jN4XYvDVriZHd3zwKwGrUs.png?scale-down-to=512", alt: "jalapeño", className: "left-[10%] top-[70%] h-24 w-24 md:h-28 md:w-28 rotate-[-15deg]" },
    { src: "https://framerusercontent.com/images/PhZZgLMJNd9CBnmdNFn6oZ4geIo.png?scale-down-to=512", alt: "cherry tomato", className: "left-[6%] bottom-[6%] h-20 w-20 md:h-24 md:w-24" },
    { src: "https://framerusercontent.com/images/w4TnZiWCs3LkQhqdYmp5AucEXFA.png?scale-down-to=512", alt: "olive", className: "right-[6%] top-[10%] h-20 w-20 md:h-24 md:w-24" },
    { src: "https://framerusercontent.com/images/bvrc0x9pG8w1OtGBtKBKRFnW4cM.png?scale-down-to=512", alt: "cherry tomato", className: "right-[2%] top-[28%] h-24 w-24 md:h-28 md:w-28" },
    { src: "https://framerusercontent.com/images/NeeY359LTfhcwSN6JhuBh0Y8Bac.png?scale-down-to=512", alt: "mushroom", className: "right-[8%] top-[55%] h-24 w-24 md:h-28 md:w-28" },
    { src: "https://framerusercontent.com/images/5gHI1hMjMHXnIKWwZWDGepesMS4.png?scale-down-to=512", alt: "garlic", className: "right-[3%] top-[72%] h-24 w-24 md:h-28 md:w-28 rotate-12" },
    { src: "https://framerusercontent.com/images/WSIxf52atDWJJfphIQ7KE7eYvM.png?scale-down-to=512", alt: "basil", className: "right-[10%] bottom-[6%] h-24 w-24 md:h-28 md:w-28" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {items.map((it, i) => (
        <img
          key={i}
          src={it.src}
          alt=""
          className={`absolute select-none object-contain ${i % 2 === 0 ? "animate-float" : "animate-float-slow"} ${it.className}`}
          style={{ animationDelay: `${(i % 5) * 0.4}s` }}
        />
      ))}
    </div>
  );
}
