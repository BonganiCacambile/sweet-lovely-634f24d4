import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import {
  useCart,
  formatPrice,
  computeTotals,
  FREE_SHIPPING_THRESHOLD,
} from "@/lib/cart-context";

export function CartDrawer() {
  const { isOpen, close, items, subtotal, setQuantity, removeItem } = useCart();
  const { shipping, tax, total } = computeTotals(subtotal);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            aria-hidden
          />

          {/* Panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff5f7] text-[#ff003c]">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Your Cart</h2>
                  <p className="text-xs text-neutral-500">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close cart"
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Free delivery progress */}
            {items.length > 0 && (
              <div className="border-b border-neutral-100 bg-[#fffafb] px-6 py-3">
                {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                  <p className="text-xs font-medium text-emerald-600">
                    🎉 You've unlocked free delivery!
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-neutral-600">
                      Add{" "}
                      <span className="font-semibold text-[#ff003c]">
                        {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)}
                      </span>{" "}
                      more for free delivery
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                        }}
                        transition={{ duration: 0.4 }}
                        className="h-full rounded-full bg-[#ff003c]"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <EmptyState onClose={close} />
              ) : (
                <ul className="divide-y divide-neutral-100 px-6">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.2 }}
                        className="flex gap-4 py-5"
                      >
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#fff5f7]">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold leading-tight text-neutral-900">
                                {item.title}
                              </h3>
                              {item.variation && (
                                <p className="mt-0.5 text-xs text-neutral-500">
                                  {item.variation}
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-semibold">
                              {formatPrice(item.price * item.quantity)}
                            </p>
                          </div>
                          <div className="mt-auto flex items-center justify-between pt-3">
                            <QtyControl
                              value={item.quantity}
                              onChange={(q) => setQuantity(item.id, q)}
                            />
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label={`Remove ${item.title}`}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-[#ff003c]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <footer className="border-t border-neutral-100 bg-white px-6 py-5">
                <dl className="space-y-1.5 text-sm">
                  <Row label="Subtotal" value={formatPrice(subtotal)} />
                  <Row
                    label="Delivery"
                    value={shipping === 0 ? "Free" : formatPrice(shipping)}
                  />
                  <Row label="Tax (est.)" value={formatPrice(tax)} muted />
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-dashed border-neutral-200 pt-3">
                  <span className="text-sm font-medium text-neutral-600">Total</span>
                  <span className="text-xl font-bold tracking-tight">
                    {formatPrice(total)}
                  </span>
                </div>
                <Link
                  to="/checkout"
                  onClick={close}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ff003c] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a] active:translate-y-0"
                >
                  Checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/cart"
                  onClick={close}
                  className="mt-2 block text-center text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
                >
                  View full cart
                </Link>
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-neutral-500" : "text-neutral-600"}>{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

export function QtyControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        aria-label="Decrease quantity"
        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <motion.span
        key={value}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="w-7 text-center text-sm font-semibold tabular-nums"
      >
        {value}
      </motion.span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-[#fff5f7] text-[#ff003c]"
      >
        <ShoppingBag className="h-10 w-10" />
      </motion.div>
      <h3 className="mt-6 text-lg font-semibold">Your cart is empty</h3>
      <p className="mt-2 max-w-xs text-sm text-neutral-500">
        Looks like you haven't added anything yet. Browse the menu and pick your favorites.
      </p>
      <Link
        to="/menu/full-menu"
        onClick={onClose}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[#ff003c] px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
      >
        Browse the menu
      </Link>
    </div>
  );
}