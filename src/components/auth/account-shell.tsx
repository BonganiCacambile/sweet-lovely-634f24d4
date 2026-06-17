import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, User as UserIcon, ShieldCheck, Bell, Settings, ShoppingBag, LayoutDashboard, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

const NAV = [
  { to: "/account", label: "Overview", icon: UserIcon },
  { to: "/account/security", label: "Security", icon: ShieldCheck },
  { to: "/account/orders", label: "Orders", icon: ShoppingBag },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
  { to: "/account/preferences", label: "Preferences", icon: Settings },
] as const;

export function AccountShell({ children, title }: { children: ReactNode; title: string }) {
  const { profile, user, isAdmin, signOut } = useAuth();
  const router = useRouter();

  const onSignOut = async () => {
    await signOut();
    router.navigate({ to: "/auth" });
  };

  const initials =
    (profile?.full_name || user?.email || "U")
      .split(/\s|@/)[0]
      .slice(0, 2)
      .toUpperCase();

  const currentPath = router.state.location.pathname;

  return (
    <main className="min-h-dvh bg-[#fafafa]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center">
            <span
              style={{
                fontFamily: '"Cherry Bomb One", sans-serif',
                color: "rgb(255, 0, 60)",
                fontSize: "22px",
                lineHeight: 1,
              }}
            >
              Sweet &amp; Lovely
            </span>
          </Link>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-base font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {profile?.full_name || "Sweet & Lovely member"}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{user?.email}</p>
                </div>
              </div>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" /> Admin dashboard
                </Link>
              )}
            </motion.div>

            <nav className="rounded-3xl border border-neutral-200 bg-white p-2 shadow-sm">
              {NAV.map((item) => {
                const active = currentPath === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={
                      "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors " +
                      (active
                        ? "bg-[#fff0f3] text-[#ff003c]"
                        : "text-neutral-700 hover:bg-neutral-50")
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">
                {title}
              </h1>
              {children}
            </motion.div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={"rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm " + className}>
      {children}
    </div>
  );
}