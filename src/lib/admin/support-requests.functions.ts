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

const REPLY_SELECT = "id, request_id, author_id, author_email, body, channel, created_at";

export const listSupportRequestReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("support_request_replies")
      .select(REPLY_SELECT)
      .eq("request_id", data.requestId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const sendSupportRequestReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        body: z.string().trim().min(1, "Reply cannot be empty").max(5000),
        markResolved: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { data: req, error: reqErr } = await context.supabase
      .from("support_requests")
      .select("id, user_id, name, email, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Support request not found");

    const { data: reply, error } = await context.supabase
      .from("support_request_replies")
      .insert({
        request_id: data.requestId,
        author_id: context.userId,
        author_email: context.claims?.email ?? null,
        body: data.body,
        channel: req.user_id ? "in_app" : "email",
      })
      .select(REPLY_SELECT)
      .single();
    if (error) throw new Error(error.message);

    // Deliver in-app when the requester has an account.
    if (req.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("notifications").insert({
        user_id: req.user_id,
        title: "Reply from Sweet 'n Lovely support",
        body: data.body.slice(0, 500),
        category: "account",
        data: { support_request_id: data.requestId, url: "/contact" },
        dedupe_key: `support_reply:${reply.id}`,
      });
    }

    const nextStatus = data.markResolved ? "resolved" : req.status === "new" ? "in_progress" : req.status;
    if (nextStatus !== req.status) {
      const { error: upErr } = await context.supabase
        .from("support_requests")
        .update({ status: nextStatus })
        .eq("id", data.requestId);
      if (upErr) throw new Error(upErr.message);
    }

    await logAudit(context, "support_request.reply", "support_request", data.requestId, {
      reply_id: reply.id,
      channel: reply.channel,
      status: nextStatus,
    });

    return { reply, status: nextStatus, deliveredInApp: Boolean(req.user_id), email: req.email };
  });

/**
 * Test mode: deliver a draft reply to an admin-specified address so template
 * rendering can be verified before it reaches the customer. Nothing is written
 * to support_request_replies and the request status is untouched. If the target
 * email belongs to a registered account, the draft arrives as an in-app
 * notification; otherwise the caller gets a mailto handoff.
 */
export const sendTestSupportReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        body: z.string().trim().min(1, "Draft cannot be empty").max(5000),
        testEmail: z.string().trim().email("Enter a valid email address").max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { data: req, error: reqErr } = await context.supabase
      .from("support_requests")
      .select("id, name, email")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Support request not found");

    const email = data.testEmail.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve the target account (if any) without exposing other user data.
    let targetUserId: string | null = null;
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of users?.users ?? []) {
      if ((u.email ?? "").toLowerCase() === email) {
        targetUserId = u.id;
        break;
      }
    }

    if (targetUserId) {
      const { error: notifyErr } = await supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        title: "[TEST] Support reply preview",
        body: data.body.slice(0, 500),
        category: "account",
        data: { support_request_id: data.requestId, test: true, url: "/contact" },
        dedupe_key: `support_reply_test:${data.requestId}:${Date.now()}`,
      });
      if (notifyErr) throw new Error(notifyErr.message);
    }

    await logAudit(context, "support_request.reply_test", "support_request", data.requestId, {
      test_email: email,
      delivered_in_app: Boolean(targetUserId),
      length: data.body.length,
    });

    return {
      deliveredInApp: Boolean(targetUserId),
      email,
      mailto: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
        `[TEST] Support reply preview (ref ${req.id.slice(0, 8)})`,
      )}&body=${encodeURIComponent(data.body)}`,
    };
  });
