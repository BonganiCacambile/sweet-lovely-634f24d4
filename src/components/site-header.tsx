import { useEffect, useRef, useState } from "react";
import NavFramerComponent from "@/framer/top-nav/nav";
import { HeaderAccountMenu } from "@/components/auth/header-account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";

/**
 * Sticky top navigation. Stays visible while scrolling; on mobile it hides on
 * scroll-down and re-appears on scroll-up so it never blocks content but is
 * always one swipe away. Desktop keeps it permanently visible.
 */
export function SiteHeader() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastY.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        if (y < 64) setHidden(false);
        else if (dy > 6) setHidden(true);
        else if (dy < -6) setHidden(false);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-transform duration-300 ease-out will-change-transform ${
        hidden ? "-translate-y-full md:translate-y-0" : "translate-y-0"
      }`}
    >
      <div className="relative w-full bg-[#ff003c]/95 backdrop-blur supports-[backdrop-filter]:bg-[#ff003c]/85">
        <NavFramerComponent.Responsive
          variants={{
            base: "Mobile - Default",
            sm: "Mobile - Default",
            md: "Tablet",
            lg: "Desktop",
            xl: "Desktop",
            "2xl": "Desktop",
          }}
        />
        <div className="pointer-events-none absolute right-2 top-full z-40 mt-2 flex items-center justify-end gap-2 sm:right-4 md:right-6">
          <NotificationBell />
          <HeaderAccountMenu />
        </div>
      </div>
    </header>
  );
}