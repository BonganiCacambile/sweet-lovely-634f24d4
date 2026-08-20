import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminScope, assertZoneAccess, logAudit } from "./server-helpers.server";

export const SUPPORT_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_customer", label: "Waiting for customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

export const SUPPORT_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

const STATUS_VALUES = SUPPORT_STATUSES.map((s) => s.value) as [string, ...string[]];
const PRIORITY_VALUES = SUPPORT_PRIORITIES.map((p) => p.value) as [string, ...string[]];

const SELECT =
  "id, reference, user_id, delivery_zone_id, name, email, phone, subject, category, order_number, message, status, priority, source, assigned_to, assigned_email, resolution, resolved_at, created_at, updated_at, delivery_zones(id, name, color)";

type ZoneRef = { id: string; name: string; color: string | null } | null;
type Row = {
  id: string;
  reference: string;
  user_id: string | null;
  delivery_zone_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  category: string;
  order_number: string | null;
  message: string;
  status: string;
  priority: string;
  source: string;
  assigned_to: string | null;
  assigned_email: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  delivery_zones?: ZoneRef;
};

export type SupportRequestDto = Omit<Row, "delivery_zones"> & {
  zone_name: string | null;
  zone_color: string | null;
};

function shape(r: Row): SupportRequestDto {
  const zone = r.delivery_zones ?? null;
  const { delivery_zones: _drop, ...rest } = r;
  return { ...rest, zone_name: zone?.name ?? null, zone_color: zone?.color ?? null };
}


export const listSupportRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        zoneId: z.string().uuid().nullable().optional().default(null),
        status: z.string().optional().default(""),
        priority: z.string().optional().default(""),
        category: z.string().optional().default(""),
        assignedTo: z.string().optional().default(""),
        from: z.string().optional().default(""),
        to: z.string().optional().default(""),
        search: z.string().optional().default(""),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(25),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);

    let q = context.supabase
      .from("support_requests")
      .select(SELECT, { count: "exact" })
      .order("created_at", { ascending: false });

    // Zone admins are hard-scoped to their own zone regardless of the filter.
    const zoneFilter = scope.isMain ? data.zoneId : scope.zoneId;
    if (zoneFilter) q = q.eq("delivery_zone_id", zoneFilter);

    if (data.status) q = q.eq("status", data.status);
    if (data.priority) q = q.eq("priority", data.priority);
    if (data.category) q = q.eq("category", data.category);
    if (data.assignedTo === "unassigned") q = q.is("assigned_to", null);
    else if (data.assignedTo) q = q.eq("assigned_to", data.assignedTo);
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59`).toISOString());
    if (data.search) {
      const s = `%${data.search.replace(/[%,]/g, "")}%`;
      q = q.or(
        `reference.ilike.${s},name.ilike.${s},email.ilike.${s},phone.ilike.${s},subject.ilike.${s},order_number.ilike.${s},message.ilike.${s}`,
      );
    }

    const from = (data.page - 1) * data.pageSize;
    q = q.range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []).map((r) => shape(r as Row)),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      scope,
    };
  });

export const getSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);
    const { data: row, error } = await context.supabase
      .from("support_requests")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Support request not found");
    await assertZoneAccess(scope, (row as Row).delivery_zone_id as string | null, context, "support request");
    return shape(row as Row);
  });

export const supportRequestStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);
    let q = context.supabase
      .from("support_requests")
      .select("status, priority, delivery_zone_id, created_at, resolved_at, delivery_zones(id, name, color)");
    if (!scope.isMain && scope.zoneId) q = q.eq("delivery_zone_id", scope.zoneId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Row[];
    const byStatus: Record<string, number> = { open: 0, in_progress: 0, waiting_customer: 0, resolved: 0, closed: 0 };
    const byPriority: Record<string, number> = { low: 0, normal: 0, high: 0, urgent: 0 };
    const zones = new Map<string, { id: string; name: string; color: string | null; total: number; open: number; highPriority: number; resolvedToday: number }>();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    let last24h = 0;

    for (const r of rows) {
      const status = String(r.status ?? "open");
      const priority = String(r.priority ?? "normal");
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      byPriority[priority] = (byPriority[priority] ?? 0) + 1;
      if (new Date(String(r.created_at)).getTime() >= dayAgo) last24h += 1;

      const z = r.delivery_zones ?? null;
      const key = (r.delivery_zone_id as string | null) ?? "unassigned";
      const entry =
        zones.get(key) ??
        { id: key, name: z?.name ?? "No zone", color: z?.color ?? null, total: 0, open: 0, highPriority: 0, resolvedToday: 0 };
      entry.total += 1;
      if (status === "open" || status === "in_progress" || status === "waiting_customer") entry.open += 1;
      if (priority === "high" || priority === "urgent") entry.highPriority += 1;
      if (r.resolved_at && new Date(String(r.resolved_at)) >= startOfToday) entry.resolvedToday += 1;
      zones.set(key, entry);
    }

    return {
      total: rows.length,
      last24h,
      byStatus,
      byPriority,
      openTotal: byStatus.open + byStatus.in_progress + byStatus.waiting_customer,
      highPriorityTotal: byPriority.high + byPriority.urgent,
      byZone: Array.from(zones.values()).sort((a, b) => b.total - a.total),
      scope,
    };
  });

async function loadScoped(context: { supabase: never } | { supabase: ReturnType<typeof Object> } | any, id: string) {
  const { data, error } = await context.supabase
    .from("support_requests")
    .select("id, reference, status, priority, delivery_zone_id, assigned_to, user_id, email, name")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Support request not found");
  return data as Record<string, unknown>;
}

async function recordEvent(
  context: any,
  requestId: string,
  field: string,
  fromValue: string | null,
  toValue: string | null,
) {
  await context.supabase.from("support_request_events").insert({
    request_id: requestId,
    actor_id: context.userId,
    actor_email: (context.claims?.email as string | undefined) ?? null,
    field,
    from_value: fromValue,
    to_value: toValue,
  });
}

export const updateSupportRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(STATUS_VALUES), resolution: z.string().trim().max(2000).optional().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);
    const row = await loadScoped(context, data.id);
    await assertZoneAccess(scope, row.delivery_zone_id as string | null, context, "support request");

    const patch: Record<string, unknown> = { status: data.status };
    if (data.resolution) patch.resolution = data.resolution;
    if (data.status === "resolved" || data.status === "closed") patch.resolved_at = new Date().toISOString();
    else patch.resolved_at = null;

    const { error } = await context.supabase.from("support_requests").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordEvent(context, data.id, "status", String(row.status), data.status);
    await logAudit(context, "support_request.status", "support_request", data.id, {
      from: row.status, to: data.status, zone_id: row.delivery_zone_id,
    });
    return { ok: true };
  });

export const updateSupportRequestPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), priority: z.enum(PRIORITY_VALUES) }).parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);
    const row = await loadScoped(context, data.id);
    await assertZoneAccess(scope, row.delivery_zone_id as string | null, context, "support request");
    const { error } = await context.supabase
      .from("support_requests")
      .update({ priority: data.priority })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordEvent(context, data.id, "priority", String(row.priority), data.priority);
    await logAudit(context, "support_request.priority", "support_request", data.id, {
      from: row.priority, to: data.priority, zone_id: row.delivery_zone_id,
    });
    return { ok: true };
  });

/** Employees that may be assigned to a request in the given zone. */
export const listAssignableEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ zoneId: z.string().uuid().nullable().optional().default(null) }).parse(d))
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);
    const zoneId = scope.isMain ? data.zoneId : scope.zoneId;
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role, assigned_zone_id");
    if (error) throw new Error(error.message);
    const candidates = (roles ?? []).filter(
      (r) => r.role === "admin" || (r.assigned_zone_id && (!zoneId || r.assigned_zone_id === zoneId)),
    );
    const ids = Array.from(new Set(candidates.map((r) => r.user_id as string)));
    if (ids.length === 0) return { rows: [] };
    const { data: profiles } = await context.supabase.from("profiles").select("id, full_name").in("id", ids);
    const { findEmailsByUserIds } = await import("@/lib/admin/user-lookup.server");
    const emails = await findEmailsByUserIds(ids);
    return {
      rows: ids.map((id) => {
        const role = candidates.find((c) => c.user_id === id)!;
        return {
          id,
          name: (profiles ?? []).find((p) => p.id === id)?.full_name || emails[id] || "Employee",
          email: emails[id] ?? null,
          isMainAdmin: role.role === "admin",
          zoneId: (role.assigned_zone_id as string | null) ?? null,
        };
      }),
    };
  });

export const assignSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), assigneeId: z.string().uuid().nullable(), override: z.boolean().optional().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);
    const row = await loadScoped(context, data.id);
    await assertZoneAccess(scope, row.delivery_zone_id as string | null, context, "support request");

    let email: string | null = null;
    if (data.assigneeId) {
      const { data: roles, error } = await context.supabase
        .from("user_roles")
        .select("user_id, role, assigned_zone_id")
        .eq("user_id", data.assigneeId);
      if (error) throw new Error(error.message);
      const rows = roles ?? [];
      if (rows.length === 0) throw new Error("That user is not an employee");
      const isMainAdmin = rows.some((r) => r.role === "admin");
      const inZone = rows.some((r) => r.assigned_zone_id && r.assigned_zone_id === row.delivery_zone_id);
      // Zone employees may only take requests inside their own zone; a main
      // admin can explicitly override that for cross-zone escalation.
      if (!isMainAdmin && !inZone && !(scope.isMain && data.override)) {
        throw new Error("That employee is not assigned to this request's delivery zone");
      }
      const { findEmailsByUserIds } = await import("@/lib/admin/user-lookup.server");
      email = (await findEmailsByUserIds([data.assigneeId]))[data.assigneeId] ?? null;
    }

    const { error: upErr } = await context.supabase
      .from("support_requests")
      .update({ assigned_to: data.assigneeId, assigned_email: email })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    await recordEvent(context, data.id, "assignment", (row.assigned_to as string | null) ?? null, data.assigneeId);
    await logAudit(context, "support_request.assign", "support_request", data.id, {
      assignee: data.assigneeId, override: data.override, zone_id: row.delivery_zone_id,
    });

    if (data.assigneeId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("notifications").insert({
        user_id: data.assigneeId,
        title: "Support request assigned to you",
        body: `${row.reference}: ${row.name ?? "Customer"}`,
        category: "account",
        data: { support_request_id: data.id, url: "/admin/support-requests" },
        dedupe_key: `support_assign:${data.id}:${data.assigneeId}`,
      });
    }
    return { ok: true };
  });

export const listSupportRequestEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminScope(context.supabase, context.userId, context.claims);
    const { data: rows, error } = await context.supabase
      .from("support_request_events")
      .select("id, actor_email, field, from_value, to_value, created_at")
      .eq("request_id", data.requestId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const REPLY_SELECT = "id, request_id, author_id, author_email, body, channel, is_internal, created_at";

export const listSupportRequestReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminScope(context.supabase, context.userId, context.claims);
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
        internal: z.boolean().optional().default(false),
        markResolved: z.boolean().optional().default(false),
        templateId: z.string().trim().max(120).optional().default(""),
        templateLabel: z.string().trim().max(120).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);

    const { data: req, error: reqErr } = await context.supabase
      .from("support_requests")
      .select("id, reference, user_id, name, email, status, delivery_zone_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Support request not found");
    await assertZoneAccess(scope, req.delivery_zone_id as string | null, context, "support request");

    // Older rows (and guest submissions later matched to an account) may have
    // no user_id; resolve it from the email so replies can land in-app.
    let recipientId = req.user_id as string | null;
    if (!recipientId && req.email) {
      const { findUserIdByEmail } = await import("@/lib/admin/user-lookup.server");
      recipientId = await findUserIdByEmail(req.email);
      if (recipientId) {
        await context.supabase.from("support_requests").update({ user_id: recipientId }).eq("id", data.requestId);
      }
    }

    const { data: reply, error } = await context.supabase
      .from("support_request_replies")
      .insert({
        request_id: data.requestId,
        author_id: context.userId,
        author_email: context.claims?.email ?? null,
        body: data.body,
        is_internal: data.internal,
        channel: data.internal ? "internal" : recipientId ? "in_app" : "email",
      })
      .select(REPLY_SELECT)
      .single();
    if (error) throw new Error(error.message);

    // Internal notes are never delivered to the customer.
    if (!data.internal && recipientId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("notifications").insert({
        user_id: recipientId,
        title: "Reply from Sweet 'n Lovely support",
        body: data.body.slice(0, 500),
        category: "account",
        data: { support_request_id: data.requestId, url: "/account/support" },
        dedupe_key: `support_reply:${reply.id}`,
      });
    }

    let nextStatus = req.status as string;
    if (!data.internal) {
      nextStatus = data.markResolved ? "resolved" : req.status === "open" || req.status === "new" ? "in_progress" : (req.status as string);
    }
    if (nextStatus !== req.status) {
      const { error: upErr } = await context.supabase
        .from("support_requests")
        .update({
          status: nextStatus,
          resolved_at: nextStatus === "resolved" ? new Date().toISOString() : null,
        })
        .eq("id", data.requestId);
      if (upErr) throw new Error(upErr.message);
      await recordEvent(context, data.requestId, "status", String(req.status), nextStatus);
    }

    await logAudit(context, data.internal ? "support_request.note" : "support_request.reply", "support_request", data.requestId, {
      reply_id: reply.id,
      channel: reply.channel,
      internal: data.internal,
      status: nextStatus,
      zone_id: req.delivery_zone_id,
      template_id: data.templateId || null,
      template_label: data.templateLabel || null,
      length: data.body.length,
    });

    return { reply, status: nextStatus, deliveredInApp: Boolean(recipientId) && !data.internal, email: req.email };
  });

/**
 * Test mode: deliver a draft reply to an admin-specified address so template
 * rendering can be verified before it reaches the customer. Nothing is written
 * to support_request_replies and the request status is untouched.
 */
export const sendTestSupportReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        body: z.string().trim().min(1, "Draft cannot be empty").max(5000),
        testEmail: z.string().trim().email("Enter a valid email address").max(200),
        templateId: z.string().trim().max(120).optional().default(""),
        templateLabel: z.string().trim().max(120).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);

    const { data: req, error: reqErr } = await context.supabase
      .from("support_requests")
      .select("id, name, email, delivery_zone_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Support request not found");
    await assertZoneAccess(scope, req.delivery_zone_id as string | null, context, "support request");

    const email = data.testEmail.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findUserIdByEmail } = await import("@/lib/admin/user-lookup.server");
    const targetUserId = await findUserIdByEmail(email);

    if (targetUserId) {
      const { error: notifyErr } = await supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        title: "[TEST] Support reply preview",
        body: data.body.slice(0, 500),
        category: "account",
        data: { support_request_id: data.requestId, test: true, url: "/account/support" },
        dedupe_key: `support_reply_test:${data.requestId}:${Date.now()}`,
      });
      if (notifyErr) throw new Error(notifyErr.message);
    }

    await logAudit(context, "support_request.reply_test", "support_request", data.requestId, {
      test_email: email,
      delivered_in_app: Boolean(targetUserId),
      length: data.body.length,
      template_id: data.templateId || null,
      template_label: data.templateLabel || null,
      preview_body: data.body.slice(0, 5000),
    });

    return {
      deliveredInApp: Boolean(targetUserId),
      email,
      mailto: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
        `[TEST] Support reply preview (ref ${req.id.slice(0, 8)})`,
      )}&body=${encodeURIComponent(data.body)}`,
    };
  });
