import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MenuCard } from "@/components/menu-card";
import { Reveal } from "@/components/reveal";
import {
  CATEGORY_INTRO,
  MENU_CATEGORIES,
  MENU_ITEMS,
  type MenuCategory,
} from "@/data/menu";

export const Route = createFileRoute("/menu/full-menu")({
  head: () => ({
    meta: [
      { title: "Full Menu - Pepper - Pizza Framer Template" },
      { name: "description", content: "Browse the full Pepper menu — pizzas, sides and desserts." },
      { property: "og:title", content: "Full Menu - Pepper - Pizza Framer Template" },
      { property: "og:description", content: "Browse the full Pepper menu — pizzas, sides and desserts." },
    ],
  }),
  component: FullMenuPage,
});

function FullMenuPage() {
  const [active, setActive] = useState<MenuCategory | "all">("all");

  const visibleCategories =
    active === "all" ? MENU_CATEGORIES.map((c) => c.id) : [active];

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />

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
      <nav className="mx-auto mt-12 max-w-7xl px-4 md:mt-16 md:px-8">
        <Reveal className="flex flex-wrap items-center gap-3 md:gap-4" stagger staggerStep={60}>
          <TabButton
            label="Full Menu"
            selected={active === "all"}
            onClick={() => setActive("all")}
          />
          {MENU_CATEGORIES.map((c) => (
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
          const meta = MENU_CATEGORIES.find((c) => c.id === cat)!;
          const items = MENU_ITEMS.filter((i) => i.category === cat);
          return (
            <section key={cat} id={cat} className="mt-16 md:mt-24">
              <Reveal as="h2" className="text-4xl font-extrabold tracking-tight md:text-6xl">
                {meta.label}
              </Reveal>
              <Reveal as="p" delay={100} className="mt-5 max-w-4xl text-base text-neutral-700 md:text-lg">
                {CATEGORY_INTRO[cat]}
              </Reveal>
              <div className="mt-6">
                {items.map((item) => (
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
      className={`group flex items-center gap-3 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] md:text-base ${
        selected
          ? "bg-neutral-100 text-neutral-900 shadow-sm"
          : "text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {image && (
        <img src={image} alt="" aria-hidden className="h-7 w-7 object-contain transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
      )}
      <span>{label}</span>
      {selected && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-[#ff003c]" />}
    </button>
  );
}