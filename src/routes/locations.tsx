import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/section";
import { CityGrid } from "@/components/city-grid";
import { DeliveryFaqList } from "@/components/delivery-faq-list";
import { SiteFooter } from "@/components/site-footer";
import { useActiveZoneCities } from "@/hooks/use-active-zones";

export const Route = createFileRoute("/locations")({
  head: () => ({
    meta: [
      { title: "Locations & Delivery — Sweet & Lovely" },
      { name: "description", content: "Find a Sweet & Lovely near you and see delivery zones, fees and pickup info." },
      { property: "og:title", content: "Locations & Delivery — Sweet & Lovely" },
      { property: "og:description", content: "Find a Sweet & Lovely near you and see delivery zones, fees and pickup info." },
      { property: "og:url", content: "https://sweet-n-lovely-pizza.lovable.app/locations" },
    ],
    links: [{ rel: "canonical", href: "https://sweet-n-lovely-pizza.lovable.app/locations" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What areas do you deliver to?",
              acceptedAnswer: { "@type": "Answer", text: "We deliver across our active zones. Enter your address at checkout to see whether delivery is available and the fee for your area." },
            },
            {
              "@type": "Question",
              name: "How long does delivery take?",
              acceptedAnswer: { "@type": "Answer", text: "Most orders arrive within 30–60 minutes depending on your zone and current store load. Each zone shows an estimated delivery time at checkout." },
            },
            {
              "@type": "Question",
              name: "Can I pick up my order?",
              acceptedAnswer: { "@type": "Answer", text: "Yes — pickup is available at every Sweet & Lovely location during opening hours. Select pickup at checkout." },
            },
          ],
        }),
      },
    ],
  }),
  component: LocationsPage,
});

function LocationsPage() {
  const { cities } = useActiveZoneCities();
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 md:px-8 md:pt-20">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 md:text-6xl">
          Our Locations
        </h1>
        <p className="mt-4 max-w-2xl text-base text-neutral-700 md:text-lg">
          Find a Sweet &amp; Lovely near you, check delivery zones and fees, and learn how to order for pickup.
        </p>
      </section>
      <Section title="Our cities" subtitle="Pick a city to see local hours and delivery zones.">
        <CityGrid cities={cities} />
      </Section>
      <Section title="Delivery & pickup">
        <DeliveryFaqList />
      </Section>
      <SiteFooter />
    </div>
  );
}