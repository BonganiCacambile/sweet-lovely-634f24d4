import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const payload = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(120),
  image: z.string().max(2000).optional().nullable(),
  intro: z.string().max(2000).optional().nullable(),
  sort_order: z.number().int().optional().default(0),
});

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: cats, error } = await context.supabase
      .from("categories")
      .select("slug, label, image, intro, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: counts, error: e2 } = await context.supabase
      .from("products")
      .select("category_slug");
    if (e2) throw new Error(e2.message);
    const countMap: Record<string, number> = {};
    for (const p of counts ?? []) countMap[p.category_slug] = (countMap[p.category_slug] ?? 0) + 1;
    return (cats ?? []).map((c) => ({ ...c, product_count: countMap[c.slug] ?? 0 }));
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => payload.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("categories").insert(data);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "category.create", "category", data.slug);
    return { ok: true };
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ original_slug: z.string(), patch: payload.partial().omit({ slug: true }) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("categories")
      .update(data.patch)
      .eq("slug", data.original_slug);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "category.update", "category", data.original_slug);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("categories").delete().eq("slug", data.slug);
    if (error) throw new Error(`Cannot delete: ${error.message}`);
    await logAudit(context.supabase, "category.delete", "category", data.slug);
    return { ok: true };
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slugs: z.array(z.string()) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    for (let i = 0; i < data.slugs.length; i += 1) {
      const { error } = await context.supabase
        .from("categories")
        .update({ sort_order: i })
        .eq("slug", data.slugs[i]);
      if (error) throw new Error(error.message);
    }
    await logAudit(context.supabase, "category.reorder", "category", null, { order: data.slugs });
    return { ok: true };
  });