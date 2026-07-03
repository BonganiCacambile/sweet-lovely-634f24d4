import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_menu",
  title: "Get menu",
  description:
    "Fetch Sweet & Lovely's public menu: active categories and products with prices in ZAR.",
  inputSchema: {
    category_slug: z
      .string()
      .optional()
      .describe("Optional category slug to filter products (e.g. 'pizza')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category_slug }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: categories, error: cErr }, { data: products, error: pErr }] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("slug, label, intro, sort_order")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("products")
        .select("slug, title, description, price_zar, category_slug, stock, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);
    if (cErr) return { content: [{ type: "text", text: cErr.message }], isError: true };
    if (pErr) return { content: [{ type: "text", text: pErr.message }], isError: true };
    const filtered = category_slug
      ? (products ?? []).filter((p) => p.category_slug === category_slug)
      : products ?? [];
    const payload = { categories: categories ?? [], products: filtered };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});