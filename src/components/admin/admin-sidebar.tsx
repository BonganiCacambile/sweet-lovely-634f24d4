import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, BarChart3, Users, ShoppingBag, Package, FileText,
  Tags, Boxes, Star, Bell, FileBarChart2, ShieldCheck, Lock, ScrollText,
  Plug, Settings, UserCircle2, LogOut, X, MapPin,
} from "lucide-react";
import { BrandMark } from "./brand-mark";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "@tanstack/react-router";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; mainOnly?: boolean };

const SECTIONS: Array<{ heading: string; items: Item[] }> = [
  {
    heading: "Main",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/users", label: "Users", icon: Users, mainOnly: true },
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { to: "/admin/products", label: "Products", icon: Package, mainOnly: true },
      { to: "/admin/content", label: "Content", icon: FileText, mainOnly: true },
    ],
  },
  {
    heading: "Management",
    items: [
      { to: "/admin/categories", label: "Categories", icon: Tags, mainOnly: true },
      { to: "/admin/inventory", label: "Inventory", icon: Boxes },
      { to: "/admin/delivery-zones", label: "Delivery Zones", icon: MapPin },
      { to: "/admin/reviews", label: "Reviews", icon: Star, mainOnly: true },
      { to: "/admin/notifications", label: "Notifications", icon: Bell, mainOnly: true },
      { to: "/admin/reports", label: "Reports", icon: FileBarChart2, mainOnly: true },
    ],
  },
  {
    heading: "Administration",
    items: [
      { to: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, mainOnly: true },
      { to: "/admin/security", label: "Security Center", icon: Lock, mainOnly: true },
      { to: "/admin/audit", label: "Audit Logs", icon: ScrollText, mainOnly: true },
      { to: "/admin/integrations", label: "Integrations", icon: Plug, mainOnly: true },
      { to: "/admin/settings", label: "System Settings", icon: Settings, mainOnly: true },
    ],
  },
  {
    heading: "Account",
    items: [
      { to: "/admin/profile", label: "Profile", icon: UserCircle2 },
    ],
  },
];

export function AdminSidebar({
  collapsed,
  onCloseMobile,
  mobile,
}: {
  collapsed?: boolean;
  onCloseMobile?: () => void;
  mobile?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, isMainAdmin, assignedZoneName } = useAuth();
  const router = useRouter();

  const onSignOut = async () => {
    await signOut();
    router.navigate({ to: "/auth/admin" });
  };

  return (
    <aside
      className={
        "flex h-full flex-col border-r border-neutral-200/70 bg-white/80 backdrop-blur-xl " +
        (mobile ? "w-[78%] max-w-[300px]" : collapsed ? "w-[78px]" : "w-[260px]")
      }
    >
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && <BrandMark size={28} />}
        {collapsed && (
          <div
            className="mx-auto h-9 w-9 rounded-2xl"
            style={{ background: "linear-gradient(135deg,#ff003c,#ff7a45)" }}
            aria-label="Sweet & Lovely"
          />
        )}
        {mobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {!collapsed && !isMainAdmin && assignedZoneName && (
          <div className="mx-2 mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
            Zone Admin · {assignedZoneName}
          </div>
        )}
        {SECTIONS.map((section) => (
          <SidebarSection key={section.heading} section={section} collapsed={collapsed} pathname={pathname} onClose={onCloseMobile} isMain={isMainAdmin} />
        ))}
      </nav>

      <div className="border-t border-neutral-200/70 p-3">
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}

function SidebarSection({
  section, collapsed, pathname, onClose, isMain,
}: {
  section: { heading: string; items: Item[] };
  collapsed?: boolean;
  pathname: string;
  onClose?: () => void;
  isMain: boolean;
}) {
  const items = section.items.filter((i) => isMain || !i.mainOnly);
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                {section.heading}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.to === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={
                        "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors " +
                        (active
                          ? "bg-[#fff0f3] text-[#ff003c]"
                          : "text-neutral-700 hover:bg-neutral-100")
                      }
                    >
                      <Icon className="h-4 w-4 flex-none" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {active && !collapsed && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ff003c]" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
  );
}