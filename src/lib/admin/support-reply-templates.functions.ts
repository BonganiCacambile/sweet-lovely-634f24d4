import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, logAudit } from "./server-helpers.server";

const SELECT = "id, label, description, body, sort_order, is_active, created_at, updated_at";

export const listSupportReplyTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ includeDisabled: z.boolean().optional().default(false) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("support_reply_templates")
      .select(SELECT)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!data.includeDisabled) q = q.eq("is_active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const upsertSupportReplyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        label: z.string().trim().min(2).max(80),
        description: z.string().trim().max(200).optional().default(""),
        body: z.string().trim().min(5).max(5000),
        is_active: z.boolean().optional().default(true),
        sort_order: z.number().int().min(0).max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const payload = {
      label: data.label,
      description: data.description || null,
      body: data.body,
      is_active: data.is_active,
      ...(data.sort_order === undefined ? {} : { sort_order: data.sort_order }),
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("support_reply_templates")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context, "support_reply_template.update", "support_reply_template", data.id, {
        label: data.label,
      });
      return { ok: true, id: data.id };
    }

    let nextOrder = data.sort_order;
    if (nextOrder === undefined) {
      const { data: last } = await context.supabase
        .from("support_reply_templates")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      nextOrder = (last?.sort_order ?? 0) + 10;
    }
    const { data: row, error } = await context.supabase
      .from("support_reply_templates")
      .insert({ ...payload, sort_order: nextOrder, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(context, "support_reply_template.create", "support_reply_template", row.id, {
      label: data.label,
    });
    return { ok: true, id: row.id };
  });

export const setSupportReplyTemplateActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("support_reply_templates")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "support_reply_template.active", "support_reply_template", data.id, {
      is_active: data.is_active,
    });
    return { ok: true };
  });

export const deleteSupportReplyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("support_reply_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "support_reply_template.delete", "support_reply_template", data.id, {});
    return { ok: true };
  });

export const reorderSupportReplyTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let i = 0;
    for (const id of data.ids) {
      i += 10;
      const { error } = await context.supabase
        .from("support_reply_templates")
        .update({ sort_order: i })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }
    await logAudit(context, "support_reply_template.reorder", "support_reply_template", null, {
      count: data.ids.length,
    });
    return { ok: true };
  });
