import { AnimatePresence, motion } from "framer-motion";
import { Plus, Check, X } from "lucide-react";
import * as React from "react";
import { useCart, parsePrice, formatPrice, type CartItem } from "@/lib/cart-context";

export const PIZZA_SIZES = [
  { id: "medium", label: "Medium", price: 80 },
  { id: "large", label: "Large", price: 150 },
] as const;

interface Props {
  item: { id: string; title: string; price: string | number; image?: string; variation?: string };
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
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
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

  const handlePickSize = (size: (typeof PIZZA_SIZES)[number]) => {
    addItem(
      {
        id: `${item.id}-${size.id}`,
        title: item.title,
        price: size.price,
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
    <div ref={wrapRef} className="relative inline-block">
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

      <AnimatePresence>
        {open && isPizza && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-neutral-100 bg-white p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-center justify-between px-2 pb-1 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Choose size
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {PIZZA_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                onClick={() => handlePickSize(s)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-900 transition-colors hover:bg-[#fff5f7] focus:bg-[#fff5f7] focus:outline-none"
              >
                <span>{s.label}</span>
                <span className="text-sm font-bold text-[#ff003c]">{formatPrice(s.price)}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}