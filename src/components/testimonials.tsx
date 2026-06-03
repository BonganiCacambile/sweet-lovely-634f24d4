import { useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { Testimonial } from "@/data/menu";

interface TestimonialsProps {
  items: Testimonial[];
}

/**
 * Hand-built testimonials carousel matching the "Pizza Perfection, Expertly Rated"
 * dark section from the design reference.
 */
export function Testimonials({ items }: TestimonialsProps) {
  const [index, setIndex] = useState(0);
  const active = items[index];
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-neutral-950 px-6 py-12 text-white md:px-16 md:py-20">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <div className="mb-6 flex gap-1 text-yellow-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
          </div>
          <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
            Pizza Perfection,
            <br />
            Expertly Rated
          </h2>
          <p className="mt-6 max-w-md text-sm text-neutral-300 md:text-base">
            Top foodies and chefs share their thoughts on why our pizzas stand out
            from the crowd.
          </p>
        </div>

        <div className="relative min-h-[220px]">
          <blockquote className="text-base italic text-neutral-200 md:text-lg">
            &ldquo;{active.quote}&rdquo;
          </blockquote>
          <div className="mt-6 flex items-center gap-4">
            {active.avatar && (
              <img
                src={active.avatar}
                alt={active.name}
                className="h-14 w-14 flex-none rounded-full object-cover ring-2 ring-white/20"
              />
            )}
            <div>
              <p className="text-lg font-semibold">{active.name}</p>
              <p className="text-sm text-neutral-400">{active.title}</p>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={prev}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 transition hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={next}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 transition hover:bg-white/10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}