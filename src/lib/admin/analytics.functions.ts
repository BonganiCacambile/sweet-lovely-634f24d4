import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./server-helpers.server";

const rangeInput = z.object({
  fromDate: z.string().optional().default(""),
  toDate: z.string().optional().default(""),
});

function defaultRange(fromDate: string, toDate: string) {
  const to = toDate ? new Date(toDate) : new Date();
  const from = fromDate ? new Date(fromDate) : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  // Normalise to day bounds
  const fromIso = new Date(from.toISOString().slice(0, 10) + "T00:00:00.000Z").toISOString();
  const toIso = new Date(to.toISOString().slice(0, 10) + "T23:59:59.999Z").toISOString();
  return { fromIso, toIso, from: new Date(fromIso), to: new Date(toIso) };
}

export const analyticsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { fromIso, toIso, from, to } = defaultRange(data.fromDate, data.toDate);
    const spanMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1).toISOString();
    const prevFrom = new Date(from.getTime() - spanMs - 1).toISOString();

    const sb = context.supabase;
    const [curOrders, prevOrders, curUsers, prevUsers, items, statusRows] = await Promise.all([
      sb.from("orders").select("id, total_zar, status, created_at, user_id").gte("created_at", fromIso).lte("created_at", toIso),
      sb.from("orders").select("id, total_zar").gte("created_at", prevFrom).lte("created_at", prevTo),
      sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
      sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", prevFrom).lte("created_at", prevTo),
      sb.from("order_items").select("product_slug, title_snapshot, quantity, line_total_zar, orders!inner(created_at)").gte("orders.created_at", fromIso).lte("orders.created_at", toIso),
      sb.from("orders").select("status").gte("created_at", fromIso).lte("created_at", toIso),
    ]);
    if (curOrders.error) throw new Error(curOrders.error.message);
    if (items.error) throw new Error(items.error.message);

    const orders = curOrders.data ?? [];
    const prev = prevOrders.data ?? [];
    const revenue = orders.filter(o => o.status !== "cancelled" && o.status !== "refunded").reduce((s, o) => s + Number(o.total_zar || 0), 0);
    const prevRevenue = prev.reduce((s, o) => s + Number(o.total_zar || 0), 0);
    const orderCount = orders.length;
    const prevOrderCount = prev.length;
    const aov = orderCount ? revenue / orderCount : 0;
    const prevAov = prevOrderCount ? prevRevenue / prevOrderCount : 0;
    const newUsers = curUsers.count ?? 0;
    const prevNewUsers = prevUsers.count ?? 0;

    const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    // Time series buckets per day
    const days: { date: string; revenue: number; orders: number }[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const startDay = new Date(from.toISOString().slice(0, 10) + "T00:00:00.000Z").getTime();
    const endDay = new Date(to.toISOString().slice(0, 10) + "T00:00:00.000Z").getTime();
    for (let t = startDay; t <= endDay; t += dayMs) {
      days.push({ date: new Date(t).toISOString().slice(0, 10), revenue: 0, orders: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    for (const o of orders) {
      const key = new Date(o.created_at as string).toISOString().slice(0, 10);
      const i = idx.get(key);
      if (i == null) continue;
      days[i].orders += 1;
      if (o.status !== "cancelled" && o.status !== "refunded") days[i].revenue += Number(o.total_zar || 0);
    }

    // Top products
    const productAgg = new Map<string, { slug: string; title: string; qty: number; revenue: number }>();
    for (const it of items.data ?? []) {
      const slug = (it.product_slug as string | null) ?? "(deleted)";
      const row = productAgg.get(slug) ?? { slug, title: it.title_snapshot as string, qty: 0, revenue: 0 };
      row.qty += Number(it.quantity || 0);
      row.revenue += Number(it.line_total_zar || 0);
      productAgg.set(slug, row);
    }
    const topProducts = Array.from(productAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const r of statusRows.data ?? []) {
      const k = r.status as string;
      statusCounts[k] = (statusCounts[k] ?? 0) + 1;
    }

    return {
      range: { fromIso, toIso },
      kpis: {
        revenue: { value: revenue, delta: pct(revenue, prevRevenue) },
        orders: { value: orderCount, delta: pct(orderCount, prevOrderCount) },
        aov: { value: aov, delta: pct(aov, prevAov) },
        newUsers: { value: newUsers, delta: pct(newUsers, prevNewUsers) },
      },
      series: days,
      topProducts,
      statusCounts,
    };
  });
