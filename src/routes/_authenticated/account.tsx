import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { getAccountOverview } from "@/lib/account/account.functions";
import { formatPrice } from "@/lib/cart-context";
import {
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Star,
  ShoppingBag,
  Bell,
  ArrowRight,
  Loader2,
  TrendingUp,
  Clock,
  Settings as SettingsIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Your account — Sweet & Lovely" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user, profile } = useAuth();
  const verified = Boolean(user?.email_confirmed_at);

  const fetchOverview = useServerFn(getAccountOverview);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["account-overview"],
    queryFn: () => fetchOverview(),
  });

  useRealtimeInvalidate(
    ["orders", "order_items", "notifications", "loyalty_accounts", "user_addresses", "profiles"],
    [["account-overview"]],
  );

  if (isLoading) {
    return (
      <AccountShell title="Overview">
        <Card>
          <div className="flex items-center justify-center py-10 text-neutral-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your account…
          </div>
        </Card>
      </AccountShell>
    );
  }

  if (isError || !data) {
    return (
      <AccountShell title="Overview">
        <Card>
          <p className="text-sm text-neutral-600">We couldn't load your account right now.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Try again
          </button>
        </Card>
      </AccountShell>
    );
  }

  const { stats, loyalty, addresses, recentOrders, recentNotifications, unreadNotifications, profileCompletion } = data;

  return (
    <AccountShell title="Overview">
      <div className="space-y-6">
        {/* Welcome */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500">Welcome back</p>
              <h2 className="mt-1 text-xl font-extrabold text-neutral-900">
                {profile?.full_name?.split(" ")[0] || "Hello"} 👋
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {user?.email} · joined {profile && (profile as any).created_at
                  ? new Date((profile as any).created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                  : "—"}
              </p>
            </div>
            <div className="w-full sm:w-64">
              <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
                <span>Profile completion</span>
                <span className="font-semibold text-neutral-700">{profileCompletion}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${profileCompletion}%`,
                    background: "linear-gradient(135deg,#ff003c,#ff5a36)",
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={ShoppingBag} label="Total orders" value={String(stats.totalOrders)} />
          <StatTile icon={Clock} label="In progress" value={String(stats.pending)} />
          <StatTile icon={CheckCircle2} label="Delivered" value={String(stats.completed)} />
          <StatTile icon={TrendingUp} label="Total spent" value={formatPrice(stats.totalSpent)} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Recent orders */}
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">Recent orders</p>
              <Link to="/account/orders" className="text-xs font-semibold text-[#ff003c]">
                See all →
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <EmptyMini icon={ShoppingBag} text="No orders yet" cta={{ to: "/menu/full-menu", label: "Browse menu" }} />
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100 text-sm">
                {recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2">
                    <Link
                      to="/account/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="min-w-0 truncate font-medium text-neutral-800 hover:text-[#ff003c]"
                    >
                      #{o.order_number}
                    </Link>
                    <span className="text-xs capitalize text-neutral-500">
                      {String(o.status).replaceAll("_", " ")}
                    </span>
                    <span className="font-semibold text-neutral-900">{formatPrice(Number(o.total_zar))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Notifications */}
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">
                Notifications
                {unreadNotifications > 0 && (
                  <span className="ml-2 rounded-full bg-[#fff0f3] px-2 py-0.5 text-[10px] font-semibold text-[#ff003c]">
                    {unreadNotifications} new
                  </span>
                )}
              </p>
              <Link to="/account/notifications" className="text-xs font-semibold text-[#ff003c]">
                See all →
              </Link>
            </div>
            {recentNotifications.length === 0 ? (
              <EmptyMini icon={Bell} text="You're all caught up" />
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {recentNotifications.map((n) => (
                  <li
                    key={n.id}
                    className={
                      "rounded-xl border px-3 py-2 " +
                      (n.read ? "border-neutral-100 bg-white" : "border-[#ffd6e0] bg-[#fff8fa]")
                    }
                  >
                    <p className="text-sm font-medium text-neutral-900">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Loyalty */}
          <Card>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0f3] text-[#ff003c]">
                <Star className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-900">
                  {loyalty.points_balance} Sweet & Lovely points
                </p>
                <p className="mt-0.5 text-xs capitalize text-neutral-500">
                  Tier: {loyalty.tier} · {loyalty.lifetime_points} lifetime
                </p>
              </div>
            </div>
          </Card>

          {/* Addresses */}
          <Card>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0f3] text-[#ff003c]">
                <MapPin className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-900">
                  {addresses.length === 0 ? "No saved addresses" : `${addresses.length} saved address${addresses.length === 1 ? "" : "es"}`}
                </p>
                <Link to="/account/addresses" className="mt-1 inline-flex items-center text-xs font-semibold text-[#ff003c]">
                  Manage <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </div>
            </div>
          </Card>
        </div>

        {/* Status & quick actions */}
        <Card>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Status</p>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Status ok={verified} label={verified ? "Email verified" : "Email not verified"} />
            <Status ok={true} label="Account in good standing" />
            <Status ok={addresses.length > 0} label={addresses.length > 0 ? "Address on file" : "Add a delivery address"} />
            <Status ok={profileCompletion === 100} label={profileCompletion === 100 ? "Profile complete" : "Complete your profile"} />
          </ul>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Quick actions</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickAction to="/menu/full-menu" icon={ShoppingBag} label="Order again" />
            <QuickAction to="/account/security" icon={ShieldCheck} label="Security" />
            <QuickAction to="/account/addresses" icon={MapPin} label="Addresses" />
            <QuickAction to="/account/preferences" icon={SettingsIcon} label="Preferences" />
          </div>
        </Card>
      </div>
    </AccountShell>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <Icon className="h-4 w-4 text-[#ff003c]" />
      <p className="mt-2 text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold text-neutral-900">{value}</p>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200 bg-white px-3 py-4 text-center text-xs font-semibold text-neutral-800 hover:border-[#ff003c] hover:text-[#ff003c]"
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className={"h-4 w-4 " + (ok ? "text-emerald-500" : "text-neutral-300")} />
      <span className={ok ? "text-neutral-800" : "text-neutral-500"}>{label}</span>
    </li>
  );
}

function EmptyMini({
  icon: Icon,
  text,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 px-3 py-6 text-center">
      <Icon className="h-5 w-5 text-neutral-400" />
      <p className="mt-2 text-sm text-neutral-600">{text}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#ff003c] px-3 py-1.5 text-[11px] font-semibold text-white"
        >
          {cta.label} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}