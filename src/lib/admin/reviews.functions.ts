import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

export const listReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["", "pending", "approved", "rejected"]).optional().default(""),
        search: z.string().optional().default(""),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(25),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("reviews")
      .select("id, product_slug, author_name, rating, comment, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status as never);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`author_name.ilike.${s},comment.ilike.${s},product_slug.ilike.${s}`);
    }
    const from = (data.page - 1) * data.pageSize;
    q = q.range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const moderateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected", "pending"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("reviews")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "review.moderate", "review", data.id, { status: data.status });
    return { ok: true };
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "review.delete", "review", data.id);
    return { ok: true };
  });

export const reviewStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("reviews").select("rating, status, product_slug");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const byStatus: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    let sumRating = 0; let count = 0;
    const byProduct: Record<string, { count: number; sum: number }> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status === "approved") { sumRating += r.rating; count += 1; }
      if (r.product_slug) {
        const cur = byProduct[r.product_slug] ?? { count: 0, sum: 0 };
        cur.count += 1; cur.sum += r.rating;
        byProduct[r.product_slug] = cur;
      }
    }
    return { total: rows.length, byStatus, avgRating: count ? sumRating / count : 0, byProduct };
  });