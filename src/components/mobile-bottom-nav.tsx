import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UtensilsCrossed, MapPin, ShoppingBag, User, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/lib/cart-context";

const HIDE_PREFIXES = ["/admin", "/auth", "/loading", "/checkout"];

type Item = {
  label: string;
  icon: typeof Home;
  to?: string;
  match?: (p: string) => boolean;
  onClick?: () => void;
  badge?: number;
};

/**
 * Mobile-only bottom navigation. Persistent, thumb-reach, safe-area aware.
 * Hidden on admin/auth/checkout/loading routes and on md+ viewports.
 */
export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count, open } = useCart();

  if (HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p))) {
    return null;
  }

  const left: Item[] = [
    { label: "Home", icon: Home, to: "/", match: (p) => p === "/" },
    { label: "Account", icon: User, to: "/account", match: (p) => p.startsWith("/account") },
  ];
  const right: Item[] = [
    { label: "Menu", icon: UtensilsCrossed, to: "/menu/full-menu", match: (p) => p.startsWith("/menu") },
    { label: "Places", icon: MapPin, to: "/locations", match: (p) => p.startsWith("/locations") },
  ];

  const renderItem = (it: Item) => {
    const active = it.match ? it.match(pathname) : false;
    const inner = (
      <span className="relative grid h-12 w-12 place-items-center rounded-xl transition-colors">
        <it.icon
          className="h-6 w-6 text-primary-foreground"
          strokeWidth={active ? 2.6 : 2}
          fill={active ? "currentColor" : "none"}
        />
        {active ? (
          <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary-foreground" />
        ) : null}
      </span>
    );
    return (
      <li key={it.label} className="flex-1">
        {it.to ? (
          <Link to={it.to} aria-label={it.label} className="flex items-center justify-center">
            {inner}
          </Link>
        ) : (
          <button
            type="button"
            onClick={it.onClick}
            aria-label={it.label}
            className="flex w-full items-center justify-center"
          >
            {inner}
          </button>
        )}
      </li>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-3 mb-3">
        {/* Floating center action (Cart) */}
        <button
          type="button"
          onClick={open}
          aria-label="Cart"
          className="absolute left-1/2 -top-6 z-10 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_28px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] ring-4 ring-background transition-transform active:scale-95"
        >
          <Plus className="h-7 w-7" strokeWidth={2.6} />
          <AnimatePresence>
            {count > 0 ? (
              <motion.span
                key={count}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-[11px] font-bold leading-none text-primary shadow"
              >
                {count > 9 ? "9+" : count}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </button>

        <ul className="flex h-16 items-center rounded-3xl bg-primary px-4 shadow-[0_12px_30px_-12px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
          {left.map(renderItem)}
          <li className="w-16 shrink-0" aria-hidden />
          {right.map(renderItem)}
        </ul>
      </div>
    </nav>
  );
}