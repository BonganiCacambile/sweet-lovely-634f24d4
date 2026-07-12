import { createServerFn } from "@tanstack/react-start";

export const getPublicMenu = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: categories, error: cErr }, { data: products, error: pErr }] = await Promise.all([
    supabaseAdmin
      .from("categories")
      .select("slug, label, image, intro, sort_order")
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("products")
      .select("slug, title, description, price_zar, price_medium_zar, price_large_zar, category_slug, image, stock, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (cErr) throw new Error(cErr.message);
  if (pErr) throw new Error(pErr.message);
  return { categories: categories ?? [], products: products ?? [] };
});