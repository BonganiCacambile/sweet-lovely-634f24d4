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
      aria-pressed={selected}
      className={`group flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 active:scale-95 md:gap-3 md:px-5 md:py-2.5 md:text-base ${
        selected
          ? "border-[#ff003c] bg-[#ff003c] text-white shadow-md"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden
          className="h-5 w-5 shrink-0 object-contain transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 md:h-6 md:w-6"
        />
      )}
      <span className="whitespace-nowrap leading-none">{label}</span>
    </button>
  );
}