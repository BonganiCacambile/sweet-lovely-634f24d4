import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/section";
import { ProductGrid } from "@/components/product-grid";
import { CityGrid } from "@/components/city-grid";
import { DeliveryFaqList } from "@/components/delivery-faq-list";
import { OfferGrid } from "@/components/offer-grid";
import { SiteFooter } from "@/components/site-footer";
import NewsletterFramerComponent from "@/framer/newsletter/newsletter";
import ReviewsFramerComponent from "@/framer/reviews/reviews";
import { FEATURED_PRODUCTS, CITIES, DESSERTS } from "@/data/menu";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pepper — Pizza & Delivery" },
      { name: "description", content: "Fresh pizza, fast delivery. Browse the menu and find a Pepper near you." },
      { property: "og:title", content: "Pepper — Pizza & Delivery" },
      { property: "og:description", content: "Fresh pizza, fast delivery. Browse the menu and find a Pepper near you." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />

      <section className="relative w-full overflow-hidden px-4 pb-12 pt-12 md:pb-20 md:pt-20">
        <HeroIngredients />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
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
              className="inline-flex items-center rounded-full bg-[#ff003c] px-8 py-3.5 text-base font-medium text-white shadow-[0_0_10px_rgba(255,0,60,0)] transition-shadow hover:shadow-[0_8px_20px_rgba(255,0,60,0.25)]"
            >
              Order Now
            </Link>
          </div>
          <div className="relative z-10 mt-12 w-full max-w-3xl">
            <img
              src="https://framerusercontent.com/images/Z9VcwtU158fAagyyaANuYIUtgoo.jpg?scale-down-to=1024"
              alt="Pizza Margheritta"
              className="h-auto w-full select-none"
            />
          </div>
        </div>
      </section>

      {/* Fan Favorites */}
      <section className="w-full bg-[#fdebec] px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Fan Favorites
            </h2>
            <p className="mt-4 text-base text-neutral-700 md:text-lg">
              From classic combinations to bold flavors, these pizzas top our list for a reason.
            </p>
          </div>
          <ProductGrid products={FEATURED_PRODUCTS} imageOnly />
          <div className="mt-12 flex justify-center">
            <Link
              to="/menu/full-menu"
              className="inline-flex items-center rounded-full bg-neutral-900 px-8 py-4 text-base font-semibold text-white transition hover:bg-neutral-800"
            >
              View Pizza Menu
            </Link>
          </div>
        </div>
      </section>

      {/* Hot Pizza, Hotter Deals */}
      <section id="deals" className="w-full px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Hot Pizza, Hotter Deals
            </h2>
            <p className="mt-4 text-base text-neutral-700 md:text-lg">
              From family-sized deals to solo slices, find the perfect offer for your pizza cravings.
            </p>
          </div>
          <OfferGrid />
        </div>
      </section>

      {/* Desserts */}
      <section id="desserts" className="w-full bg-[#fdebec] px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Save Room for Dessert!
            </h2>
            <p className="mt-4 text-base text-neutral-700 md:text-lg">
              Our desserts are worth it. Trust us, you won&apos;t want to miss these sweet delights.
            </p>
          </div>
          <ProductGrid products={DESSERTS} />
          <div className="mt-12 flex justify-center">
            <Link
              to="/menu/full-menu"
              className="inline-flex items-center rounded-full bg-neutral-900 px-8 py-4 text-base font-semibold text-white transition hover:bg-neutral-800"
            >
              View Deserts Menu
            </Link>
          </div>
        </div>
      </section>

      {/* Find Your Nearest Pizza Spot */}
      <section id="locations" className="w-full bg-neutral-50 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Find Your Nearest Pizza Spot
            </h2>
            <p className="mt-4 text-base text-neutral-700 md:text-lg">
              Locate our stores, check delivery zones, and pick the best option for you!
            </p>
          </div>
          <CityGrid cities={CITIES} />
        </div>
      </section>

      {/* Delivery FAQ */}
      <Section id="delivery">
        <DeliveryFaqList />
      </Section>

      {/* Testimonials */}
      <section className="w-full">
        <ReviewsFramerComponent.Responsive />
      </section>

      {/* Newsletter */}
      <section className="w-full">
        <NewsletterFramerComponent.Responsive />
      </section>

      <SiteFooter />
    </div>
  );
}

/** Floating ingredient decorations scattered around the hero, like the Framer template. */
function HeroIngredients() {
  const items: { src: string; alt: string; className: string }[] = [
    { src: "https://framerusercontent.com/images/kP2NqpJxzs3mxd89TNdxyZvyms.png?scale-down-to=512", alt: "basil", className: "left-[4%] top-[18%] h-20 w-20 md:h-28 md:w-28" },
    { src: "https://framerusercontent.com/images/4PC0Gy5LJt9gx1LT596KEeOxVk0.png?scale-down-to=512", alt: "mushroom", className: "left-[16%] top-[4%] h-16 w-16 md:h-24 md:w-24" },
    { src: "https://framerusercontent.com/images/Okjb0nB1GOkYPwcntjxG2t9dOU.png?scale-down-to=512", alt: "olive", className: "left-[2%] top-[55%] h-14 w-14 md:h-20 md:w-20" },
    { src: "https://framerusercontent.com/images/Oh7T6jN4XYvDVriZHd3zwKwGrUs.png?scale-down-to=512", alt: "jalapeño", className: "left-[10%] top-[70%] h-20 w-20 md:h-28 md:w-28 rotate-[-15deg]" },
    { src: "https://framerusercontent.com/images/PhZZgLMJNd9CBnmdNFn6oZ4geIo.png?scale-down-to=512", alt: "cherry tomato", className: "left-[6%] bottom-[6%] h-16 w-16 md:h-24 md:w-24" },
    { src: "https://framerusercontent.com/images/w4TnZiWCs3LkQhqdYmp5AucEXFA.png?scale-down-to=512", alt: "olive", className: "right-[6%] top-[10%] h-16 w-16 md:h-24 md:w-24" },
    { src: "https://framerusercontent.com/images/bvrc0x9pG8w1OtGBtKBKRFnW4cM.png?scale-down-to=512", alt: "cherry tomato", className: "right-[2%] top-[28%] h-20 w-20 md:h-28 md:w-28" },
    { src: "https://framerusercontent.com/images/NeeY359LTfhcwSN6JhuBh0Y8Bac.png?scale-down-to=512", alt: "mushroom", className: "right-[8%] top-[55%] h-20 w-20 md:h-28 md:w-28" },
    { src: "https://framerusercontent.com/images/5gHI1hMjMHXnIKWwZWDGepesMS4.png?scale-down-to=512", alt: "garlic", className: "right-[3%] top-[72%] h-20 w-20 md:h-28 md:w-28 rotate-12" },
    { src: "https://framerusercontent.com/images/WSIxf52atDWJJfphIQ7KE7eYvM.png?scale-down-to=512", alt: "basil", className: "right-[10%] bottom-[6%] h-20 w-20 md:h-28 md:w-28" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
      {items.map((it, i) => (
        <img
          key={i}
          src={it.src}
          alt=""
          className={`absolute select-none object-contain ${it.className}`}
        />
      ))}
    </div>
  );
}
