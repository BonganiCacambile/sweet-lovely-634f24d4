import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ArrowRight, Tag, ShoppingBag } from "lucide-react";
import * as React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { QtyControl } from "@/components/cart/cart-drawer";
import { useCart, formatPrice, computeTotals } from "@/lib/cart-context";
import { useZone } from "@/lib/zone-context";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Cart — Sweet & Lovely" },
      { name: "description", content: "Review your order before checkout." },
      { property: "og:title", content: "Cart — Sweet & Lovely" },
      { property: "og:description", content: "Review your order before checkout." },
      { property: "og:url", content: "https://sweet-n-lovely-pizza.lovable.app/cart" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://sweet-n-lovely-pizza.lovable.app/cart" }],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, subtotal, setQuantity, removeItem } = useCart();
  const [promo, setPromo] = React.useState("");
  const [discount, setDiscount] = React.useState(0);
  const { selected: zone } = useZone();
  const freeThreshold = zone?.free_delivery_threshold_zar ?? 0;
  const qualifiesForFree =
    !!zone && freeThreshold > 0 && subtotal >= freeThreshold;
  const zoneFee = zone ? (qualifiesForFree ? 0 : zone.fee_zar) : undefined;
  const { shipping, tax, total, discounted } = computeTotals(
    subtotal,
    discount,
    zoneFee,
  );

  const applyPromo = () => {
    const code = promo.trim().toUpperCase();
    if (!code) return;
    if (code === "PEPPER10") {
      const d = subtotal * 0.1;
      setDiscount(d);
      toast.success(`Promo applied — ${formatPrice(d)} off`);
    } else if (code === "FREESHIP") {
      toast.success("Free delivery unlocked");
      setDiscount(0);
    } else {
      toast.error("Invalid promo code");
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Your Cart</h1>
          <p className="mt-3 text-neutral-600">
            {items.length === 0
              ? "Nothing here yet — let's fix that."
              : `${items.length} item${items.length === 1 ? "" : "s"} ready to go.`}
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
            {/* Items */}
            <section>
              <ul className="divide-y divide-neutral-100 rounded-3xl border border-neutral-100 bg-white shadow-[0_2px_24px_-12px_rgba(0,0,0,0.08)]">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
                    >
                      <div className="h-28 w-full overflow-hidden rounded-2xl bg-[#fff5f7] sm:h-24 sm:w-24 sm:shrink-0">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold">{item.title}</h3>
                        {item.variation && (
                          <p className="mt-0.5 text-xs text-neutral-500">{item.variation}</p>
                        )}
                        <p className="mt-1 text-sm text-neutral-600">
                          {formatPrice(item.price)} each
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                        <QtyControl
                          value={item.quantity}
                          onChange={(q) => setQuantity(item.id, q)}
                        />
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.title}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-[#ff003c]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              <div className="mt-6 text-sm">
                <Link
                  to="/menu/full-menu"
                  className="font-medium text-neutral-600 underline-offset-4 hover:text-[#ff003c] hover:underline"
                >
                  ← Continue shopping
                </Link>
              </div>
            </section>

            {/* Summary */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-neutral-100 bg-gradient-to-b from-white to-[#fffafb] p-6 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.15)]">
                <h2 className="text-lg font-bold">Order summary</h2>

                {/* Promo */}
                <div className="mt-5">
                  <label htmlFor="promo" className="text-xs font-medium text-neutral-600">
                    Promo code
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      <input
                        id="promo"
                        value={promo}
                        onChange={(e) => setPromo(e.target.value)}
                        placeholder="Try PEPPER10"
                        className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-neutral-400 focus:border-[#ff003c] focus:outline-none focus:ring-2 focus:ring-[#ff003c]/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={applyPromo}
                      className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                <dl className="mt-6 space-y-2.5 text-sm">
                  <SummaryRow label="Subtotal" value={formatPrice(subtotal)} />
                  {discount > 0 && (
                    <SummaryRow
                      label="Discount"
                      value={`-${formatPrice(discount)}`}
                      tone="success"
                    />
                  )}
                  <SummaryRow
                    label="Delivery"
                    value={shipping === 0 ? "Free" : formatPrice(shipping)}
                  />
                  <SummaryRow label="VAT (est.)" value={formatPrice(tax)} muted />
                </dl>

                {zone && freeThreshold > 0 && !qualifiesForFree && (
                  <p className="mt-4 rounded-2xl bg-[#fff5f7] px-4 py-3 text-xs text-neutral-600">
                    Spend {formatPrice(freeThreshold - subtotal)} more for{" "}
                    <span className="font-semibold text-[#ff003c]">free delivery</span> to {zone.name}.
                  </p>
                )}
                {qualifiesForFree && (
                  <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
                    🎉 You've unlocked free delivery to {zone.name}.
                  </p>
                )}

                <div className="mt-5 flex items-center justify-between border-t border-dashed border-neutral-200 pt-5">
                  <span className="text-sm font-medium text-neutral-600">Total</span>
                  <span className="text-2xl font-extrabold tracking-tight">
                    {formatPrice(total)}
                  </span>
                </div>

                <Link
                  to="/checkout"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ff003c] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a]"
                >
                  Proceed to checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "success";
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-neutral-500" : "text-neutral-600"}>{label}</dt>
      <dd
        className={
          tone === "success"
            ? "font-semibold text-emerald-600"
            : "font-medium text-neutral-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-neutral-100 bg-white p-12 text-center shadow-[0_10px_40px_-20px_rgba(0,0,0,0.1)]">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#fff5f7] text-[#ff003c]"
      >
        <ShoppingBag className="h-10 w-10" />
      </motion.div>
      <h2 className="mt-6 text-xl font-bold">Your cart is empty</h2>
      <p className="mt-2 text-sm text-neutral-500">
        Find something delicious to fill it up.
      </p>
      <Link
        to="/menu/full-menu"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[#ff003c] px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
      >
        Browse the menu
      </Link>
    </div>
  );
}