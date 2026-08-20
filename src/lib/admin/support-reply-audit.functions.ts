import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";
import { fetchReplyAudit, replyAuditToCsv } from "./support-reply-audit.server";
export type { ReplyAuditRow } from "./support-reply-audit.server";

const filters = {
  kind: z.enum(["", "sent", "test"]).optional().default(""),
  search: z.string().trim().optional().default(""),
  template: z.string().trim().optional().default(""),
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
};

export const listSupportReplyAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ...filters,
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(25),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { rows, total } = await fetchReplyAudit(context.supabase, {
      kind: data.kind,
      search: data.search,
      template: data.template,
      from: data.from,
      to: data.to,
      offset: (data.page - 1) * data.pageSize,
      limit: data.pageSize,
    });
    return { rows, total, page: data.page, pageSize: data.pageSize };
  });

/** One-click CSV export of the currently filtered audit results (max 5000 rows). */
export const exportSupportReplyAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object(filters).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const limit = 5000;
    const { rows, total } = await fetchReplyAudit(context.supabase, {
      kind: data.kind,
      search: data.search,
      template: data.template,
      from: data.from,
      to: data.to,
      offset: 0,
      limit,
    });
    await logAudit(context, "support_reply_audit.export", "audit_logs", null, {
      rows: rows.length,
      total,
      filters: data,
    });
    const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
    return {
      csv: replyAuditToCsv(rows),
      filename: `reply-audit-${stamp}.csv`,
      rows: rows.length,
      total,
      truncated: total > rows.length,
    };
  });
