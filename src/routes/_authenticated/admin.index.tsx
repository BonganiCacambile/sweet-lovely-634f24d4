import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowUpRight, ShoppingBag, UserPlus, Activity, RefreshCw, Inbox, AlertCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/admin/kpi-card";
import { SectionCard } from "@/components/admin/section-card";
import { useAuth } from "@/lib/auth-context";
import { getDashboardStats, type DashboardStats } from "@/lib/admin-dashboard.functions";
import { Skeleton } from "@/components/ui/skeleton";

const DASHBOARD_QUERY_KEY = ["admin", "dashboard"] as const;

function dashboardQueryOptions(fetcher: () => Promise<DashboardStats>) {
  return queryOptions({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetcher,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: async () => {
    // Zone (employee) admins don't have access to the global dashboard.
    // Auto-load their primary workspace — the zone-scoped orders list.
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role, assigned_zone_id")
      .eq("user_id", user.id);
    const rows = (roleRows ?? []) as Array<{ role: string; assigned_zone_id: string | null }>;
    const isMain = rows.some((r) => r.role === "admin");
    const isZone = !isMain && rows.some((r) => r.assigned_zone_id);
    if (isZone) throw redirect({ to: "/admin/orders", replace: true });
  },
  component: DashboardHome,
  errorComponent: ({ error, reset }) => <DashboardRouteError error={error} reset={reset} />,
});

const STATUS_STYLES: Record<string, string> = {
  Delivered: "bg-emerald-50 text-emerald-700",
  "Out for delivery": "bg-sky-50 text-sky-700",
  Preparing: "bg-amber-50 text-amber-700",
  Pending: "bg-neutral-100 text-neutral-700",
  Cancelled: "bg-rose-50 text-rose-700",
};

function DashboardHome() {
  const { profile, user } = useAuth();
  const greeting = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Administrator";
  const router = useRouter();
  const fetchStats = useServerFn(getDashboardStats);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    ...dashboardQueryOptions(() => fetchStats()),
    refetchInterval: 30_000,
  });

  if (error) {
    return <DashboardError error={error} isRetrying={isFetching} reset={() => void refetch()} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#ff003c]">Overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            Welcome back, {greeting}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Here&rsquo;s how Sweet &amp; Lovely is performing today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-xs text-neutral-600">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            {dataUpdatedAt ? `Updated ${formatRelative(new Date(dataUpdatedAt))}` : "Loading…"}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (isFetching ? "animate-spin" : "")} /> Refresh
          </button>
        </div>
      </header>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {isLoading || !data
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[148px] rounded-3xl" />
            ))
          : data.kpis.map((kpi) => (
              <motion.div key={kpi.key} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                <KpiCard kpi={kpi} />
              </motion.div>
            ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Revenue trend"
          action={
            <Link
              to="/admin/analytics"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#ff003c] hover:underline"
            >
              View analytics <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="h-72 w-full">
            {isLoading || !data ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : data.revenue.every((p) => p.revenue === 0) ? (
              <EmptyBlock icon={<Activity className="h-5 w-5" />} label="No revenue in the last 30 days" />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenue} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff003c" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ff003c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #eee", fontSize: 12 }}
                  formatter={(v: number) => [`R ${v.toLocaleString()}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#ff003c" strokeWidth={2.5} fill="url(#rev-grad)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="New sign-ups"
          action={<UserPlus className="h-4 w-4 text-neutral-400" />}
        >
          {isLoading || !data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : data.recentSignups.length === 0 ? (
            <EmptyBlock icon={<UserPlus className="h-5 w-5" />} label="No new sign-ups yet" />
          ) : (
            <ul className="space-y-3">
              {data.recentSignups.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-2xl text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(135deg,#ff003c,#ff7a45)" }}
                  >
                    {initials(s.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{s.name}</p>
                    <p className="truncate text-xs text-neutral-500">{s.email}</p>
                  </div>
                  <span className="text-[11px] text-neutral-500">{formatRelative(new Date(s.created_at))}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent orders"
        action={
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#ff003c] hover:underline"
          >
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <div className="-mx-2 overflow-x-auto">
          {isLoading || !data ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : data.recentOrders.length === 0 ? (
            <EmptyBlock icon={<Inbox className="h-5 w-5" />} label="No orders yet" />
          ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                  <td className="px-3 py-3 font-medium text-neutral-900">
                    <span className="inline-flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5 text-neutral-400" />
                      {o.order_number}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-neutral-700">{o.customer}</td>
                  <td className="px-3 py-3 tabular-nums text-neutral-900">R {o.total.toLocaleString()}</td>
                  <td className="px-3 py-3">
                    <span className={"inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " + (STATUS_STYLES[o.status] ?? "bg-neutral-100 text-neutral-700")}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-neutral-500">{formatRelative(new Date(o.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRelative(d: Date) {
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function EmptyBlock({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-400 shadow-sm">
        {icon}
      </div>
      <p className="text-sm text-neutral-500">{label}</p>
    </div>
  );
}

function DashboardRouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();

  return (
    <DashboardError
      error={error}
      reset={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}

function DashboardError({ error, reset, isRetrying = false }: { error: unknown; reset: () => void; isRetrying?: boolean }) {
  const { message, details } = formatErrorForDisplay(error);

  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-rose-800">Couldn&rsquo;t load dashboard data</p>
          <p className="mt-1 text-sm text-rose-700">{message}</p>
          {details ? (
            <details className="mt-4 rounded-2xl border border-rose-200 bg-white/80 p-3 text-left">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-rose-800">
                Error stack trace
              </summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-neutral-950 p-3 text-xs leading-relaxed text-neutral-50">
                {details}
              </pre>
            </details>
          ) : null}
          <button
            type="button"
            onClick={reset}
            disabled={isRetrying}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (isRetrying ? "animate-spin" : "")} />
            {isRetrying ? "Retrying…" : "Retry loading data"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatErrorForDisplay(error: unknown) {
  if (error instanceof Error) {
    const stack = error.stack && error.stack !== error.message ? error.stack : "";
    const extra = Object.entries(error)
      .filter(([key]) => key !== "message" && key !== "stack")
      .map(([key, value]) => `${key}: ${safeStringify(value)}`)
      .join("\n");

    return {
      message: error.message || "Unknown dashboard error",
      details: [stack, extra].filter(Boolean).join("\n\n"),
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown dashboard error",
    details: typeof error === "string" ? error : safeStringify(error),
  };
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}