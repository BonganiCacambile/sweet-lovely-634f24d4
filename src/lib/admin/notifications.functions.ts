import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./server-helpers.server";
import { logAudit } from "./server-helpers.server";

const listInput = z.object({
  search: z.string().optional().default(""),
  category: z.string().optional().default(""),
  read: z.enum(["all", "unread", "read"]).optional().default("all"),
  fromDate: z.string().optional().default(""),
  toDate: z.string().optional().default(""),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(50),
});

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("notifications")
      .select("id, user_id, title, body, category, read, created_at", { count: "exact" });
    if (data.category) q = q.eq("category", data.category);
    if (data.read === "unread") q = q.eq("read", false);
    if (data.read === "read") q = q.eq("read", true);
    if (data.fromDate) q = q.gte("created_at", data.fromDate);
    if (data.toDate) q = q.lte("created_at", data.toDate);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`title.ilike.${s},body.ilike.${s}`);
    }
    const from = (data.page - 1) * data.pageSize;
    q = q.order("created_at", { ascending: false }).range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const notificationStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const [{ count: total }, { count: unread }, { data: cats }] = await Promise.all([
      sb.from("notifications").select("id", { count: "exact", head: true }),
      sb.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
      sb.from("notifications").select("category").limit(1000),
    ]);
    const categories = Array.from(new Set((cats ?? []).map(c => c.category as string))).sort();
    return { total: total ?? 0, unread: unread ?? 0, categories };
  });

const markInput = z.object({ ids: z.array(z.string().uuid()).min(1), read: z.boolean() });
export const markNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => markInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notifications").update({ read: data.read }).in("id", data.ids);
    if (error) throw new Error(error.message);
    await logAudit(context, "notifications.mark", "notification", null, { count: data.ids.length, read: data.read });
    return { ok: true };
  });

const deleteInput = z.object({ ids: z.array(z.string().uuid()).min(1) });
export const deleteNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notifications").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    await logAudit(context, "notifications.delete", "notification", null, { count: data.ids.length });
    return { ok: true };
  });

const broadcastInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional().default(""),
  category: z.string().min(1).max(50).default("general"),
  audience: z.enum(["all", "admins", "user"]).default("all"),
  userId: z.string().uuid().optional(),
});
export const broadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => broadcastInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let targetIds: string[] = [];
    if (data.audience === "user") {
      if (!data.userId) throw new Error("userId required for single-user broadcast");
      targetIds = [data.userId];
    } else if (data.audience === "admins") {
      const { data: rows, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
      if (error) throw new Error(error.message);
      targetIds = Array.from(new Set((rows ?? []).map(r => r.user_id as string)));
    } else {
      const { data: rows, error } = await supabaseAdmin.from("profiles").select("id");
      if (error) throw new Error(error.message);
      targetIds = (rows ?? []).map(r => r.id as string);
    }
    if (!targetIds.length) throw new Error("No recipients matched the audience");

    const payload = targetIds.map(uid => ({
      user_id: uid, title: data.title, body: data.body || null, category: data.category, read: false,
    }));
    // Insert in chunks to keep payloads small
    const chunk = 500;
    for (let i = 0; i < payload.length; i += chunk) {
      const { error } = await supabaseAdmin.from("notifications").insert(payload.slice(i, i + chunk));
      if (error) throw new Error(error.message);
    }
    await logAudit(context, "notifications.broadcast", "notification", null, {
      audience: data.audience, recipients: targetIds.length, category: data.category, title: data.title,
    });
    return { ok: true, sent: targetIds.length };
  });
