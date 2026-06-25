import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UtensilsCrossed, MapPin, ShoppingBag, User } from "lucide-react";
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

  const items: Item[] = [
    { label: "Home", icon: Home, to: "/", match: (p) => p === "/" },
    { label: "Menu", icon: UtensilsCrossed, to: "/menu/full-menu", match: (p) => p.startsWith("/menu") },
    { label: "Cart", icon: ShoppingBag, onClick: open, badge: count, match: () => false },
    { label: "Places", icon: MapPin, to: "/locations", match: (p) => p.startsWith("/locations") },
    { label: "Account", icon: User, to: "/account", match: (p) => p.startsWith("/account") },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-2 mb-2 rounded-2xl border border-border/60 bg-background/85 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <ul className="grid grid-cols-5">
          {items.map((it) => {
            const active = it.match ? it.match(pathname) : false;
            const inner = (
              <span className="relative flex flex-col items-center justify-center gap-0.5 py-2.5">
                <span
                  className={`relative grid h-9 w-12 place-items-center rounded-xl transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <it.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                  <AnimatePresence>
                    {it.badge && it.badge > 0 ? (
                      <motion.span
                        key={it.badge}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff003c] px-1 text-[10px] font-bold leading-none text-white"
                      >
                        {it.badge > 9 ? "9+" : it.badge}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </span>
                <span
                  className={`text-[10px] font-medium leading-none ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {it.label}
                </span>
              </span>
            );
            return (
              <li key={it.label} className="contents">
                {it.to ? (
                  <Link to={it.to} aria-label={it.label} className="block min-h-[56px]">
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={it.onClick}
                    aria-label={it.label}
                    className="block min-h-[56px] w-full"
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}