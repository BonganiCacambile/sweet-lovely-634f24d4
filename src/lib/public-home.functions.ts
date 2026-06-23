import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const homeInput = z.object({ zoneId: z.string().uuid().nullable().optional() });

export const getHomeContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => homeInput.parse(d ?? {}))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const zoneFilter = (q: ReturnType<typeof supabase.from> extends infer _ ? any : any) =>
      data.zoneId ? q.or(`zone_id.is.null,zone_id.eq.${data.zoneId}`) : q.is("zone_id", null);

    const [popular, hotDeals, specials, banners, visibility] = await Promise.all([
      zoneFilter(supabase.from("home_popular_items").select("id, title, description, image_url, price, product_slug, category, position, zone_id").order("position")),
      zoneFilter(supabase.from("home_hot_deals").select("id, title, description, image_url, product_slug, original_price, discounted_price, discount_pct, label, position, zone_id").order("position")),
      zoneFilter(supabase.from("home_specials").select("id, title, description, image_url, price, product_slugs, kind, position, zone_id").order("position")),
      zoneFilter(supabase.from("home_banners").select("id, title, subtitle, image_url, cta_label, cta_href, position, zone_id").order("position")),
      supabase.from("home_section_visibility").select("section, zone_id, is_visible"),
    ]);

    const visMap: Record<string, boolean> = {};
    for (const row of visibility.data ?? []) {
      // Zone-specific overrides take precedence over global (zone_id IS NULL).
      const k = row.section as string;
      if (row.zone_id === data.zoneId) visMap[k] = row.is_visible;
      else if (row.zone_id === null && !(k in visMap)) visMap[k] = row.is_visible;
    }

    return {
      popular: popular.data ?? [],
      hotDeals: hotDeals.data ?? [],
      specials: specials.data ?? [],
      banners: banners.data ?? [],
      visibility: visMap,
    };
  });

const trackInput = z.object({
  contentType: z.enum(["popular", "hot_deal", "special", "banner"]),
  contentId: z.string().uuid(),
  eventType: z.enum(["view", "click"]),
  zoneId: z.string().uuid().nullable().optional(),
});

export const trackHomeEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => trackInput.parse(d))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    await supabase.from("home_content_events").insert({
      content_type: data.contentType,
      content_id: data.contentId,
      event_type: data.eventType,
      zone_id: data.zoneId ?? null,
    });
    return { ok: true };
  });
