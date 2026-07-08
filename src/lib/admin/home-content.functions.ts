import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminScope, logAudit } from "./server-helpers.server";

/**
 * Home Page Content Manager — admin CRUD for popular items, hot deals,
 * specials, banners, featured products, and per-section visibility.
 *
 * Zone admins are auto-scoped to their assigned delivery zone; main admins
 * see and manage every zone (including "global" rows where zone_id is NULL).
 */

// ---------- shared shapes -------------------------------------------------

const nullableString = z.string().max(2000).optional().nullable();
const nullableIsoDate = z.string().datetime().optional().nullable();

const baseFields = {
  title: z.string().min(1).max(200),
  description: nullableString,
  image_url: nullableString,
  position: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  starts_at: nullableIsoDate,
  ends_at: nullableIsoDate,
  zone_id: z.string().uuid().optional().nullable(),
};

const popularPayload = z.object({
  ...baseFields,
  price: nullableString,
  product_slug: nullableString,
  category: nullableString,
});

const hotDealPayload = z.object({
  ...baseFields,
  product_slug: nullableString,
  original_price: z.number().min(0).optional().nullable(),
  discounted_price: z.number().min(0).optional().nullable(),
  discount_pct: z.number().int().min(0).max(100).optional().nullable(),
  label: nullableString,
});

const specialPayload = z.object({
  ...baseFields,
  price: nullableString,
  product_slugs: z.array(z.string()).default([]),
  kind: z.enum(["special", "combo", "meal_deal"]).default("special"),
});

const bannerPayload = z.object({
  title: baseFields.title,
  image_url: baseFields.image_url,
  position: baseFields.position,
  is_active: baseFields.is_active,
  starts_at: baseFields.starts_at,
  ends_at: baseFields.ends_at,
  zone_id: baseFields.zone_id,
  subtitle: nullableString,
  cta_label: nullableString,
  cta_href: nullableString,
});

const featuredPayload = z.object({
  product_slug: z.string().min(1),
  placement: z.enum(["home", "menu", "desserts", "offers"]).default("home"),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  starts_at: nullableIsoDate,
  ends_at: nullableIsoDate,
});

// ---------- helpers -------------------------------------------------------

type Scope = { isMain: boolean; zoneId: string | null };

// ---------- popular items -------------------------------------------------

export const listPopular = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_popular_items").select("*").order("position").order("created_at");
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertPopular = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), patch: popularPayload }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    const patch = scope.isMain ? data.patch : { ...data.patch, zone_id: scope.zoneId };
    if (data.id) {
      let q = supabaseAdmin.from("home_popular_items").update(patch).eq("id", data.id);
      if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
      const { error } = await q;
      if (error) throw new Error(error.message);
      await logAudit(context, "home.popular.update", "home_popular_items", data.id, { title: patch.title });
    } else {
      const { error } = await supabaseAdmin.from("home_popular_items").insert(patch);
      if (error) throw new Error(error.message);
      await logAudit(context, "home.popular.create", "home_popular_items", null, { title: patch.title });
    }
    return { ok: true };
  });

export const deletePopular = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_popular_items").delete().eq("id", data.id);
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await logAudit(context, "home.popular.delete", "home_popular_items", data.id);
    return { ok: true };
  });

// ---------- hot deals -----------------------------------------------------

export const listHotDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_hot_deals").select("*").order("position").order("created_at");
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertHotDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), patch: hotDealPayload }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    const patch = scope.isMain ? data.patch : { ...data.patch, zone_id: scope.zoneId };
    if (data.id) {
      let q = supabaseAdmin.from("home_hot_deals").update(patch).eq("id", data.id);
      if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
      const { error } = await q;
      if (error) throw new Error(error.message);
      await logAudit(context, "home.hot_deal.update", "home_hot_deals", data.id, { title: patch.title });
    } else {
      const { error } = await supabaseAdmin.from("home_hot_deals").insert(patch);
      if (error) throw new Error(error.message);
      await logAudit(context, "home.hot_deal.create", "home_hot_deals", null, { title: patch.title });
    }
    return { ok: true };
  });

export const deleteHotDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_hot_deals").delete().eq("id", data.id);
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await logAudit(context, "home.hot_deal.delete", "home_hot_deals", data.id);
    return { ok: true };
  });

// ---------- specials ------------------------------------------------------

export const listSpecials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_specials").select("*").order("position").order("created_at");
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertSpecial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), patch: specialPayload }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    const patch = scope.isMain ? data.patch : { ...data.patch, zone_id: scope.zoneId };
    if (data.id) {
      let q = supabaseAdmin.from("home_specials").update(patch).eq("id", data.id);
      if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
      const { error } = await q;
      if (error) throw new Error(error.message);
      await logAudit(context, "home.special.update", "home_specials", data.id, { title: patch.title });
    } else {
      const { error } = await supabaseAdmin.from("home_specials").insert(patch);
      if (error) throw new Error(error.message);
      await logAudit(context, "home.special.create", "home_specials", null, { title: patch.title });
    }
    return { ok: true };
  });

export const deleteSpecial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_specials").delete().eq("id", data.id);
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await logAudit(context, "home.special.delete", "home_specials", data.id);
    return { ok: true };
  });

// ---------- banners -------------------------------------------------------

export const listBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_banners").select("*").order("position").order("created_at");
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), patch: bannerPayload }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    const patch = scope.isMain ? data.patch : { ...data.patch, zone_id: scope.zoneId };
    if (data.id) {
      let q = supabaseAdmin.from("home_banners").update(patch).eq("id", data.id);
      if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
      const { error } = await q;
      if (error) throw new Error(error.message);
      await logAudit(context, "home.banner.update", "home_banners", data.id, { title: patch.title });
    } else {
      const { error } = await supabaseAdmin.from("home_banners").insert(patch);
      if (error) throw new Error(error.message);
      await logAudit(context, "home.banner.create", "home_banners", null, { title: patch.title });
    }
    return { ok: true };
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_banners").delete().eq("id", data.id);
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await logAudit(context, "home.banner.delete", "home_banners", data.id);
    return { ok: true };
  });

// ---------- featured products (main admin only, tied to inventory) --------

export const listFeatured = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    const { data, error } = await supabaseAdmin
      .from("featured_items")
      .select("*, products:product_slug(title, image, price_zar)")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const upsertFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), patch: featuredPayload }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    if (!scope.isMain) throw new Error("Forbidden: featured products are managed by main admins");
    if (data.id) {
      const { error } = await supabaseAdmin.from("featured_items").update(data.patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context, "home.featured.update", "featured_items", data.id, { slug: data.patch.product_slug });
    } else {
      const { error } = await supabaseAdmin.from("featured_items").insert(data.patch);
      if (error) throw new Error(error.message);
      await logAudit(context, "home.featured.create", "featured_items", null, { slug: data.patch.product_slug });
    }
    return { ok: true };
  });

export const deleteFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    if (!scope.isMain) throw new Error("Forbidden: featured products are managed by main admins");
    const { error } = await supabaseAdmin.from("featured_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "home.featured.delete", "featured_items", data.id);
    return { ok: true };
  });

// ---------- section visibility -------------------------------------------

export const SECTION_KEYS = [
  "popular",
  "hot_deals",
  "specials",
  "banners",
  "desserts",
  "featured",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const listVisibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    let q = supabaseAdmin.from("home_section_visibility").select("*");
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: data ?? [], scope };
  });

export const setVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ section: z.enum(SECTION_KEYS), is_visible: z.boolean(), zone_id: z.string().uuid().optional().nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    const zone_id = scope.isMain ? data.zone_id ?? null : scope.zoneId;
    const { error } = await supabaseAdmin
      .from("home_section_visibility")
      .upsert({ section: data.section, zone_id, is_visible: data.is_visible }, { onConflict: "section,zone_id" });
    if (error) throw new Error(error.message);
    await logAudit(context, "home.visibility.set", "home_section_visibility", null, {
      section: data.section,
      is_visible: data.is_visible,
      zone_id,
    });
    return { ok: true };
  });

// ---------- analytics -----------------------------------------------------

export const homeContentAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await requireAdminScope(supabaseAdmin, context.userId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let q = supabaseAdmin
      .from("home_content_events")
      .select("content_type, content_id, event_type, occurred_at, zone_id")
      .gte("occurred_at", since);
    if (!scope.isMain && scope.zoneId) q = q.eq("zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const byType: Record<string, { views: number; clicks: number }> = {};
    const byItem: Record<string, { content_type: string; content_id: string; views: number; clicks: number }> = {};
    for (const r of rows) {
      const t = (byType[r.content_type] ??= { views: 0, clicks: 0 });
      if (r.event_type === "view") t.views += 1;
      if (r.event_type === "click") t.clicks += 1;
      const key = `${r.content_type}:${r.content_id}`;
      const i = (byItem[key] ??= {
        content_type: r.content_type,
        content_id: r.content_id,
        views: 0,
        clicks: 0,
      });
      if (r.event_type === "view") i.views += 1;
      if (r.event_type === "click") i.clicks += 1;
    }
    const top = Object.values(byItem)
      .sort((a, b) => b.clicks + b.views / 4 - (a.clicks + a.views / 4))
      .slice(0, 20);
    return { total: rows.length, byType, top };
  });

// ---------- product picker helper ----------------------------------------

export const listProductOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdminScope(supabaseAdmin, context.userId);
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("slug, title, image, price_zar, category_slug, is_active")
      .order("title")
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });