import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const SELECT = "id, name, email, phone, message, status, source, created_at, updated_at";

export const listSupportRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["", "new", "in_progress", "resolved", "archived"]).optional().default(""),
        search: z.string().optional().default(""),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(25),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("support_requests")
      .select(SELECT, { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s},message.ilike.${s}`);
    }
    const from = (data.page - 1) * data.pageSize;
    q = q.range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const supportRequestStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("support_requests").select("status, created_at");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const byStatus: Record<string, number> = { new: 0, in_progress: 0, resolved: 0, archived: 0 };
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    let last24h = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (new Date(r.created_at).getTime() >= dayAgo) last24h += 1;
    }
    return { total: rows.length, byStatus, last24h };
  });

export const updateSupportRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "in_progress", "resolved", "archived"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("support_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "support_request.status", "support_request", data.id, { status: data.status });
    return { ok: true };
  });
