import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./server-helpers.server";

export type ReplyAuditRow = {
  id: string;
  created_at: string;
  kind: "sent" | "test";
  actor_email: string | null;
  request_id: string;
  request_name: string | null;
  request_email: string | null;
  target_email: string | null;
  channel: string | null;
  status: string | null;
  delivered_in_app: boolean | null;
  body: string | null;
};

export const listSupportReplyAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["", "sent", "test"]).optional().default(""),
        search: z.string().trim().optional().default(""),
        from: z.string().optional().default(""),
        to: z.string().optional().default(""),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(25),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const actions =
      data.kind === "sent"
        ? ["support_request.reply"]
        : data.kind === "test"
          ? ["support_request.reply_test"]
          : ["support_request.reply", "support_request.reply_test"];

    // Resolve matching support requests so search can hit customer name/email too.
    let matchedRequestIds: string[] | null = null;
    if (data.search) {
      const s = `%${data.search}%`;
      const { data: reqs, error: reqErr } = await context.supabase
        .from("support_requests")
        .select("id")
        .or(`name.ilike.${s},email.ilike.${s}`)
        .limit(500);
      if (reqErr) throw new Error(reqErr.message);
      matchedRequestIds = (reqs ?? []).map((r) => r.id);
    }

    let q = context.supabase
      .from("audit_logs")
      .select("id, created_at, action, actor_email, entity_id, metadata", { count: "exact" })
      .in("action", actions)
      .order("created_at", { ascending: false });

    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59.999Z`).toISOString());

    if (data.search) {
      const s = `%${data.search}%`;
      const clauses = [
        `actor_email.ilike.${s}`,
        `entity_id.ilike.${s}`,
        `metadata->>test_email.ilike.${s}`,
      ];
      if (matchedRequestIds && matchedRequestIds.length > 0) {
        clauses.push(`entity_id.in.(${matchedRequestIds.join(",")})`);
      }
      q = q.or(clauses.join(","));
    }

    const fromIdx = (data.page - 1) * data.pageSize;
    const { data: logs, error, count } = await q.range(fromIdx, fromIdx + data.pageSize - 1);
    if (error) throw new Error(error.message);

    const requestIds = [...new Set((logs ?? []).map((l) => l.entity_id).filter(Boolean) as string[])];
    const replyIds = [
      ...new Set(
        (logs ?? [])
          .map((l) => (l.metadata as Record<string, unknown> | null)?.["reply_id"])
          .filter((v): v is string => typeof v === "string"),
      ),
    ];

    const requestMap = new Map<string, { name: string; email: string }>();
    if (requestIds.length > 0) {
      const { data: reqs } = await context.supabase
        .from("support_requests")
        .select("id, name, email")
        .in("id", requestIds);
      for (const r of reqs ?? []) requestMap.set(r.id, { name: r.name, email: r.email });
    }

    const bodyMap = new Map<string, string>();
    if (replyIds.length > 0) {
      const { data: replies } = await context.supabase
        .from("support_request_replies")
        .select("id, body")
        .in("id", replyIds);
      for (const r of replies ?? []) bodyMap.set(r.id, r.body);
    }

    const rows: ReplyAuditRow[] = (logs ?? []).map((l) => {
      const meta = (l.metadata ?? {}) as Record<string, unknown>;
      const isTest = l.action === "support_request.reply_test";
      const requestId = l.entity_id ?? "";
      const req = requestMap.get(requestId);
      const replyId = typeof meta["reply_id"] === "string" ? (meta["reply_id"] as string) : null;
      return {
        id: l.id,
        created_at: l.created_at,
        kind: isTest ? "test" : "sent",
        actor_email: l.actor_email,
        request_id: requestId,
        request_name: req?.name ?? null,
        request_email: req?.email ?? null,
        target_email: isTest
          ? ((meta["test_email"] as string | undefined) ?? null)
          : (req?.email ?? null),
        channel: (meta["channel"] as string | undefined) ?? null,
        status: (meta["status"] as string | undefined) ?? null,
        delivered_in_app:
          typeof meta["delivered_in_app"] === "boolean" ? (meta["delivered_in_app"] as boolean) : null,
        body: replyId ? (bodyMap.get(replyId) ?? null) : null,
      };
    });

    return { rows, total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });
