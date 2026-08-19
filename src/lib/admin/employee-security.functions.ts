import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminScope, requireMainAdmin, logAudit } from "./server-helpers.server";
import {
  loadSecurityConfig,
  recordSecurityEvent,
  recordExport,
  requireRecentAuth,
} from "./security-core.server";

/** Client-visible security posture for the signed-in employee. */
export const getSecurityPosture = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);
    const cfg = await loadSecurityConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sec } = await supabaseAdmin
      .from("employee_security")
      .select("mfa_exempt, is_disabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: factors } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: context.userId });
    const mfaEnrolled = (factors?.factors ?? []).some((f) => f.status === "verified");
    return {
      isMain: scope.isMain,
      zoneId: scope.zoneId,
      email: (context.claims?.email as string | undefined) ?? null,
      idleTimeoutMinutes: cfg.idleTimeoutMinutes,
      maxSessionHours: cfg.maxSessionHours,
      enforceMfa: cfg.enforceMfa,
      mfaExempt: Boolean(sec?.mfa_exempt),
      mfaEnrolled,
      mfaSatisfied: context.claims?.aal === "aal2",
      mfaRequired: cfg.enforceMfa && !sec?.mfa_exempt,
    };
  });

/** Main-admin view of employees, alerts and exports. */
export const securityCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMainAdmin(context.supabase, context.userId, context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [rolesRes, secRes, alertsRes, exportsRes, presenceRes, zonesRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role, assigned_zone_id"),
      supabaseAdmin.from("employee_security").select("user_id, is_disabled, mfa_exempt, sessions_revoked_at"),
      supabaseAdmin
        .from("security_alerts")
        .select("id, severity, type, actor_email, zone_id, message, created_at, acknowledged_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("data_export_logs")
        .select("id, actor_email, entity, format, row_count, zone_id, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin.from("admin_presence").select("user_id, status, last_active_at, assigned_zone_id"),
      supabaseAdmin.from("delivery_zones").select("id, name"),
    ]);

    const roleRows = (rolesRes.data ?? []).filter((r) => r.role === "admin" || r.assigned_zone_id);
    const profileIds = [...new Set(roleRows.map((r) => r.user_id))];
    const { data: profiles } = profileIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const zoneName = new Map((zonesRes.data ?? []).map((z) => [z.id, z.name]));
    const secByUser = new Map((secRes.data ?? []).map((s) => [s.user_id, s]));
    const presenceByUser = new Map((presenceRes.data ?? []).map((p) => [p.user_id, p]));

    const employees = roleRows.map((r) => {
      const s = secByUser.get(r.user_id);
      const p = presenceByUser.get(r.user_id);
      return {
        userId: r.user_id,
        name: (profiles ?? []).find((x) => x.id === r.user_id)?.full_name ?? null,
        role: r.role as string,
        zoneId: r.assigned_zone_id as string | null,
        zoneName: r.assigned_zone_id ? (zoneName.get(r.assigned_zone_id) ?? null) : null,
        isDisabled: Boolean(s?.is_disabled),
        mfaExempt: Boolean(s?.mfa_exempt),
        sessionsRevokedAt: (s?.sessions_revoked_at as string | null) ?? null,
        presence: (p?.status as string | null) ?? "offline",
        lastActiveAt: (p?.last_active_at as string | null) ?? null,
      };
    });

    return {
      employees,
      alerts: alertsRes.data ?? [],
      exports: exportsRes.data ?? [],
      config: await loadSecurityConfig(),
    };
  });

export const setEmployeeDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), disabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireMainAdmin(context.supabase, context.userId, context.claims);
    if (data.userId === context.userId) throw new Error("You cannot disable your own account");
    await requireRecentAuth(context.userId, context.claims, "employee.disable");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employee_security")
      .upsert(
        {
          user_id: data.userId,
          is_disabled: data.disabled,
          ...(data.disabled ? { sessions_revoked_at: new Date().toISOString() } : {}),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    if (data.disabled) await supabaseAdmin.auth.admin.signOut(data.userId).catch(() => undefined);
    await recordSecurityEvent({
      userId: context.userId,
      email: context.claims?.email as string | undefined,
      type: data.disabled ? "employee_disabled" : "employee_enabled",
      severity: data.disabled ? "high" : "low",
      message: `Employee ${data.userId} ${data.disabled ? "disabled" : "re-enabled"}`,
      metadata: { target_user_id: data.userId },
    });
    await logAudit(context, "employee.access_change", "employee_security", data.userId, {
      disabled: data.disabled,
    });
    return { ok: true };
  });

export const revokeEmployeeSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireMainAdmin(context.supabase, context.userId, context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employee_security")
      .upsert({ user_id: data.userId, sessions_revoked_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.auth.admin.signOut(data.userId).catch(() => undefined);
    await recordSecurityEvent({
      userId: context.userId,
      email: context.claims?.email as string | undefined,
      type: "employee_sessions_revoked",
      severity: "medium",
      message: `All sessions revoked for employee ${data.userId}`,
      metadata: { target_user_id: data.userId },
    });
    await logAudit(context, "employee.sessions_revoked", "employee_security", data.userId, {});
    return { ok: true };
  });

export const setEmployeeMfaExempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), exempt: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireMainAdmin(context.supabase, context.userId, context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employee_security")
      .upsert({ user_id: data.userId, mfa_exempt: data.exempt }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    await recordSecurityEvent({
      userId: context.userId,
      email: context.claims?.email as string | undefined,
      type: "employee_mfa_exemption_changed",
      severity: data.exempt ? "high" : "low",
      message: `MFA exemption ${data.exempt ? "granted to" : "removed from"} ${data.userId}`,
      metadata: { target_user_id: data.userId, exempt: data.exempt },
    });
    await logAudit(context, "employee.mfa_exempt", "employee_security", data.userId, { exempt: data.exempt });
    return { ok: true };
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireMainAdmin(context.supabase, context.userId, context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("security_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Called by the admin UI before a data export is written to disk. */
export const logDataExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        entity: z.string().min(1).max(64),
        format: z.enum(["csv", "xlsx", "pdf"]),
        rowCount: z.number().int().min(0),
        fields: z.array(z.string()).max(100).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const scope = await requireAdminScope(context.supabase, context.userId, context.claims);
    return recordExport({
      userId: context.userId,
      email: context.claims?.email as string | undefined,
      zoneId: scope.zoneId,
      isMain: scope.isMain,
      entity: data.entity,
      format: data.format,
      rowCount: data.rowCount,
      fields: data.fields,
    });
  });
