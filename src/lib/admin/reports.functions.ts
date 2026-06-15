import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./server-helpers.server";

const reportInput = z.object({
  type: z.enum(["sales_by_day", "top_products", "top_customers", "low_stock", "status_mix", "reviews_summary"]),
  fromDate: z.string().optional().default(""),
  toDate: z.string().optional().default(""),
});

function range(fromDate: string, toDate: string) {
  const to = toDate ? new Date(toDate) : new Date();
  const from = fromDate ? new Date(fromDate) : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return {
    fromIso: new Date(from.toISOString().slice(0, 10) + "T00:00:00.000Z").toISOString(),
    toIso: new Date(to.toISOString().slice(0, 10) + "T23:59:59.999Z").toISOString(),
  };
}

export const REPORT_TYPES = [
  { id: "sales_by_day", label: "Sales by day", description: "Daily revenue, orders, and AOV across the selected period." },
  { id: "top_products", label: "Top products", description: "Best sellers by units and revenue." },
  { id: "top_customers", label: "Top customers", description: "Customers ranked by total spend." },
  { id: "low_stock", label: "Low stock", description: "Products at or below their low-stock threshold." },
  { id: "status_mix", label: "Order status mix", description: "Distribution of orders by status." },
  { id: "reviews_summary", label: "Reviews summary", description: "Average rating and review counts per product." },
] as const;

export const runReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const { fromIso, toIso } = range(data.fromDate, data.toDate);

    switch (data.type) {
      case "sales_by_day": {
        const { data: orders, error } = await sb
          .from("orders")
          .select("created_at, total_zar, status")
          .gte("created_at", fromIso).lte("created_at", toIso);
        if (error) throw new Error(error.message);
        const map = new Map<string, { date: string; orders: number; revenue: number; aov: number }>();
        for (const o of orders ?? []) {
          const k = new Date(o.created_at as string).toISOString().slice(0, 10);
          const row = map.get(k) ?? { date: k, orders: 0, revenue: 0, aov: 0 };
          row.orders += 1;
          if (o.status !== "cancelled" && o.status !== "refunded") row.revenue += Number(o.total_zar || 0);
          map.set(k, row);
        }
        const rows = Array.from(map.values()).map(r => ({ ...r, aov: r.orders ? Number((r.revenue / r.orders).toFixed(2)) : 0 })).sort((a, b) => a.date.localeCompare(b.date));
        return { columns: ["date", "orders", "revenue", "aov"], rows };
      }
      case "top_products": {
        const { data: items, error } = await sb
          .from("order_items")
          .select("product_slug, title_snapshot, quantity, line_total_zar, orders!inner(created_at)")
          .gte("orders.created_at", fromIso).lte("orders.created_at", toIso);
        if (error) throw new Error(error.message);
        const m = new Map<string, { product_slug: string; title: string; units: number; revenue: number }>();
        for (const it of items ?? []) {
          const slug = (it.product_slug as string | null) ?? "(deleted)";
          const row = m.get(slug) ?? { product_slug: slug, title: it.title_snapshot as string, units: 0, revenue: 0 };
          row.units += Number(it.quantity || 0);
          row.revenue += Number(it.line_total_zar || 0);
          m.set(slug, row);
        }
        return { columns: ["product_slug", "title", "units", "revenue"], rows: Array.from(m.values()).sort((a, b) => b.revenue - a.revenue) };
      }
      case "top_customers": {
        const { data: orders, error } = await sb
          .from("orders")
          .select("user_id, customer_name, customer_email, total_zar, status")
          .gte("created_at", fromIso).lte("created_at", toIso);
        if (error) throw new Error(error.message);
        const m = new Map<string, { customer: string; email: string; orders: number; spend: number }>();
        for (const o of orders ?? []) {
          const k = (o.user_id as string | null) ?? (o.customer_email as string) ?? "guest";
          const row = m.get(k) ?? { customer: o.customer_name as string, email: (o.customer_email as string) ?? "", orders: 0, spend: 0 };
          row.orders += 1;
          if (o.status !== "cancelled" && o.status !== "refunded") row.spend += Number(o.total_zar || 0);
          m.set(k, row);
        }
        return { columns: ["customer", "email", "orders", "spend"], rows: Array.from(m.values()).sort((a, b) => b.spend - a.spend).slice(0, 100) };
      }
      case "low_stock": {
        const { data: rows, error } = await sb
          .from("products")
          .select("slug, title, stock, low_stock_threshold, available")
          .order("stock", { ascending: true });
        if (error) throw new Error(error.message);
        const filtered = (rows ?? []).filter(r => Number(r.stock ?? 0) <= Number(r.low_stock_threshold ?? 0));
        return { columns: ["slug", "title", "stock", "low_stock_threshold", "available"], rows: filtered };
      }
      case "status_mix": {
        const { data: rows, error } = await sb
          .from("orders")
          .select("status")
          .gte("created_at", fromIso).lte("created_at", toIso);
        if (error) throw new Error(error.message);
        const counts: Record<string, number> = {};
        for (const r of rows ?? []) counts[r.status as string] = (counts[r.status as string] ?? 0) + 1;
        const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
        return {
          columns: ["status", "count", "percent"],
          rows: Object.entries(counts).map(([status, count]) => ({ status, count, percent: Number(((count / total) * 100).toFixed(1)) })).sort((a, b) => b.count - a.count),
        };
      }
      case "reviews_summary": {
        const { data: rows, error } = await sb.from("reviews").select("product_slug, rating, status");
        if (error) throw new Error(error.message);
        const m = new Map<string, { product_slug: string; reviews: number; approved: number; avg_rating: number; _sum: number; _n: number }>();
        for (const r of rows ?? []) {
          const slug = r.product_slug as string;
          const row = m.get(slug) ?? { product_slug: slug, reviews: 0, approved: 0, avg_rating: 0, _sum: 0, _n: 0 };
          row.reviews += 1;
          if (r.status === "approved") {
            row.approved += 1;
            row._sum += Number(r.rating || 0);
            row._n += 1;
          }
          m.set(slug, row);
        }
        const out = Array.from(m.values()).map(r => ({ product_slug: r.product_slug, reviews: r.reviews, approved: r.approved, avg_rating: r._n ? Number((r._sum / r._n).toFixed(2)) : 0 }));
        return { columns: ["product_slug", "reviews", "approved", "avg_rating"], rows: out.sort((a, b) => b.reviews - a.reviews) };
      }
    }
  });
