import { motion } from "framer-motion";
import { Plus, Check } from "lucide-react";
import * as React from "react";
import { useCart, parsePrice, type CartItem } from "@/lib/cart-context";

interface Props {
  item: { id: string; title: string; price: string | number; image?: string; variation?: string };
  className?: string;
  label?: string;
}

/** Compact "Add to cart" pill — drop in next to any product. */
export function AddToCartButton({ item, className = "", label = "Add" }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = React.useState(false);

  const handleAdd = () => {
    const payload: Omit<CartItem, "quantity"> = {
      id: item.id,
      title: item.title,
      price: parsePrice(item.price),
      image: item.image,
      variation: item.variation,
    };
    addItem(payload, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  return (
    <motion.button
      type="button"
      onClick={handleAdd}
      whileTap={{ scale: 0.95 }}
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_-10px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a] ${className}`}
    >
      {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      {added ? "Added" : label}
    </motion.button>
  );
}