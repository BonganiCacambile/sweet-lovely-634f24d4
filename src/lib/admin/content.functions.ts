import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const listInput = z.object({
  search: z.string().optional().default(""),
  status: z.enum(["all", "draft", "published", "archived"]).optional().default("all"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(50),
});

export const listContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("content_pages")
      .select("id, slug, title, status, seo_title, seo_description, publish_at, author_id, updated_at, created_at", { count: "exact" });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`title.ilike.${s},slug.ilike.${s},seo_title.ilike.${s}`);
    }
    const from = (data.page - 1) * data.pageSize;
    q = q.order("updated_at", { ascending: false }).range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("content_pages").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(150).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  body: z.string().max(100_000).default(""),
  status: z.enum(["draft", "published", "archived"]),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(400).optional().nullable(),
  publish_at: z.string().optional().nullable(),
});
export const upsertContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const payload = {
      slug: data.slug, title: data.title, body: data.body, status: data.status,
      seo_title: data.seo_title ?? null, seo_description: data.seo_description ?? null,
      publish_at: data.publish_at || null, author_id: context.userId,
    };
    let id = data.id;
    if (id) {
      const { error } = await context.supabase.from("content_pages").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase.from("content_pages").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      id = row.id;
    }
    await logAudit(context, data.id ? "content.update" : "content.create", "content_page", id, { slug: data.slug, status: data.status });
    return { id };
  });

export const deleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("content_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "content.delete", "content_page", data.id);
    return { ok: true };
  });
