import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminScope, logAudit } from "./server-helpers.server";

const idOnly = z.object({ id: z.string().uuid() });
const sectionEnum = z.enum(["popular", "hot_deals", "specials", "banners", "featured", "seasonal"]);
const tableEnum = z.enum(["home_popular_items", "home_hot_deals", "home_specials", "home_banners"]);

const popularInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().max(2000).nullable().optional(),
  price: z.string().max(40).nullable().optional(),
  product_slug: z.string().max(150).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});

const dealInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().max(2000).nullable().optional(),
  product_slug: z.string().max(150).nullable().optional(),
  original_price: z.number().nullable().optional(),
  discounted_price: z.number().nullable().optional(),
  discount_pct: z.number().int().min(0).max(100).nullable().optional(),
  label: z.string().max(80).nullable().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});

const specialInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().max(2000).nullable().optional(),
  price: z.string().max(40).nullable().optional(),
  product_slugs: z.array(z.string()).default([]),
  kind: z.enum(["special", "combo", "meal_deal", "seasonal", "featured"]).default("special"),
  zone_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});

const bannerInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(400).nullable().optional(),
  image_url: z.string().max(2000).nullable().optional(),
  cta_label: z.string().max(80).nullable().optional(),
  cta_href: z.string().max(500).nullable().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});

type Scope = { isMain: boolean; zoneId: string | null };

function cleanDates<T extends { starts_at?: string | null; ends_at?: string | null }>(x: T): T {
  return { ...x, starts_at: x.starts_at ? x.starts_at : null, ends_at: x.ends_at ? x.ends_at : null };
}
function enforceZone<T extends { zone_id?: string | null }>(row: T, scope: Scope): T {
  if (scope.isMain) return { ...row, zone_id: row.zone_id ?? null };
  return { ...row, zone_id: scope.zoneId };
}

/* ------ Popular Items ------ */
export const listPopularItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const base = context.supabase.from("home_popular_items").select("*").order("position");
    const q = scope.isMain ? base : base.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertPopularItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => popularInput.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const payload = enforceZone(cleanDates(data), scope);
    if (data.id) {
      const { error } = await context.supabase.from("home_popular_items").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context, "home_popular.update", "home_popular_items", data.id);
      return { id: data.id };
    }
    const { id: _id, ...insertPayload } = payload; void _id;
    const { data: row, error } = await context.supabase.from("home_popular_items").insert(insertPayload).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(context, "home_popular.create", "home_popular_items", row.id);
    return { id: row.id };
  });

export const deletePopularItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminScope(context.supabase, context.userId);
    const { error } = await context.supabase.from("home_popular_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "home_popular.delete", "home_popular_items", data.id);
    return { ok: true };
  });

/* ------ Hot Deals ------ */
export const listHotDeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const base = context.supabase.from("home_hot_deals").select("*").order("position");
    const q = scope.isMain ? base : base.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertHotDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dealInput.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const payload = enforceZone(cleanDates(data), scope);
    if (data.id) {
      const { error } = await context.supabase.from("home_hot_deals").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context, "home_deal.update", "home_hot_deals", data.id);
      return { id: data.id };
    }
    const { id: _id, ...insertPayload } = payload; void _id;
    const { data: row, error } = await context.supabase.from("home_hot_deals").insert(insertPayload).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(context, "home_deal.create", "home_hot_deals", row.id);
    return { id: row.id };
  });

export const deleteHotDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminScope(context.supabase, context.userId);
    const { error } = await context.supabase.from("home_hot_deals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "home_deal.delete", "home_hot_deals", data.id);
    return { ok: true };
  });

/* ------ Specials ------ */
export const listSpecials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const base = context.supabase.from("home_specials").select("*").order("position");
    const q = scope.isMain ? base : base.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertSpecial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => specialInput.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const payload = enforceZone(cleanDates(data), scope);
    if (data.id) {
      const { error } = await context.supabase.from("home_specials").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context, "home_special.update", "home_specials", data.id);
      return { id: data.id };
    }
    const { id: _id, ...insertPayload } = payload; void _id;
    const { data: row, error } = await context.supabase.from("home_specials").insert(insertPayload).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(context, "home_special.create", "home_specials", row.id);
    return { id: row.id };
  });

export const deleteSpecial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminScope(context.supabase, context.userId);
    const { error } = await context.supabase.from("home_specials").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "home_special.delete", "home_specials", data.id);
    return { ok: true };
  });

/* ------ Banners ------ */
export const listBanners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const base = context.supabase.from("home_banners").select("*").order("position");
    const q = scope.isMain ? base : base.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bannerInput.parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const payload = enforceZone(cleanDates(data), scope);
    if (data.id) {
      const { error } = await context.supabase.from("home_banners").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context, "home_banner.update", "home_banners", data.id);
      return { id: data.id };
    }
    const { id: _id, ...insertPayload } = payload; void _id;
    const { data: row, error } = await context.supabase.from("home_banners").insert(insertPayload).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(context, "home_banner.create", "home_banners", row.id);
    return { id: row.id };
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idOnly.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminScope(context.supabase, context.userId);
    const { error } = await context.supabase.from("home_banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "home_banner.delete", "home_banners", data.id);
    return { ok: true };
  });

/* ------ Reordering ------ */
export const reorderHomeContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ table: tableEnum, items: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) })) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdminScope(context.supabase, context.userId);
    for (const it of data.items) {
      const { error } = await context.supabase.from(data.table).update({ position: it.position }).eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ------ Section Visibility ------ */
export const listSectionVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const base = context.supabase.from("home_section_visibility").select("*");
    const q = scope.isMain ? base : base.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const setSectionVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ section: sectionEnum, zone_id: z.string().uuid().nullable().optional(), is_visible: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const zone = scope.isMain ? (data.zone_id ?? null) : scope.zoneId;
    const { error } = await context.supabase
      .from("home_section_visibility")
      .upsert({ section: data.section, zone_id: zone, is_visible: data.is_visible }, { onConflict: "section,zone_id" });
    if (error) throw new Error(error.message);
    await logAudit(context, "home_visibility.set", "home_section_visibility", data.section, { zone_id: zone, is_visible: data.is_visible });
    return { ok: true };
  });

/* ------ Analytics ------ */
export const getHomeAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const base = context.supabase.from("home_content_events").select("content_type, content_id, event_type, occurred_at").gte("occurred_at", since);
    const q = scope.isMain ? base : base.eq("zone_id", scope.zoneId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    type Bucket = { content_type: string; content_id: string; views: number; clicks: number };
    const buckets = new Map<string, Bucket>();
    const totals = { views: 0, clicks: 0 };
    for (const r of rows ?? []) {
      const key = `${r.content_type}:${r.content_id}`;
      const b = buckets.get(key) ?? { content_type: r.content_type, content_id: r.content_id, views: 0, clicks: 0 };
      if (r.event_type === "view") { b.views += 1; totals.views += 1; }
      else if (r.event_type === "click") { b.clicks += 1; totals.clicks += 1; }
      buckets.set(key, b);
    }
    const items = [...buckets.values()].sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks)).slice(0, 50);
    return { items, totals, days: data.days };
  });

/* ------ Pickers ------ */
export const listProductPicker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdminScope(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("products").select("slug, title, price_zar, category_slug, image, is_active").order("title");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listZonesForPicker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdminScope(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("delivery_zones").select("id, name, slug").eq("is_active", true).order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
