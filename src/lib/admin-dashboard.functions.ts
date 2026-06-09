import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardKpi = {
  key: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  delta: number;
  spark: number[];
};

export type DashboardRevenuePoint = { day: string; revenue: number; orders: number };

export type DashboardRecentOrder = {
  id: string;
  order_number: string;
  customer: string;
  total: number;
  status: string;
  created_at: string;
};

export type DashboardSignup = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type DashboardStats = {
  kpis: DashboardKpi[];
  revenue: DashboardRevenuePoint[];
  recentOrders: DashboardRecentOrder[];
  recentSignups: DashboardSignup[];
  generatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function pctDelta(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function bucketDaily<T extends { created_at: string }>(
  rows: T[],
  days: number,
  pick: (r: T) => number,
) {
  const now = new Date();
  const buckets: number[] = Array.from({ length: days }, () => 0);
  for (const r of rows) {
    const d = new Date(r.created_at);
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    const idx = days - 1 - diff;
    if (idx >= 0 && idx < days) buckets[idx] += pick(r);
  }
  return buckets;
}

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardStats> => {
    const { supabase, userId } = context;

    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const start60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      ordersRecentRes,
      ordersPrevRes,
      recentOrdersRes,
      productsCountRes,
      usersListRes,
      activeTodayRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, total_zar, created_at, status")
        .gte("created_at", start60)
        .order("created_at", { ascending: true }),
      // placeholder so destructuring index aligns (we'll reuse ordersRecentRes split)
      Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("orders")
        .select("id, order_number, customer_name, total_zar, status, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startToday),
    ]);
    void ordersPrevRes;

    if (ordersRecentRes.error) {
      console.error("[dashboard] ordersRecent error", ordersRecentRes.error);
      throw new Error(`orders(60d): ${ordersRecentRes.error.message}`);
    }
    if (recentOrdersRes.error) {
      console.error("[dashboard] recentOrders error", recentOrdersRes.error);
      throw new Error(`recentOrders: ${recentOrdersRes.error.message}`);
    }
    if (productsCountRes.error) {
      console.error("[dashboard] productsCount error", productsCountRes.error);
      const e = productsCountRes.error as { message?: string; details?: string; hint?: string; code?: string };
      throw new Error(
        `products: ${e.message || "(no message)"} | code=${e.code ?? "?"} | details=${e.details ?? "?"} | hint=${e.hint ?? "?"}`,
      );
    }
    if (activeTodayRes.error) {
      console.error("[dashboard] activeToday error", activeTodayRes.error);
      throw new Error(`ordersToday: ${activeTodayRes.error.message}`);
    }
    if (usersListRes.error) {
      console.error("[dashboard] usersList error", usersListRes.error);
      throw new Error(`users(admin.listUsers): ${usersListRes.error.message}`);
    }

    const allOrders = (ordersRecentRes.data ?? []).map((o) => ({
      ...o,
      total_zar: Number(o.total_zar ?? 0),
    }));
    const ordersLast30 = allOrders.filter((o) => o.created_at >= start30);
    const ordersPrev30 = allOrders.filter((o) => o.created_at < start30);

    const revenue30 = ordersLast30
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.total_zar, 0);
    const revenuePrev30 = ordersPrev30
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.total_zar, 0);
    const orderCount30 = ordersLast30.length;
    const orderCountPrev30 = ordersPrev30.length;

    // Users (auth.users)
    const allUsers = usersListRes.data.users ?? [];
    const usersLast30 = allUsers.filter((u) => u.created_at && u.created_at >= start30);
    const usersPrev30 = allUsers.filter(
      (u) => u.created_at && u.created_at < start30 && u.created_at >= start60,
    );

    // Conversion = orders / users (last 30d) — proxy
    const conv = usersLast30.length > 0 ? (orderCount30 / usersLast30.length) * 100 : 0;
    const convPrev =
      usersPrev30.length > 0 ? (orderCountPrev30 / usersPrev30.length) * 100 : 0;

    // Sparklines (last 30 days)
    const revenueSpark = bucketDaily(
      ordersLast30.filter((o) => o.status !== "cancelled"),
      30,
      (o) => o.total_zar,
    );
    const ordersSpark = bucketDaily(ordersLast30, 30, () => 1);
    const usersSpark = bucketDaily(
      usersLast30.map((u) => ({ created_at: u.created_at! })),
      30,
      () => 1,
    );
    const activeSpark = ordersSpark; // proxy: order activity
    const convSpark = revenueSpark.map((r, i) =>
      usersSpark[i] > 0 ? (ordersSpark[i] / usersSpark[i]) * 100 : 0,
    );
    const growthSpark = usersSpark;

    const activeToday = activeTodayRes.count ?? 0;

    const kpis: DashboardKpi[] = [
      {
        key: "users",
        label: "Total members",
        value: allUsers.length,
        delta: pctDelta(usersLast30.length, usersPrev30.length),
        spark: usersSpark,
      },
      {
        key: "active",
        label: "Orders today",
        value: activeToday,
        delta: pctDelta(orderCount30, orderCountPrev30),
        spark: activeSpark,
      },
      {
        key: "revenue",
        label: "Revenue (30d)",
        value: Math.round(revenue30),
        prefix: "R ",
        delta: pctDelta(revenue30, revenuePrev30),
        spark: revenueSpark,
      },
      {
        key: "orders",
        label: "Orders (30d)",
        value: orderCount30,
        delta: pctDelta(orderCount30, orderCountPrev30),
        spark: ordersSpark,
      },
      {
        key: "conv",
        label: "Conversion",
        value: Number(conv.toFixed(1)),
        suffix: "%",
        delta: pctDelta(conv, convPrev),
        spark: convSpark,
      },
      {
        key: "growth",
        label: "New members (30d)",
        value: usersLast30.length,
        delta: pctDelta(usersLast30.length, usersPrev30.length),
        spark: growthSpark,
      },
    ];

    // Products KPI is currently unused but kept for future
    void productsCountRes;

    const revenue: DashboardRevenuePoint[] = revenueSpark.map((rev, i) => {
      const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
      return {
        day: `${d.getMonth() + 1}/${d.getDate()}`,
        revenue: Math.round(rev),
        orders: ordersSpark[i],
      };
    });

    const recentOrders: DashboardRecentOrder[] = (recentOrdersRes.data ?? []).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      customer: o.customer_name,
      total: Number(o.total_zar ?? 0),
      status: STATUS_LABEL[o.status as string] ?? String(o.status),
      created_at: o.created_at,
    }));

    const recentSignups: DashboardSignup[] = allUsers
      .slice()
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 6)
      .map((u) => ({
        id: u.id,
        name:
          ((u.user_metadata as { full_name?: string; name?: string } | null)?.full_name ??
            (u.user_metadata as { name?: string } | null)?.name ??
            u.email?.split("@")[0] ??
            "Member"),
        email: u.email ?? "",
        created_at: u.created_at ?? new Date().toISOString(),
      }));

    return {
      kpis,
      revenue,
      recentOrders,
      recentSignups,
      generatedAt: new Date().toISOString(),
    };
  });