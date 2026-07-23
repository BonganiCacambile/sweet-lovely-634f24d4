import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const listInput = z.object({
  search: z.string().optional().default(""),
  category: z.string().optional().default(""),
  active: z.enum(["", "true", "false"]).optional().default(""),
  sortBy: z.enum(["title", "price_zar", "stock", "sort_order", "updated_at"]).optional().default("sort_order"),
  sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(25),
});

const productPayload = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens"),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  price_zar: z.number().min(0),
  price_medium_zar: z.number().min(0).nullable().optional(),
  price_large_zar: z.number().min(0).nullable().optional(),
  category_slug: z.string().min(1),
  image: z.string().max(2000).optional().nullable(),
  is_active: z.boolean(),
  stock: z.number().int().min(0).optional().default(0),
  low_stock_threshold: z.number().int().min(0).optional().default(5),
  sort_order: z.number().int().optional().default(0),
  ingredients: z.array(z.string().trim().min(1).max(80)).max(50).optional().default([]),
  allergens: z.string().max(500).nullable().optional(),
  calories: z.number().int().min(0).max(10000).nullable().optional(),
  fat_g: z.number().min(0).max(10000).nullable().optional(),
  carbs_g: z.number().min(0).max(10000).nullable().optional(),
  protein_g: z.number().min(0).max(10000).nullable().optional(),
  size_selection_enabled: z.boolean().optional().default(false),
});

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("products")
      .select("slug, title, description, price_zar, price_medium_zar, price_large_zar, category_slug, image, is_active, stock, low_stock_threshold, sort_order, updated_at, ingredients, allergens, calories, fat_g, carbs_g, protein_g, size_selection_enabled", { count: "exact" });
    if (data.category) q = q.eq("category_slug", data.category);
    if (data.active === "true") q = q.eq("is_active", true);
    if (data.active === "false") q = q.eq("is_active", false);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`title.ilike.${s},slug.ilike.${s},description.ilike.${s}`);
    }
    const from = (data.page - 1) * data.pageSize;
    q = q.order(data.sortBy, { ascending: data.sortDir === "asc" }).range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productPayload.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("products").insert(data);
    if (error) throw new Error(error.message);
    await logAudit(context, "product.create", "product", data.slug, { title: data.title });
    return { ok: true };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ original_slug: z.string(), patch: productPayload.partial().omit({ slug: true }) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("products")
      .update(data.patch)
      .eq("slug", data.original_slug);
    if (error) throw new Error(error.message);
    await logAudit(context, "product.update", "product", data.original_slug, data.patch as Record<string, unknown>);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("products").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    await logAudit(context, "product.delete", "product", data.slug);
    return { ok: true };
  });

export const productSalesSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("order_items")
      .select("product_slug, quantity, line_total_zar");
    if (error) throw new Error(error.message);
    const map: Record<string, { qty: number; revenue: number }> = {};
    for (const r of data ?? []) {
      if (!r.product_slug) continue;
      const cur = map[r.product_slug] ?? { qty: 0, revenue: 0 };
      cur.qty += r.quantity;
      cur.revenue += Number(r.line_total_zar);
      map[r.product_slug] = cur;
    }
    return map;
  });
