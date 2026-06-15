import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./server-helpers.server";

const listInput = z.object({
  search: z.string().optional().default(""),
  action: z.string().optional().default(""),
  entity: z.string().optional().default(""),
  fromDate: z.string().optional().default(""),
  toDate: z.string().optional().default(""),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(500).optional().default(50),
});

export const listAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { search, action, entity, fromDate, toDate, page, pageSize } = data;
    let q = context.supabase
      .from("audit_logs")
      .select("id, actor_id, actor_email, action, entity, entity_id, metadata, created_at", { count: "exact" });
    if (action) q = q.eq("action", action);
    if (entity) q = q.eq("entity", entity);
    if (fromDate) q = q.gte("created_at", fromDate);
    if (toDate) q = q.lte("created_at", toDate);
    if (search) {
      const s = `%${search}%`;
      q = q.or(`actor_email.ilike.${s},action.ilike.${s},entity.ilike.${s},entity_id.ilike.${s}`);
    }
    const from = (page - 1) * pageSize;
    q = q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page, pageSize };
  });

export const auditFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("action, entity")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const actions = new Set<string>();
    const entities = new Set<string>();
    for (const r of data ?? []) {
      if (r.action) actions.add(r.action);
      if (r.entity) entities.add(r.entity);
    }
    return { actions: Array.from(actions).sort(), entities: Array.from(entities).sort() };
  });