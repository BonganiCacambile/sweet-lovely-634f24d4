import { AnimatePresence, motion } from "framer-motion";
import { Plus, Check, X, Pizza, Sparkles, ChevronLeft, Loader2 } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { useCart, parsePrice, formatPrice, type CartItem, type CartExtra } from "@/lib/cart-context";
import { usePizzaToppings, type PizzaTopping } from "@/hooks/use-pizza-toppings";
import type { ProductSize } from "@/components/product-grid";

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
  /** Dynamic sizes (e.g. BBQ). When provided (non-empty), opens a size picker without toppings. */
  sizes?: ProductSize[];
}

/** Compact "Add" pill — opens a size picker for pizzas, otherwise adds directly. */
export function AddToCartButton({ item, className = "", label = "Add", isPizza = false, sizes }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SizeId>("medium");
  const [step, setStep] = React.useState<"size" | "toppings">("size");
  const [selectedExtras, setSelectedExtras] = React.useState<Set<string>>(new Set());
  const toppingsQuery = usePizzaToppings();
  const toppings = toppingsQuery.data ?? [];

  const hasSizes = !isPizza && Array.isArray(sizes) && sizes.length > 0;
  const sortedSizes = React.useMemo(
    () => (hasSizes ? [...(sizes as ProductSize[])] : []),
    [hasSizes, sizes],
  );
  const [selectedSizeId, setSelectedSizeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (hasSizes && !selectedSizeId) {
      setSelectedSizeId(sortedSizes[0]?.id ?? null);
    }
  }, [hasSizes, sortedSizes, selectedSizeId]);

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

  React.useEffect(() => {
    if (!open) {
      setStep("size");
      setSelectedExtras(new Set());
    }
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

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickedExtras: CartExtra[] = React.useMemo(() => {
    return toppings
      .filter((t) => selectedExtras.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, price: Number(t.price_zar) }));
  }, [toppings, selectedExtras]);

  const extrasTotal = pickedExtras.reduce((s, e) => s + e.price, 0);
  const size = SIZE_META.find((p) => p.id === selected)!;
  const basePrice = sizePrices[selected];
  const totalPrice = basePrice + extrasTotal;

  const commitAdd = () => {
    const extrasKey =
      pickedExtras.length > 0
        ? "-x-" + [...pickedExtras].map((e) => e.id.slice(0, 8)).sort().join("-")
        : "";
    const variationText =
      pickedExtras.length > 0
        ? `${size.label} pizza + ${pickedExtras.map((e) => e.name).join(", ")}`
        : `${size.label} pizza`;
    addItem(
      {
        id: `${item.id}-${selected}${extrasKey}`,
        title: item.title,
        price: totalPrice,
        basePrice,
        extras: pickedExtras,
        image: item.image,
        variation: variationText,
      } satisfies Omit<CartItem, "quantity">,
      1,
    );
    setOpen(false);
    flashAdded();
  };

  const onClick = () => {
    if (isPizza || hasSizes) setOpen((v) => !v);
    else handleAddDirect();
  };

  const pickedSize = sortedSizes.find((s) => s.id === selectedSizeId) ?? sortedSizes[0];
  const sizedTotal = pickedSize ? Number(pickedSize.price_zar) : 0;
  const commitSized = () => {
    if (!pickedSize) return;
    addItem(
      {
        id: `${item.id}--sz-${pickedSize.id}`,
        title: item.title,
        price: sizedTotal,
        basePrice: sizedTotal,
        image: item.image,
        variation: pickedSize.name,
      } satisfies Omit<CartItem, "quantity">,
      1,
    );
    setOpen(false);
    flashAdded();
  };

  return (
    <div className="relative inline-block">
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.95 }}
        aria-haspopup={isPizza || hasSizes ? "menu" : undefined}
        aria-expanded={isPizza || hasSizes ? open : undefined}
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
                aria-label="Customize your pizza"
              >
                <motion.div
                  initial={{ y: 40, opacity: 0, scale: 0.98 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 40, opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", damping: 26, stiffness: 280 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.35)] sm:rounded-3xl sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]"
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
                    {step === "toppings" && (
                      <button
                        type="button"
                        onClick={() => setStep("size")}
                        className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                        aria-label="Back to size"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    )}
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff003c]">
                      {step === "size" ? (
                        <>
                          <Pizza className="h-3.5 w-3.5" />
                          Step 1 · Choose your size
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Step 2 · Customize your pizza
                        </>
                      )}
                    </div>
                    {step === "size" ? (
                      <h3 className="mt-1.5 line-clamp-2 pr-10 text-lg font-bold text-neutral-900 sm:text-xl">
                        {item.title}
                      </h3>
                    ) : (
                      <>
                        <h3 className="mt-1.5 pr-10 text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
                          🍕 Customize Your Pizza
                        </h3>
                        <p className="mt-1 text-sm text-neutral-500">
                          Make it your own by adding delicious extra toppings.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto">
                    {step === "size" ? (
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
                    ) : (
                      <ToppingPicker
                        loading={toppingsQuery.isLoading}
                        toppings={toppings}
                        selected={selectedExtras}
                        onToggle={toggleExtra}
                      />
                    )}
                  </div>

                  {/* Selected extras summary (toppings step) */}
                  {step === "toppings" && pickedExtras.length > 0 && (
                    <div className="border-t border-neutral-100 bg-[#fff9fa] px-6 py-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#ff003c]">
                        <span>Selected extras</span>
                        <span>+{formatPrice(extrasTotal)}</span>
                      </div>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {pickedExtras.map((e) => (
                          <li
                            key={e.id}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 shadow-sm ring-1 ring-neutral-200"
                          >
                            <Check className="h-3 w-3 text-[#ff003c]" strokeWidth={3} />
                            {e.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                        {step === "toppings" && pickedExtras.length > 0 ? "Pizza total" : "Total"}
                      </span>
                      <span className="text-lg font-extrabold text-neutral-900">
                        {formatPrice(totalPrice)}
                      </span>
                      {step === "toppings" && pickedExtras.length > 0 && (
                        <span className="text-[11px] text-neutral-500">
                          {formatPrice(basePrice)} base + {formatPrice(extrasTotal)} extras
                        </span>
                      )}
                    </div>
                    {step === "size" ? (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setStep("toppings")}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff003c] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-12px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a]"
                      >
                        <Sparkles className="h-4 w-4" />
                        Add toppings
                      </motion.button>
                    ) : (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={commitAdd}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff003c] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-12px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a]"
                      >
                        <Plus className="h-4 w-4" />
                        Add to cart · {formatPrice(totalPrice)}
                      </motion.button>
                    )}
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

function ToppingPicker({
  loading,
  toppings,
  selected,
  onToggle,
}: {
  loading: boolean;
  toppings: PizzaTopping[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading toppings…
      </div>
    );
  }
  if (toppings.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-neutral-500">
        No extra toppings available right now.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 px-6 pb-2 sm:grid-cols-3">
      {toppings.map((t) => {
        const isSelected = selected.has(t.id);
        const disabled = !t.is_available;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(t.id)}
            className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-all ${
              disabled
                ? "cursor-not-allowed border-neutral-100 bg-neutral-50 opacity-60"
                : isSelected
                  ? "border-[#ff003c] bg-[#fff5f7] shadow-[0_10px_22px_-12px_rgba(255,0,60,0.45)] scale-[1.02]"
                  : "border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm"
            }`}
          >
            {isSelected && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 300 }}
                className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#ff003c] text-white shadow"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </motion.span>
            )}
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#fff5f7] to-[#ffe4e8] ring-1 ring-inset ring-neutral-100">
              {t.image_url ? (
                <img
                  src={t.image_url}
                  alt={t.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl">🧀</span>
              )}
            </div>
            <span className="mt-0.5 text-[13px] font-bold leading-tight text-neutral-900">
              {t.name}
            </span>
            <span className="text-[11px] font-semibold text-[#ff003c]">
              +{formatPrice(Number(t.price_zar))}
            </span>
            {disabled && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                Unavailable
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}