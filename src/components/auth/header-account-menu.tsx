import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { User as UserIcon, LogOut, ShoppingBag, Shield, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function HeaderAccountMenu() {
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <Link
        to="/auth"
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_8px_20px_-8px_rgba(255,0,60,0.6)] transition hover:scale-[1.03] sm:px-4 sm:py-2 sm:text-sm"
      >
        <UserIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Sign in
      </Link>
    );
  }

  const name = profile?.full_name || user.email?.split("@")[0] || "Account";
  const initial = (name[0] || "U").toUpperCase();

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/90 px-1.5 py-1 text-xs font-medium text-neutral-800 shadow-sm backdrop-blur transition hover:bg-white sm:gap-2 sm:px-2 sm:py-1.5 sm:text-sm"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#ff003c] to-[#ff5a36] text-[11px] font-semibold text-white sm:h-8 sm:w-8 sm:text-xs">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">{name}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-neutral-500 sm:inline" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
        >
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
            <p className="truncate text-xs text-neutral-500">{user.email}</p>
          </div>
          <div className="py-1 text-sm">
            <MenuItem to="/account" icon={<UserIcon className="h-4 w-4" />} onClick={() => setOpen(false)}>
              My account
            </MenuItem>
            <MenuItem to="/account/orders" icon={<ShoppingBag className="h-4 w-4" />} onClick={() => setOpen(false)}>
              Orders
            </MenuItem>
            {isAdmin ? (
              <MenuItem to="/admin" icon={<Shield className="h-4 w-4" />} onClick={() => setOpen(false)}>
                Admin
              </MenuItem>
            ) : null}
          </div>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            className="flex w-full items-center gap-2 border-t border-neutral-100 px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  to,
  icon,
  children,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 text-neutral-700 hover:bg-neutral-50"
      role="menuitem"
    >
      {icon}
      {children}
    </Link>
  );
}