import { AnimatePresence, motion } from "framer-motion";
import { Plus, Check, X, Pizza } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { useCart, parsePrice, formatPrice, type CartItem } from "@/lib/cart-context";

export const PIZZA_SIZE_DEFAULTS = {
  medium: 80,
  large: 150,
} as const;

type SizeId = "medium" | "large";
const SIZE_META: Array<{ id: SizeId; label: string; diameter: string; desc: string; scale: string }> = [
  { id: "medium", label: "Medium", diameter: '10"', desc: "Perfect for one", scale: "h-16 w-16 sm:h-20 sm:w-20" },
  { id: "large", label: "Large", diameter: '14"', desc: "Great for sharing", scale: "h-24 w-24 sm:h-28 sm:w-28" },
];

interface Props {
  item: {
    id: string;
    title: string;
    price: string | number;
    image?: string;
    variation?: string;
    priceMedium?: number;
    priceLarge?: number;
  };
  className?: string;
  label?: string;
  /** If true, opens a Medium/Large size picker (R80 / R150) before adding. */
  isPizza?: boolean;
}

/** Compact "Add" pill — opens a size picker for pizzas, otherwise adds directly. */
export function AddToCartButton({ item, className = "", label = "Add", isPizza = false }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SizeId>("medium");

  const sizePrices: Record<SizeId, number> = {
    medium: item.priceMedium ?? PIZZA_SIZE_DEFAULTS.medium,
    large: item.priceLarge ?? PIZZA_SIZE_DEFAULTS.large,
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const flashAdded = () => {
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  const handleAddDirect = () => {
    addItem(
      {
        id: item.id,
        title: item.title,
        price: parsePrice(item.price),
        image: item.image,
        variation: item.variation,
      } satisfies Omit<CartItem, "quantity">,
      1,
    );
    flashAdded();
  };

  const handlePickSize = (size: { id: SizeId; label: string }) => {
    addItem(
      {
        id: `${item.id}-${size.id}`,
        title: item.title,
        price: sizePrices[size.id],
        image: item.image,
        variation: `${size.label} pizza`,
      } satisfies Omit<CartItem, "quantity">,
      1,
    );
    setOpen(false);
    flashAdded();
  };

  const onClick = () => {
    if (isPizza) setOpen((v) => !v);
    else handleAddDirect();
  };

  return (
    <div className="relative inline-block">
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.95 }}
        aria-haspopup={isPizza ? "menu" : undefined}
        aria-expanded={isPizza ? open : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_-10px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a] ${className}`}
      >
        {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {added ? "Added" : label}
      </motion.button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && isPizza && (
              <motion.div
                key="size-picker-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
                onClick={() => setOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-label="Choose pizza size"
              >
                <motion.div
                  initial={{ y: 40, opacity: 0, scale: 0.98 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 40, opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", damping: 26, stiffness: 280 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.35)] sm:rounded-3xl sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]"
                >
                  {/* Mobile grab handle */}
                  <div className="flex justify-center pt-2 sm:hidden">
                    <span className="h-1.5 w-10 rounded-full bg-neutral-200" />
                  </div>

                  {/* Header */}
                  <div className="relative px-6 pb-4 pt-5 sm:pt-6">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                      className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff003c]">
                      <Pizza className="h-3.5 w-3.5" />
                      Choose your size
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 pr-10 text-lg font-bold text-neutral-900 sm:text-xl">
                      {item.title}
                    </h3>
                  </div>

                  {/* Size cards */}
                  <div className="grid grid-cols-2 gap-3 px-6">
                    {SIZE_META.map((s) => {
                      const isActive = selected === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelected(s.id)}
                          className={`group relative flex flex-col items-center rounded-2xl border-2 px-3 py-4 text-center transition-all ${
                            isActive
                              ? "border-[#ff003c] bg-[#fff5f7] shadow-[0_10px_24px_-12px_rgba(255,0,60,0.45)]"
                              : "border-neutral-200 bg-white hover:border-neutral-300"
                          }`}
                        >
                          {isActive && (
                            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff003c] text-white">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          )}
                          <div className="flex h-28 items-end justify-center">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={`${item.title} — ${s.label}`}
                                loading="lazy"
                                className={`${s.scale} rounded-full object-cover shadow-inner transition-transform ${
                                  isActive ? "scale-105" : "opacity-80 group-hover:opacity-100"
                                }`}
                              />
                            ) : (
                              <div
                                className={`${s.scale} rounded-full bg-gradient-to-br from-[#ffb199] to-[#ff003c] shadow-inner transition-transform ${
                                  isActive ? "scale-105" : "opacity-80 group-hover:opacity-100"
                                }`}
                              />
                            )}
                          </div>
                          <span className="mt-2 text-sm font-bold text-neutral-900">
                            {s.label}
                          </span>
                          <span className="text-[11px] text-neutral-500">{s.diameter} · {s.desc}</span>
                          <span className="mt-1 text-sm font-extrabold text-[#ff003c]">
                            {formatPrice(sizePrices[s.id])}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* CTA */}
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                        Total
                      </span>
                      <span className="text-lg font-extrabold text-neutral-900">
                        {formatPrice(sizePrices[selected])}
                      </span>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() =>
                        handlePickSize(SIZE_META.find((p) => p.id === selected)!)
                      }
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff003c] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-12px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a]"
                    >
                      <Plus className="h-4 w-4" />
                      Add to cart
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}