import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/admin/page-header";
import { Card, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { formatZar } from "@/lib/admin/format";
import { analyticsOverview } from "@/lib/admin/analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AnalyticsPage,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", paid: "#10b981", preparing: "#3b82f6", out_for_delivery: "#8b5cf6",
  delivered: "#059669", cancelled: "#6b7280", refunded: "#ef4444",
};

function presetRange(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) };
}

function AnalyticsPage() {
  const [range, setRange] = useState(presetRange(30));
  const fn = useServerFn(analyticsOverview);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "analytics", range],
    queryFn: () => fn({ data: range }),
    refetchOnWindowFocus: true,
  });

  const topProductCols = useMemo(() => ([
    { key: "title", label: "Product" },
    { key: "slug", label: "Slug" },
    { key: "qty", label: "Units" },
    { key: "revenue", label: "Revenue (R)", map: (r: { revenue: number }) => r.revenue.toFixed(2) },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Revenue, orders and customer activity across the selected period."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setRange(presetRange(d))} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Last {d}d</button>
            ))}
            <input type="date" value={range.fromDate} onChange={e => setRange(r => ({ ...r, fromDate: e.target.value }))} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs" />
            <span className="text-xs text-neutral-500">to</span>
            <input type="date" value={range.toDate} onChange={e => setRange(r => ({ ...r, toDate: e.target.value }))} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs" />
          </div>
        }
      />

      {error ? <ErrorPanel error={error} onRetry={() => refetch()} /> : null}
      {isLoading || !data ? <LoadingRows rows={4} height={90} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Revenue" value={formatZar(data.kpis.revenue.value)} delta={data.kpis.revenue.delta} />
            <Kpi label="Orders" value={data.kpis.orders.value.toLocaleString()} delta={data.kpis.orders.delta} />
            <Kpi label="Avg Order Value" value={formatZar(data.kpis.aov.value)} delta={data.kpis.aov.delta} />
            <Kpi label="New Users" value={data.kpis.newUsers.value.toLocaleString()} delta={data.kpis.newUsers.delta} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="text-sm font-semibold text-neutral-900">Revenue & orders</h2>
              </div>
              <div className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff003c" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#ff003c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f1f1f1" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} stroke="#999" />
                    <YAxis fontSize={11} stroke="#999" />
                    <Tooltip formatter={(v: number, n: string) => n === "revenue" ? formatZar(v) : v} />
                    <Area type="monotone" dataKey="revenue" stroke="#ff003c" strokeWidth={2} fill="url(#rev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="text-sm font-semibold text-neutral-900">Order status mix</h2>
              </div>
              <div className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={Object.entries(data.statusCounts).map(([k, v]) => ({ name: k, value: v }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      {Object.keys(data.statusCounts).map((k, i) => <Cell key={i} fill={STATUS_COLORS[k] ?? "#aaa"} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-sm font-semibold text-neutral-900">Top products</h2>
              <ExportMenu rows={data.topProducts} columns={topProductCols} filename="top-products" title="Top products" />
            </div>
            <div className="h-72 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid stroke="#f1f1f1" horizontal={false} />
                  <XAxis type="number" fontSize={11} stroke="#999" />
                  <YAxis dataKey="title" type="category" fontSize={11} stroke="#999" width={140} />
                  <Tooltip formatter={(v: number) => formatZar(v)} />
                  <Bar dataKey="revenue" fill="#ff003c" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t border-neutral-100">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr><th className="px-4 py-2 text-left">Product</th><th className="px-4 py-2 text-left">Slug</th><th className="px-4 py-2 text-right">Units</th><th className="px-4 py-2 text-right">Revenue</th></tr>
                </thead>
                <tbody>
                  {data.topProducts.map(p => (
                    <tr key={p.slug} className="border-t border-neutral-100"><td className="px-4 py-2">{p.title}</td><td className="px-4 py-2 font-mono text-[11px] text-neutral-500">{p.slug}</td><td className="px-4 py-2 text-right tabular-nums">{p.qty}</td><td className="px-4 py-2 text-right tabular-nums">{formatZar(p.revenue)}</td></tr>
                  ))}
                  {!data.topProducts.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-500">No sales in this period</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta: number }) {
  const positive = delta >= 0;
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_10px_40px_-24px_rgba(15,15,15,0.18)]">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      <p className={`mt-1 text-xs font-semibold ${positive ? "text-emerald-700" : "text-rose-700"}`}>{positive ? "+" : ""}{delta.toFixed(1)}% vs previous period</p>
    </div>
  );
}