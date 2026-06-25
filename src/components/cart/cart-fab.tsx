import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";

/** Floating cart button — bottom-right, with animated item-count badge. */
export function CartFab() {
  const { count, open } = useCart();
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Open cart (${count} item${count === 1 ? "" : "s"})`}
      className="fixed bottom-[88px] right-4 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#ff003c] text-white shadow-[0_10px_30px_-8px_rgba(255,0,60,0.55)] transition-transform hover:scale-105 active:scale-95 md:right-8 md:bottom-8 md:flex"
    >
      <ShoppingBag className="h-6 w-6" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-neutral-900 px-1.5 text-[11px] font-bold leading-none text-white"
          >
            {count > 99 ? "99+" : count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}