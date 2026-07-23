import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const sizeInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(400).nullable().optional(),
  portion: z.string().max(120).nullable().optional(),
  price_zar: z.number().min(0),
  sort_order: z.number().int().optional().default(0),
  is_available: z.boolean().optional().default(true),
});

export const listProductSizes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("product_sizes")
      .select("id, name, description, portion, price_zar, sort_order, is_available")
      .eq("product_slug", data.product_slug)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Bulk replace all sizes for a product atomically (delete removed rows, upsert the rest). */
export const saveProductSizes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ product_slug: z.string(), sizes: z.array(sizeInput).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { data: existing, error: exErr } = await context.supabase
      .from("product_sizes")
      .select("id")
      .eq("product_slug", data.product_slug);
    if (exErr) throw new Error(exErr.message);

    const keepIds = new Set(data.sizes.map((s) => s.id).filter((v): v is string => !!v));
    const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !keepIds.has(id));

    if (toDelete.length > 0) {
      const { error: delErr } = await context.supabase
        .from("product_sizes")
        .delete()
        .in("id", toDelete);
      if (delErr) throw new Error(delErr.message);
    }

    if (data.sizes.length > 0) {
      const payload = data.sizes.map((s, i) => ({
        ...(s.id ? { id: s.id } : {}),
        product_slug: data.product_slug,
        name: s.name,
        description: s.description ?? null,
        portion: s.portion ?? null,
        price_zar: s.price_zar,
        sort_order: s.sort_order ?? i,
        is_available: s.is_available ?? true,
      }));
      const { error: upErr } = await context.supabase
        .from("product_sizes")
        .upsert(payload, { onConflict: "id" });
      if (upErr) throw new Error(upErr.message);
    }

    await logAudit(context, "product.sizes.save", "product", data.product_slug, {
      count: data.sizes.length,
      deleted: toDelete.length,
    });
    return { ok: true };
  });