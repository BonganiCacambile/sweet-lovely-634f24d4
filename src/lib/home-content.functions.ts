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