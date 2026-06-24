import NavFramerComponent from "@/framer/top-nav/nav";
import { HeaderAccountMenu } from "@/components/auth/header-account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";

/** Top navigation rendered with the Framer-exported Nav (all variants/animations preserved). */
export function SiteHeader() {
  return (
    <header className="relative w-full">
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
    </header>
  );
}