import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, requireAdminScope, requireMainAdmin, logAudit } from "./server-helpers.server";

const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, dashes"),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  fee_zar: z.number().nonnegative().max(100000),
  min_order_zar: z.number().nonnegative().max(1000000),
  eta_minutes: z.number().int().min(0).max(720),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999).default(0),
  postal_codes: z.array(z.string().min(1).max(20)).max(200).default([]),
  contact_phone: z.string().max(40).nullable().optional(),
  contact_email: z.string().max(200).nullable().optional(),
  hours_text: z.string().max(200).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  image_url: z.string().max(2000).nullable().optional(),
});

export const listAllZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    let q = context.supabase
      .from("delivery_zones")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!scope.isMain && scope.zoneId) q = q.eq("id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    if (!scope.isMain) {
      // Zone admins may only update their own zone, and never create new ones
      if (!data.id) throw new Error("Forbidden: only main admin can create zones");
      if (data.id !== scope.zoneId) throw new Error("Forbidden: zone admins may only edit their own zone");
    }
    const row = {
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      fee_zar: data.fee_zar,
      min_order_zar: data.min_order_zar,
      eta_minutes: data.eta_minutes,
      is_active: data.is_active,
      sort_order: data.sort_order,
      postal_codes: data.postal_codes,
      contact_phone: data.contact_phone ?? null,
      contact_email: data.contact_email ?? null,
      hours_text: data.hours_text ?? null,
      color: data.color ?? null,
      image_url: data.image_url ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("delivery_zones")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context, "delivery_zone.update", "delivery_zone", data.id, { slug: data.slug });
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("delivery_zones")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(context, "delivery_zone.create", "delivery_zone", ins.id, { slug: data.slug });
    return { ok: true, id: ins.id };
  });

export const toggleZoneActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    if (!scope.isMain && data.id !== scope.zoneId) {
      throw new Error("Forbidden: zone admins may only toggle their own zone");
    }
    const { error } = await context.supabase
      .from("delivery_zones")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "delivery_zone.toggle", "delivery_zone", data.id, {
      is_active: data.is_active,
    });
    return { ok: true };
  });

export const deleteZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireMainAdmin(context.supabase, context.userId);
    // Soft-delete via deactivate to preserve historical orders & analytics.
    const { error } = await context.supabase
      .from("delivery_zones")
      .update({ is_active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "delivery_zone.deactivate", "delivery_zone", data.id);
    return { ok: true };
  });