import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHomeContent } from "@/lib/public-home.functions";
import { useZone } from "@/lib/zone-context";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { HomePopularSection, HomeHotDealsSection, HomeSpecialsSection, HomeBannersSection } from "@/components/home/home-sections";

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
  const { selected } = useZone();
  const fetchHome = useServerFn(getHomeContent);
  const { data: home } = useQuery({
    queryKey: ["home-content", selected?.id ?? null],
    queryFn: () => fetchHome({ data: { zoneId: selected?.id ?? null } }),
  });
  useRealtimeInvalidate(
    ["home_popular_items", "home_hot_deals", "home_specials", "home_banners", "home_section_visibility"],
    [["home-content", selected?.id ?? null]],
  );
  const visible = (section: string) => home?.visibility[section] !== false;
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />

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

      {visible("banners") && <HomeBannersSection banners={home?.banners ?? []} />}

      {/* Fan Favorites */}
      {visible("popular") && <HomePopularSection items={home?.popular ?? []} zoneId={selected?.id ?? null} />}

      {/* Hot Pizza, Hotter Deals */}
      {visible("hot_deals") && <HomeHotDealsSection deals={home?.hotDeals ?? []} zoneId={selected?.id ?? null} />}
      {visible("specials") && <HomeSpecialsSection specials={home?.specials ?? []} zoneId={selected?.id ?? null} />}

      {/* Desserts */}
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
