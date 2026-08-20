import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side source of truth for the signed-in customer's currently selected
 * delivery zone. Persisted on the profile so support requests (and anything
 * else that must be zone-routed) can derive the zone without trusting the
 * browser.
 */
export const getMySelectedZone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("selected_zone_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const zoneId = (data?.selected_zone_id as string | null) ?? null;
    if (!zoneId) return null;
    const { data: zone } = await context.supabase
      .from("delivery_zones")
      .select("id, slug, name, is_active")
      .eq("id", zoneId)
      .maybeSingle();
    if (!zone || zone.is_active === false) return null;
    return { id: zone.id as string, slug: zone.slug as string, name: zone.name as string };
  });

/** Persists the customer's chosen zone after validating it is active. */
export const setMySelectedZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(120).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let zoneId: string | null = null;
    if (data.slug) {
      const { data: zone, error } = await context.supabase
        .from("delivery_zones")
        .select("id")
        .eq("slug", data.slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!zone) return { ok: false as const, error: "That delivery zone is not available." };
      zoneId = zone.id as string;
    }
    const { error: upErr } = await context.supabase
      .from("profiles")
      .update({ selected_zone_id: zoneId })
      .eq("id", context.userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const, zoneId };
  });
