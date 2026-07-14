// Pizza cart id parsing shared between client (add-to-cart-button.tsx) and
// server (paystack.functions.ts stock check + order creation).
//
// Cart id format:
//   `${slug}-${size}`                  e.g. "buffalo-bliss-large"
//   `${slug}-${size}-x-<extras-hash>`  e.g. "buffalo-bliss-large-x-57eaf07c-..."
// Non-pizza products just use `${slug}`.

export const PIZZA_SIZE_FALLBACK: Record<string, number> = {
  medium: 80,
  large: 150,
};
const PIZZA_SUFFIXES = Object.keys(PIZZA_SIZE_FALLBACK);

export function splitPizzaId(id: string): { slug: string; size: string | null } {
  const xIdx = id.indexOf("-x-");
  const base = xIdx >= 0 ? id.slice(0, xIdx) : id;
  for (const suffix of PIZZA_SUFFIXES) {
    if (base.endsWith(`-${suffix}`)) {
      return { slug: base.slice(0, -(suffix.length + 1)), size: suffix };
    }
  }
  return { slug: base, size: null };
}