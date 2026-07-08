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
      .select("id, product_slug, placement, sort_order, products:product_slug(slug, title, image, price_zar, description)")
      .eq("placement", "home")
      .order("sort_order"),
    sb.from("home_section_visibility").select("section, is_visible, zone_id"),
  ]);
  const visMap: Record<string, boolean> = {};
  for (const v of visibility.data ?? []) {
    if (v.zone_id == null) visMap[v.section] = v.is_visible;
  }
  return {
    popular: popular.data ?? [],
    hotDeals: deals.data ?? [],
    specials: specials.data ?? [],
    banners: banners.data ?? [],
    desserts: desserts.data ?? [],
    featured: featured.data ?? [],
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