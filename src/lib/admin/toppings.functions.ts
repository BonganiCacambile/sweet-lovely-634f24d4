import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const toppingPayload = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens"),
  price_zar: z.number().min(0),
  image_url: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().default(true),
  is_available: z.boolean().default(true),
  display_order: z.number().int().default(0),
});

export const listAllToppings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("pizza_toppings")
      .select("id, name, slug, price_zar, image_url, is_active, is_available, display_order, updated_at")
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTopping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => toppingPayload.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("pizza_toppings").insert(data);
    if (error) throw new Error(error.message);
    await logAudit(context, "topping.create", "pizza_topping", data.slug, { name: data.name });
    return { ok: true };
  });

export const updateTopping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: toppingPayload.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("pizza_toppings")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "topping.update", "pizza_topping", data.id, data.patch);
    return { ok: true };
  });

export const deleteTopping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("pizza_toppings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "topping.delete", "pizza_topping", data.id);
    return { ok: true };
  });