import { createServerFn } from "@tanstack/react-start";

export const getPublicMenu = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: categories, error: cErr }, { data: products, error: pErr }, { data: sizes, error: sErr }] = await Promise.all([
    supabaseAdmin
      .from("categories")
      .select("slug, label, image, intro, sort_order")
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("products")
      .select("slug, title, description, price_zar, price_medium_zar, price_large_zar, category_slug, image, stock, sort_order, ingredients, allergens, nutrition, calories, fat_g, carbs_g, protein_g, size_selection_enabled")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("product_sizes")
      .select("id, product_slug, name, description, portion, price_zar, sort_order, is_available")
      .eq("is_available", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (cErr) throw new Error(cErr.message);
  if (pErr) throw new Error(pErr.message);
  if (sErr) throw new Error(sErr.message);
  return { categories: categories ?? [], products: products ?? [], sizes: sizes ?? [] };
});