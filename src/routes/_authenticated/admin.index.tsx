import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowUpRight, ShoppingBag, UserPlus, Activity } from "lucide-react";
import { KpiCard } from "@/components/admin/kpi-card";
import { SectionCard } from "@/components/admin/section-card";
import { KPIS, REVENUE, RECENT_ORDERS, RECENT_SIGNUPS } from "@/data/admin/mock";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: DashboardHome,
});

const STATUS_STYLES: Record<string, string> = {
  Delivered: "bg-emerald-50 text-emerald-700",
  "Out for delivery": "bg-sky-50 text-sky-700",
  Preparing: "bg-amber-50 text-amber-700",
  Cancelled: "bg-rose-50 text-rose-700",
};

function DashboardHome() {
  const { profile, user } = useAuth();
  const greeting = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Administrator";

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
            <Activity className="h-3.5 w-3.5 text-emerald-500" /> All systems operational
          </span>
        </div>
      </header>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {KPIS.map((kpi) => (
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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
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
          </div>
        </SectionCard>

        <SectionCard
          title="New sign-ups"
          action={<UserPlus className="h-4 w-4 text-neutral-400" />}
        >
          <ul className="space-y-3">
            {RECENT_SIGNUPS.map((s) => (
              <li key={s.email} className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-2xl text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#ff003c,#ff7a45)" }}
                >
                  {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{s.name}</p>
                  <p className="truncate text-xs text-neutral-500">{s.email}</p>
                </div>
                <span className="text-[11px] text-neutral-500">{s.at}</span>
              </li>
            ))}
          </ul>
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
              {RECENT_ORDERS.map((o) => (
                <tr key={o.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                  <td className="px-3 py-3 font-medium text-neutral-900">
                    <span className="inline-flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5 text-neutral-400" />
                      {o.id}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-neutral-700">{o.customer}</td>
                  <td className="px-3 py-3 tabular-nums text-neutral-900">R {o.total.toLocaleString()}</td>
                  <td className="px-3 py-3">
                    <span className={"inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " + (STATUS_STYLES[o.status] ?? "bg-neutral-100 text-neutral-700")}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-neutral-500">{o.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}