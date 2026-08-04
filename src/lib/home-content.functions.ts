import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public, read-only home-page content. Uses the publishable key so it runs
 * safely during SSR/prerender without a user session; RLS filters out any
 * inactive or scheduled-out rows via the "public read active" policies.
 */

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

type TimedHomeRow = {
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

function activeNow<T extends TimedHomeRow>(rows: T[] | null | undefined, now = Date.now()) {
  return (rows ?? []).filter((row) => {
    const startsAt = row.starts_at ? Date.parse(row.starts_at) : null;
    const endsAt = row.ends_at ? Date.parse(row.ends_at) : null;
    return row.is_active !== false && (startsAt == null || startsAt <= now) && (endsAt == null || endsAt > now);
  });
}

export const getHomeContent = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [popular, deals, specials, banners, desserts, featured, visibility] = await Promise.all([
    sb.from("home_popular_items").select("*").order("position").order("created_at"),
    sb.from("home_hot_deals").select("*").order("position").order("created_at"),
    sb.from("home_specials").select("*").order("position").order("created_at"),
    sb.from("home_banners").select("*").order("position").order("created_at"),
    sb.from("home_desserts").select("*").order("position").order("created_at"),
    sb
      .from("featured_items")
      .select("id, product_slug, placement, sort_order, is_active, starts_at, ends_at, products:product_slug(slug, title, image, price_zar, description)")
      .eq("placement", "home")
      .order("sort_order"),
    sb.from("home_section_visibility").select("section, is_visible, zone_id"),
  ]);

  const visiblePopular = activeNow(popular.data);
  const productSlugs = Array.from(
    new Set(visiblePopular.map((item) => item.product_slug).filter((slug): slug is string => Boolean(slug))),
  );
  const productPrices = new Map<
    string,
    { price_medium_zar: number | null; price_large_zar: number | null; size_selection_enabled: boolean }
  >();
  const productSizes = new Map<
    string,
    Array<{ id: string; name: string; description: string | null; portion: string | null; price_zar: number }>
  >();
  if (productSlugs.length > 0) {
    const [{ data: products }, { data: sizes }] = await Promise.all([
      sb
        .from("products")
        .select("slug, price_medium_zar, price_large_zar, size_selection_enabled")
        .in("slug", productSlugs)
        .eq("is_active", true),
      sb
        .from("product_sizes")
        .select("id, product_slug, name, description, portion, price_zar, sort_order")
        .in("product_slug", productSlugs)
        .eq("is_available", true)
        .order("sort_order", { ascending: true }),
    ]);
    for (const product of products ?? []) {
      productPrices.set(product.slug, {
        price_medium_zar: product.price_medium_zar == null ? null : Number(product.price_medium_zar),
        price_large_zar: product.price_large_zar == null ? null : Number(product.price_large_zar),
        size_selection_enabled: Boolean(product.size_selection_enabled),
      });
    }
    for (const s of sizes ?? []) {
      if (!s.product_slug) continue;
      const list = productSizes.get(s.product_slug) ?? [];
      list.push({
        id: s.id,
        name: s.name,
        description: s.description,
        portion: s.portion,
        price_zar: Number(s.price_zar),
      });
      productSizes.set(s.product_slug, list);
    }
  }

  const visMap: Record<string, boolean> = {};
  for (const v of visibility.data ?? []) {
    if (v.zone_id == null) visMap[v.section] = v.is_visible;
  }
  return {
    popular: visiblePopular.map((item) => {
      const priced = item.product_slug ? (productPrices.get(item.product_slug) ?? null) : null;
      const sizes =
        item.product_slug && priced?.size_selection_enabled
          ? (productSizes.get(item.product_slug) ?? [])
          : [];
      return { ...item, product: priced, sizes };
    }),
    hotDeals: activeNow(deals.data),
    specials: activeNow(specials.data),
    banners: activeNow(banners.data),
    desserts: activeNow(desserts.data),
    featured: activeNow(featured.data),
    visibility: visMap,
  };
});

export const trackHomeContentEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        content_type: z.enum(["popular", "hot_deal", "special", "banner", "featured", "dessert"]),
        content_id: z.string().uuid(),
        event_type: z.enum(["view", "click"]).default("click"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    await sb.from("home_content_events").insert({
      content_type: data.content_type,
      content_id: data.content_id,
      event_type: data.event_type,
    });
    return { ok: true };
  });

/**
 * Public *content* fingerprint of the anon-visible home content.
 *
 * It hashes the customer-visible fields (title, subtitle, description, price,
 * image, ordering, active/featured state, category, size pricing, …) of every
 * row the anonymous RLS policies already expose — never hidden rows — so it
 * detects both membership changes (insert/delete/activate/deactivate) *and*
 * in-place edits to an existing row. Deactivating a row removes it from the
 * anon SELECT scope, which is why anon Realtime never receives that UPDATE;
 * the fingerprint changes instead and the storefront offers a manual refresh.
 *
 * Only ~10 narrow projections are read and the result is reduced to a short
 * hash, so it stays far cheaper than getHomeContent.
 */
function hash(input: string): string {
  // djb2-xor — deterministic, allocation-free, good enough for change detection.
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Stable, order-independent digest of a row set. */
function digest(rows: Array<Record<string, unknown>> | null | undefined): string {
  return hash(
    (rows ?? [])
      .map((r) =>
        Object.keys(r)
          .sort()
          .map((k) => `${k}=${r[k] == null ? "" : String(r[k])}`)
          .join("|"),
      )
      .sort()
      .join(";"),
  );
}

export const getHomeContentFingerprint = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [popular, deals, specials, banners, desserts, featured, visibility, products, sizes, categories] =
    await Promise.all([
      sb.from("home_popular_items").select("*"),
      sb.from("home_hot_deals").select("*"),
      sb.from("home_specials").select("*"),
      sb.from("home_banners").select("*"),
      sb.from("home_desserts").select("*"),
      sb
        .from("featured_items")
        .select("id, product_slug, placement, sort_order, is_active, starts_at, ends_at")
        .eq("placement", "home"),
      sb.from("home_section_visibility").select("section, is_visible, zone_id"),
      sb
        .from("products")
        .select(
          "slug, title, description, image, price_zar, price_medium_zar, price_large_zar, category_slug, sort_order, is_active, size_selection_enabled, stock",
        )
        .eq("is_active", true),
      sb
        .from("product_sizes")
        .select("id, product_slug, name, portion, price_zar, sort_order")
        .eq("is_available", true),
      sb.from("categories").select("slug, label, image, sort_order"),
    ]);

  const timed = [popular, deals, specials, banners, desserts, featured];
  const parts = timed.map((r, i) => `${i}:${digest(activeNow(r.data as TimedHomeRow[]) as Array<Record<string, unknown>>)}`);
  parts.push(`v:${digest(visibility.data as Array<Record<string, unknown>>)}`);
  parts.push(`p:${digest(products.data as Array<Record<string, unknown>>)}`);
  parts.push(`s:${digest(sizes.data as Array<Record<string, unknown>>)}`);
  parts.push(`c:${digest(categories.data as Array<Record<string, unknown>>)}`);

  return { fingerprint: parts.join(";") };
});