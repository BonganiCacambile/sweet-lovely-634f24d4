import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/section";
import { ProductGrid } from "@/components/product-grid";
import { FULL_MENU } from "@/data/menu";

export const Route = createFileRoute("/menu/full-menu")({
  head: () => ({
    meta: [
      { title: "Full Menu — Pepper" },
      { name: "description", content: "Browse the full Pepper menu — pizzas, sides and desserts." },
      { property: "og:title", content: "Full Menu — Pepper" },
      { property: "og:description", content: "Browse the full Pepper menu — pizzas, sides and desserts." },
    ],
  }),
  component: FullMenuPage,
});

function FullMenuPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />
      <Section title="Full menu" subtitle="Every Pepper pizza, in one place.">
        <ProductGrid products={FULL_MENU} />
      </Section>
    </div>
  );
}