import { useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { Testimonial } from "@/data/menu";

interface TestimonialsProps {
  items: Testimonial[];
}

/**
 * Testimonials section matching the Pepper "Pizza Perfection, Expertly Rated"
 * design: dark backdrop, large image cards side-by-side. The left card holds
 * the section intro overlaid on a dimmed reviewer photo; the right card is the
 * active testimonial with quote, name and prev/next arrows.
 */
export function Testimonials({ items }: TestimonialsProps) {
  const [index, setIndex] = useState(0);
  const active = items[index];
  const intro = items[(index + items.length - 1) % items.length];
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);

  const introImg = bigImage(intro.avatar);
  const activeImg = bigImage(active.avatar);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-neutral-950 p-4 text-white md:p-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {/* Intro card — hidden on small screens to keep focus on active quote */}
        <article
          className="relative hidden h-[560px] overflow-hidden rounded-2xl md:block"
          aria-hidden
        >
          {introImg && (
            <img
              src={introImg}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/70 via-neutral-950/40 to-neutral-950/90" />
          <div className="relative flex h-full flex-col p-10">
            <div className="mb-6 flex gap-1 text-yellow-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
            </div>
            <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
              Pizza Perfection,
              <br />
              Expertly Rated
            </h2>
            <p className="mt-6 max-w-sm text-base text-neutral-300">
              Top foodies and chefs share their thoughts on why our pizzas stand
              out from the crowd.
            </p>
            <div className="mt-auto opacity-60">
              <p className="text-lg font-semibold">{intro.name}</p>
              <p className="text-sm text-neutral-400">{intro.title}</p>
            </div>
          </div>
        </article>

        {/* Active testimonial card */}
        <article className="relative h-[440px] overflow-hidden rounded-2xl sm:h-[520px] md:h-[560px]">
          {activeImg && (
            <img
              src={activeImg}
              alt={active.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />

          {/* Mobile-only intro overlay */}
          <div className="absolute left-0 right-0 top-0 p-6 md:hidden">
            <div className="mb-3 flex gap-1 text-yellow-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight drop-shadow-lg sm:text-3xl">
              Pizza Perfection,
              <br />
              Expertly Rated
            </h2>
          </div>

          {/* Quote + meta + arrows */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 md:p-10">
            <div className="max-w-md">
              <blockquote className="text-sm italic leading-relaxed text-neutral-100 md:text-base">
                &ldquo;{active.quote}&rdquo;
              </blockquote>
              <div className="mt-4">
                <p className="text-lg font-semibold">{active.name}</p>
                <p className="text-sm text-neutral-300">{active.title}</p>
              </div>
            </div>
            <div className="flex flex-none flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={prev}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur transition hover:bg-black/80"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={next}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur transition hover:bg-black/80"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

/** Upgrade Unsplash thumbnail params to a large portrait crop for the card art. */
function bigImage(url?: string): string | undefined {
  if (!url) return url;
  if (!url.includes("images.unsplash.com")) return url;
  return url.replace(/[?&]w=\d+/, "?w=900").replace(/&h=\d+/, "&h=1200");
}