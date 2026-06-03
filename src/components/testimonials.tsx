import { useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { Testimonial } from "@/data/menu";

interface TestimonialsProps {
  items: Testimonial[];
}

/**
 * Pepper-style testimonials carousel: full-bleed dark band with large
 * portrait cards that peek at adjacent slides on the left/right edges.
 */
export function Testimonials({ items }: TestimonialsProps) {
  const [index, setIndex] = useState(0);
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);

  // Build [intro, ...items] track. The "intro" slide holds the heading.
  const slides = items.length;

  return (
    <section className="relative w-full overflow-hidden bg-neutral-950 py-16 md:py-24">
      <div className="relative mx-auto w-full max-w-[1400px] px-4 sm:px-6 md:px-8">
        {/* Two-card viewport: heading card + portrait card */}
        <div className="relative grid gap-5 md:grid-cols-2">
          {/* Heading card */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-neutral-900 p-8 text-white md:p-12 lg:p-14 min-h-[420px] md:min-h-[520px]">
            <div>
              <div className="mb-6 flex gap-1 text-yellow-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
                Pizza Perfection,
                <br />
                Expertly Rated
              </h2>
              <p className="mt-6 max-w-md text-base text-neutral-300 md:text-lg">
                Top foodies and chefs share their thoughts on
                <br className="hidden md:block" />
                why our pizzas stand out from the crowd.
              </p>
            </div>
            {/* Faded preview of previous testimonial */}
            <div className="mt-8 max-w-md text-neutral-500">
              <p className="text-sm italic line-clamp-3 md:text-base">
                &ldquo;{items[(index - 1 + slides) % slides].quote}&rdquo;
              </p>
              <p className="mt-4 text-lg font-semibold text-neutral-600">
                {items[(index - 1 + slides) % slides].name}
              </p>
              <p className="text-sm text-neutral-700">
                {items[(index - 1 + slides) % slides].title}
              </p>
            </div>
          </div>

          {/* Active portrait card */}
          <article className="relative overflow-hidden rounded-3xl bg-neutral-800 min-h-[420px] md:min-h-[520px]">
            {items[index].avatar && (
              <img
                src={items[index].avatar}
                alt={items[index].name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {/* Gradient for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {/* Nav arrows */}
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={prev}
              className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={next}
              className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Quote + name pinned to bottom */}
            <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-10">
              <blockquote className="max-w-xl text-base italic leading-relaxed md:text-lg">
                &ldquo;{items[index].quote}&rdquo;
              </blockquote>
              <p className="mt-6 text-xl font-semibold md:text-2xl">
                {items[index].name}
              </p>
              <p className="text-sm text-neutral-300 md:text-base">
                {items[index].title}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}