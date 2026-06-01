import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/section";
import { CityGrid } from "@/components/city-grid";
import { DeliveryFaqList } from "@/components/delivery-faq-list";
import { SiteFooter } from "@/components/site-footer";
import { CITIES } from "@/data/menu";

export const Route = createFileRoute("/locations")({
  head: () => ({
    meta: [
      { title: "Locations & Delivery — Pepper" },
      { name: "description", content: "Find a Pepper near you and see delivery zones, fees and pickup info." },
      { property: "og:title", content: "Locations & Delivery — Pepper" },
      { property: "og:description", content: "Find a Pepper near you and see delivery zones, fees and pickup info." },
    ],
  }),
  component: LocationsPage,
});

function LocationsPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />
      <Section title="Our cities" subtitle="Pick a city to see local hours and delivery zones.">
        <CityGrid cities={CITIES} />
      </Section>
      <Section title="Delivery & pickup">
        <DeliveryFaqList />
      </Section>
      <SiteFooter />
    </div>
  );
}