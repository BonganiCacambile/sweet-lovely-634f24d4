import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MenuCard } from "@/components/menu-card";
import { Reveal } from "@/components/reveal";
import {
  CATEGORY_INTRO,
  MENU_CATEGORIES,
  MENU_ITEMS,
  type MenuCategory,
  type MenuItem,
} from "@/data/menu";
import { getPublicMenu } from "@/lib/public-menu.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export const Route = createFileRoute("/menu/full-menu")({
  head: () => ({
    meta: [
      { title: "Full Menu — Sweet & Lovely" },
      { name: "description", content: "Browse the full Sweet & Lovely menu — pizzas, sides and desserts." },
      { property: "og:title", content: "Full Menu — Sweet & Lovely" },
      { property: "og:description", content: "Browse the full Sweet & Lovely menu — pizzas, sides and desserts." },
      { property: "og:url", content: "https://sweet-n-lovely-pizza.lovable.app/menu/full-menu" },
    ],
    links: [{ rel: "canonical", href: "https://sweet-n-lovely-pizza.lovable.app/menu/full-menu" }],
  }),
  component: FullMenuPage,
});

function FullMenuPage() {
  const [active, setActive] = useState<MenuCategory | "all">("all");
  const fetchMenu = useServerFn(getPublicMenu);
  const { data } = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => fetchMenu(),
    staleTime: 30_000,
  });
  useRealtimeInvalidate(["products", "categories"], [["public-menu"]]);
  // product_sizes is broadcast for BBQ-style dynamic sizes
  useRealtimeInvalidate(["product_sizes"], [["public-menu"]]);

  // Preload category icon images so switching tabs never shows a stale bitmap.
  const preloadCategoryIcons = (data?.categories ?? [])
    .map((c) => c.image)
    .filter((src): src is string => Boolean(src));

  // Merge live DB rows with rich static metadata (ingredients/allergens/nutrition)
  const liveItems: MenuItem[] = (data?.products ?? []).map((p) => {
    const fallback = MENU_ITEMS.find((m) => m.id === p.slug);
    const ingredients = (p as { ingredients?: string[] | null }).ingredients ?? [];
    const ingredientsText = ingredients.length > 0 ? ingredients.join(", ") : fallback?.content;
    const allergensDb = (p as { allergens?: string | null }).allergens;
    const nutritionParts: string[] = [];
    const px = p as { calories?: number | null; fat_g?: number | null; carbs_g?: number | null; protein_g?: number | null; nutrition?: string | null };
    if (px.calories != null) nutritionParts.push(`Calories: ${px.calories}`);
    if (px.fat_g != null) nutritionParts.push(`Fat: ${px.fat_g}g`);
    if (px.carbs_g != null) nutritionParts.push(`Carbs: ${px.carbs_g}g`);
    if (px.protein_g != null) nutritionParts.push(`Protein: ${px.protein_g}g`);
    const nutritionText = nutritionParts.length > 0 ? nutritionParts.join(" · ") : (px.nutrition ?? fallback?.nutrition);
    const sizeEnabled = (p as { size_selection_enabled?: boolean }).size_selection_enabled === true;
    const productSizes = sizeEnabled
      ? (data?.sizes ?? [])
          .filter((s) => s.product_slug === p.slug)
          .map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            portion: s.portion,
            price_zar: Number(s.price_zar),
          }))
      : undefined;
    return {
      id: p.slug,
      title: p.title,
      price: `R${Math.round(Number(p.price_zar))}`,
      image: p.image ?? fallback?.image ?? "",
      category: (p.category_slug as MenuCategory) ?? fallback?.category ?? "pizza",
      content: ingredientsText,
      nutrition: nutritionText,
      allergens: allergensDb ?? fallback?.allergens,
      portion: fallback?.portion,
      priceMedium: p.price_medium_zar != null ? Number(p.price_medium_zar) : undefined,
      priceLarge: p.price_large_zar != null ? Number(p.price_large_zar) : undefined,
      sizes: productSizes && productSizes.length > 0 ? productSizes : undefined,
    } satisfies MenuItem;
  });
  const items: MenuItem[] = liveItems.length > 0 ? liveItems : MENU_ITEMS;
  const liveCategories = (data?.categories ?? []).map((c) => ({
    id: c.slug as MenuCategory,
    label: c.label,
    image: c.image ?? "",
    intro: c.intro as string | null,
  }));
  const categories =
    liveCategories.length > 0
      ? liveCategories
      : MENU_CATEGORIES.map((c) => ({ ...c, intro: null as string | null }));

  const visibleCategories =
    active === "all" ? categories.map((c) => c.id) : [active];

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />

      {/* Warm the browser cache for every category icon up front */}
      {preloadCategoryIcons.length > 0 && (
        <div aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
          {preloadCategoryIcons.map((src) => (
            <img key={src} src={src} alt="" width={24} height={24} decoding="async" fetchPriority="high" />
          ))}
        </div>
      )}

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pt-12 md:px-8 md:pt-20">
        <img
          src="https://framerusercontent.com/images/kP2NqpJxzs3mxd89TNdxyZvyms.png?scale-down-to=1024"
          alt=""
          aria-hidden
          className="animate-float pointer-events-none absolute right-[28%] top-4 hidden h-28 w-28 select-none md:block"
        />
        <img
          src="https://framerusercontent.com/images/7gdLv3Mt6BT6FbhDwFUhR0GnTE.png?scale-down-to=1024"
          alt=""
          aria-hidden
          className="animate-float-slow animate-float-delay pointer-events-none absolute right-[8%] top-10 hidden h-28 w-28 select-none md:block"
        />
        <Reveal as="h1" className="text-5xl font-extrabold tracking-tight md:text-7xl">Our Menu</Reveal>
        <Reveal as="p" delay={120} className="mt-6 max-w-2xl text-base text-neutral-700 md:text-lg">
          From savory pizzas to refreshing drinks, we take pride in serving dishes that are made with care.
          Every meal is thoughtfully prepared to give you a culinary experience worth remembering.
        </Reveal>
      </section>

      {/* Category tabs */}
      <nav className="sticky top-0 z-30 mx-auto mt-8 max-w-7xl bg-white/90 px-4 backdrop-blur-md md:static md:mt-16 md:bg-transparent md:px-8 md:backdrop-blur-none">
        <Reveal
          className="-mx-4 flex snap-x snap-mandatory flex-nowrap items-center gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:gap-4 md:px-0 md:py-2"
          stagger
          staggerStep={60}
        >
          <TabButton
            label="Full Menu"
            selected={active === "all"}
            onClick={() => setActive("all")}
          />
          {categories.map((c) => (
            <TabButton
              key={c.id}
              label={c.label}
              image={c.image}
              selected={active === c.id}
              onClick={() => setActive(c.id)}
            />
          ))}
        </Reveal>
      </nav>

      {/* Sections per category */}
      <div className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
        {visibleCategories.map((cat) => {
          const meta = categories.find((c) => c.id === cat);
          if (!meta) return null;
          const catItems = items.filter((i) => i.category === cat);
          return (
            <section key={cat} id={cat} className="mt-16 md:mt-24">
              <Reveal as="h2" className="text-4xl font-extrabold tracking-tight md:text-6xl">
                {meta.label}
              </Reveal>
              <Reveal as="p" delay={100} className="mt-5 max-w-4xl text-base text-neutral-700 md:text-lg">
                {meta.intro ?? CATEGORY_INTRO[cat]}
              </Reveal>
              <div className="mt-6">
                {catItems.map((item) => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <SiteFooter />
    </div>
  );
}

interface TabButtonProps {
  label: string;
  image?: string;
  selected: boolean;
  onClick: () => void;
}

function TabButton({ label, image, selected, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 active:scale-95 md:gap-3 md:px-5 md:py-2.5 md:text-base ${
        selected
          ? "border-[#ff003c] bg-[#ff003c] text-white shadow-md"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      {image && (
        <img
          key={image}
          src={image}
          alt=""
          aria-hidden
          width={24}
          height={24}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="h-5 w-5 shrink-0 object-contain transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 md:h-6 md:w-6"
        />
      )}
      <span className="whitespace-nowrap leading-none">{label}</span>
    </button>
  );
}