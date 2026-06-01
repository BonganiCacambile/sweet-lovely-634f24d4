import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/section";
import { ProductGrid } from "@/components/product-grid";
import { CityGrid } from "@/components/city-grid";
import { DeliveryFaqList } from "@/components/delivery-faq-list";
import { OfferGrid } from "@/components/offer-grid";
import { Testimonials } from "@/components/testimonials";
import { SiteFooter } from "@/components/site-footer";
import NewsletterFramerComponent from "@/framer/newsletter/newsletter";
import ReviewsFramerComponent from "@/framer/reviews/reviews";
import {
  FEATURED_PRODUCTS,
  CITIES,
  DESSERTS,
  TESTIMONIALS,
} from "@/data/menu";

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

      <Section className="pt-8 md:pt-16">
        <div className="flex flex-col items-center text-center">
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
              className="inline-flex items-center rounded-full bg-[#ff003c] px-8 py-4 text-base font-semibold text-white transition hover:bg-[#e60036]"
            >
              View Our Menu
            </Link>
          </div>
        </div>
      </Section>

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
