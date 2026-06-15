import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

export const listInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional().default(""),
        lowOnly: z.boolean().optional().default(false),
        sortBy: z.enum(["title", "stock", "low_stock_threshold", "updated_at"]).optional().default("stock"),
        sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("products")
      .select("slug, title, category_slug, stock, low_stock_threshold, is_active, updated_at", { count: "exact" });
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`title.ilike.${s},slug.ilike.${s}`);
    }
    const from = (data.page - 1) * data.pageSize;
    q = q.order(data.sortBy, { ascending: data.sortDir === "asc" }).range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    let filtered = rows ?? [];
    if (data.lowOnly) filtered = filtered.filter((r) => r.stock <= r.low_stock_threshold);
    return { rows: filtered, total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        delta: z.number().int(),
        type: z.enum(["restock", "sale", "adjustment", "return"]),
        reason: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: newBalance, error } = await context.supabase.rpc("adjust_product_stock", {
      _slug: data.slug,
      _delta: data.delta,
      _type: data.type,
      _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "inventory.adjust", "product", data.slug, {
      delta: data.delta,
      type: data.type,
      reason: data.reason,
      new_balance: newBalance,
    });
    return { ok: true, new_balance: newBalance };
  });

export const setLowStockThreshold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), threshold: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("products")
      .update({ low_stock_threshold: data.threshold })
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "inventory.threshold", "product", data.slug, { threshold: data.threshold });
    return { ok: true };
  });

export const listMovements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().optional(),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("inventory_movements")
      .select("id, product_slug, type, quantity, balance_after, reason, actor_email, created_at", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.slug) q = q.eq("product_slug", data.slug);
    const from = (data.page - 1) * data.pageSize;
    q = q.range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });