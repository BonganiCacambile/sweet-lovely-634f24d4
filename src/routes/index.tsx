import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/section";
import { ProductGrid } from "@/components/product-grid";
import { CityGrid } from "@/components/city-grid";
import { DeliveryFaqList } from "@/components/delivery-faq-list";
import { FEATURED_PRODUCTS, CITIES } from "@/data/menu";
import ButtonFramerComponent from "@/framer/button";

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
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
            Hot, fresh pizza — delivered fast.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-neutral-600 md:text-lg">
            Hand-stretched dough, premium toppings and crave-worthy specials.
            Order online or find your nearest Pepper.
          </p>
          <div className="mt-8">
            <ButtonFramerComponent.Responsive
              O5tlPGRu3={"View Our Menu"}
              lJNtxFrg5={"/menu/full-menu"}
            />
          </div>
        </div>
      </Section>

      <Section
        id="featured"
        title="Featured pizzas"
        subtitle="A small taste of what's on the menu."
      >
        <ProductGrid products={FEATURED_PRODUCTS} />
      </Section>

      <Section
        id="locations"
        title="Find a Pepper near you"
        subtitle="We deliver across major US cities."
      >
        <CityGrid cities={CITIES} />
        <div className="mt-10 flex justify-center">
          <Link
            to="/locations"
            className="text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            See all locations →
          </Link>
        </div>
      </Section>

      <Section id="delivery" title="Delivery & pickup" subtitle="Everything you need to know.">
        <DeliveryFaqList />
      </Section>

      <footer className="border-t border-neutral-200 px-4 py-8 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} Pepper. All rights reserved.
      </footer>
    </div>
  );
}
