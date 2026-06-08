import { Bell, Menu, Search, PanelLeftClose, PanelLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function AdminTopbar({
  onOpenMobile,
  onToggleCollapse,
  collapsed,
  onOpenSearch,
}: {
  onOpenMobile: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  onOpenSearch: () => void;
}) {
  const { user, profile } = useAuth();
  const initials = (profile?.full_name || user?.email || "A")
    .split(/\s|@/)[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-neutral-200/70 bg-white/80 px-3 backdrop-blur-xl sm:px-6">
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Open menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-neutral-600 hover:bg-neutral-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-10 w-10 items-center justify-center rounded-2xl text-neutral-500 hover:bg-neutral-100 lg:inline-flex"
      >
        {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="ml-1 inline-flex h-10 flex-1 max-w-md items-center gap-2 rounded-2xl border border-neutral-200 bg-white/70 px-3 text-left text-sm text-neutral-500 hover:bg-white"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Search anything…</span>
        <span className="ml-auto hidden items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 sm:inline-flex">
          <kbd className="font-sans">⌘</kbd>
          <kbd className="font-sans">K</kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl text-neutral-600 hover:bg-neutral-100"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#ff003c]" />
        </button>
        <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white/70 py-1 pl-1 pr-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#ff003c,#ff7a45)" }}
          >
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight text-neutral-900">
              {profile?.full_name || "Administrator"}
            </p>
            <p className="text-[11px] leading-tight text-neutral-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}