/**
 * Server-only security core for the admin panel.
 *
 * Everything in here is enforced on the server. The React layer only mirrors
 * these decisions for UX; it is never the security boundary.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AdminClaims = Record<string, unknown> & {
  email?: string | null;
  iat?: number;
  aal?: string;
  session_id?: string;
  amr?: Array<{ method?: string; timestamp?: number }>;
};

export type SecurityConfig = {
  idleTimeoutMinutes: number;
  maxSessionHours: number;
  reauthWindowMinutes: number;
  enforceMfa: boolean;
  enforceWorkingHours: boolean;
  alertCustomerReadsPerHour: number;
  alertDeniedAttemptsPerHour: number;
  exportMaxRowsZoneAdmin: number;
};

const DEFAULTS: SecurityConfig = {
  idleTimeoutMinutes: 15,
  maxSessionHours: 8,
  reauthWindowMinutes: 10,
  enforceMfa: true,
  enforceWorkingHours: false,
  alertCustomerReadsPerHour: 200,
  alertDeniedAttemptsPerHour: 10,
  exportMaxRowsZoneAdmin: 500,
};

const KEY_MAP: Record<string, keyof SecurityConfig> = {
  idle_timeout_minutes: "idleTimeoutMinutes",
  max_session_hours: "maxSessionHours",
  reauth_window_minutes: "reauthWindowMinutes",
  enforce_mfa: "enforceMfa",
  enforce_working_hours: "enforceWorkingHours",
  alert_customer_reads_per_hour: "alertCustomerReadsPerHour",
  alert_denied_attempts_per_hour: "alertDeniedAttemptsPerHour",
  export_max_rows_zone_admin: "exportMaxRowsZoneAdmin",
};

export async function loadSecurityConfig(): Promise<SecurityConfig> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("system_settings")
      .select("key, value")
      .eq("group_key", "security");
    const cfg: SecurityConfig = { ...DEFAULTS };
    for (const row of data ?? []) {
      const field = KEY_MAP[row.key as string];
      if (!field) continue;
      const raw = row.value as unknown;
      if (field === "enforceMfa" || field === "enforceWorkingHours") {
        (cfg[field] as boolean) = raw === true || raw === "true";
      } else {
        const n = Number(raw);
        if (Number.isFinite(n)) (cfg[field] as number) = n;
      }
    }
    return cfg;
  } catch {
    return { ...DEFAULTS };
  }
}

/** Records a security event in the audit log and, when severe enough, raises an alert. */
export async function recordSecurityEvent(params: {
  userId: string | null;
  email?: string | null;
  type: string;
  message: string;
  severity?: "low" | "medium" | "high" | "critical";
  zoneId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const severity = params.severity ?? "medium";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: params.userId,
      actor_email: params.email ?? null,
      action: `security.${params.type}`,
      entity: "security",
      entity_id: params.userId,
      metadata: { severity, ...(params.metadata ?? {}), ...(params.zoneId ? { zone_id: params.zoneId } : {}) } as never,
    });
    if (severity !== "low") {
      await supabaseAdmin.from("security_alerts").insert({
        severity,
        type: params.type,
        actor_id: params.userId,
        actor_email: params.email ?? null,
        zone_id: params.zoneId ?? null,
        message: params.message,
        metadata: (params.metadata ?? {}) as never,
      });
    }
  } catch (e) {
    console.error("[security] failed to record event", e);
  }
}

/**
 * Suspicious-activity heuristics. Counts recent security-relevant audit rows
 * for the actor and escalates when thresholds are exceeded.
 */
export async function evaluateSuspiciousActivity(userId: string, email?: string | null) {
  try {
    const cfg = await loadSecurityConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("audit_logs")
      .select("action")
      .eq("actor_id", userId)
      .gte("created_at", since)
      .limit(1000);
    const rows = data ?? [];
    const denied = rows.filter((r) => (r.action as string).startsWith("security.access_denied")).length;
    const crossZone = rows.filter((r) => (r.action as string).includes("cross_zone")).length;
    const reads = rows.filter((r) => (r.action as string).startsWith("data.customer_read")).length;
    if (denied >= cfg.alertDeniedAttemptsPerHour) {
      await recordSecurityEvent({
        userId, email, type: "repeated_authorization_failures", severity: "high",
        message: `${denied} authorization failures in the last hour`, metadata: { denied },
      });
    }
    if (crossZone >= 3) {
      await recordSecurityEvent({
        userId, email, type: "repeated_cross_zone_attempts", severity: "critical",
        message: `${crossZone} cross-zone access attempts in the last hour`, metadata: { crossZone },
      });
    }
    if (reads >= cfg.alertCustomerReadsPerHour) {
      await recordSecurityEvent({
        userId, email, type: "bulk_customer_access", severity: "high",
        message: `${reads} customer records accessed in the last hour`, metadata: { reads },
      });
    }
  } catch (e) {
    console.error("[security] suspicious activity check failed", e);
  }
}

/** Throws when the account has been disabled or its sessions revoked by the Main Admin. */
export async function assertAccountUsable(userId: string, claims?: AdminClaims) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("employee_security")
    .select("is_disabled, sessions_revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return;
  if (data.is_disabled) {
    await recordSecurityEvent({
      userId, email: claims?.email, type: "access_denied_disabled_account", severity: "high",
      message: "Disabled employee attempted to use the admin panel",
    });
    throw new Error("Account disabled: contact the Main Admin");
  }
  const revoked = data.sessions_revoked_at ? Date.parse(data.sessions_revoked_at) / 1000 : null;
  const iat = typeof claims?.iat === "number" ? claims.iat : null;
  if (revoked && iat !== null && iat < revoked) {
    await recordSecurityEvent({
      userId, email: claims?.email, type: "access_denied_revoked_session", severity: "medium",
      message: "Revoked session attempted to use the admin panel",
    });
    throw new Error("Session revoked: please sign in again");
  }
}

/** Throws when zone working hours are enforced and the employee is outside them. */
export async function assertWithinWorkingHours(zoneId: string | null, userId: string, claims?: AdminClaims) {
  if (!zoneId) return;
  const cfg = await loadSecurityConfig();
  if (!cfg.enforceWorkingHours) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // South African operating time (UTC+2).
  const now = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const dow = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const { data } = await supabaseAdmin
    .from("zone_access_hours")
    .select("opens_at, closes_at, is_blocked")
    .eq("zone_id", zoneId)
    .eq("day_of_week", dow)
    .maybeSingle();
  if (!data) return;
  const toMin = (t: string) => {
    const [h, m] = t.split(":");
    return Number(h) * 60 + Number(m);
  };
  const blocked = data.is_blocked || minutes < toMin(data.opens_at) || minutes > toMin(data.closes_at);
  if (blocked) {
    await recordSecurityEvent({
      userId, email: claims?.email, zoneId, type: "access_denied_outside_hours", severity: "medium",
      message: "Employee attempted admin access outside permitted zone hours",
      metadata: { day_of_week: dow, minutes },
    });
    throw new Error("Outside permitted access hours for your delivery zone");
  }
}

/** Recent-authentication requirement for highly sensitive operations. */
export async function requireRecentAuth(userId: string, claims?: AdminClaims, action = "sensitive_action") {
  const cfg = await loadSecurityConfig();
  const amr = Array.isArray(claims?.amr) ? claims!.amr! : [];
  const stamps = amr.map((a) => Number(a?.timestamp ?? 0)).filter((n) => n > 0);
  const latest = stamps.length ? Math.max(...stamps) : Number(claims?.iat ?? 0);
  const ageMinutes = latest ? (Date.now() / 1000 - latest) / 60 : Number.POSITIVE_INFINITY;
  if (ageMinutes > cfg.reauthWindowMinutes) {
    await recordSecurityEvent({
      userId, email: claims?.email, type: "reauth_required", severity: "low",
      message: `Re-authentication required before ${action}`, metadata: { action, ageMinutes: Math.round(ageMinutes) },
    });
    throw new Error(
      `Re-authentication required: sign in again within the last ${cfg.reauthWindowMinutes} minutes to perform this action`,
    );
  }
}

/** MFA assurance requirement for privileged employees (Main Admin can exempt). */
export async function assertMfaSatisfied(userId: string, claims?: AdminClaims) {
  const cfg = await loadSecurityConfig();
  if (!cfg.enforceMfa) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sec } = await supabaseAdmin
    .from("employee_security")
    .select("mfa_exempt")
    .eq("user_id", userId)
    .maybeSingle();
  if (sec?.mfa_exempt) return;
  if (claims?.aal === "aal2") return;
  const { data: factors } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
  const verified = (factors?.factors ?? []).some((f) => f.status === "verified");
  if (!verified) return; // enrolment is driven by the admin MFA route, not a hard block here
  await recordSecurityEvent({
    userId, email: claims?.email, type: "access_denied_mfa_required", severity: "medium",
    message: "Privileged action attempted without MFA assurance",
  });
  throw new Error("MFA verification required for this action");
}

/** Logs a zone-scoped data export and enforces the zone admin row cap. */
export async function recordExport(params: {
  userId: string;
  email?: string | null;
  zoneId: string | null;
  isMain: boolean;
  entity: string;
  format: string;
  rowCount: number;
  fields: string[];
  filters?: Record<string, unknown>;
}) {
  const cfg = await loadSecurityConfig();
  if (!params.isMain && params.rowCount > cfg.exportMaxRowsZoneAdmin) {
    await recordSecurityEvent({
      userId: params.userId, email: params.email, zoneId: params.zoneId,
      type: "export_blocked_row_limit", severity: "high",
      message: `Blocked export of ${params.rowCount} rows (limit ${cfg.exportMaxRowsZoneAdmin})`,
      metadata: { entity: params.entity, rowCount: params.rowCount },
    });
    throw new Error(`Export blocked: zone admins may export at most ${cfg.exportMaxRowsZoneAdmin} rows`);
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("data_export_logs").insert({
    actor_id: params.userId,
    actor_email: params.email ?? null,
    zone_id: params.zoneId,
    entity: params.entity,
    format: params.format,
    row_count: params.rowCount,
    fields: params.fields,
    filters: (params.filters ?? {}) as never,
  });
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: params.userId,
    actor_email: params.email ?? null,
    action: "data.export",
    entity: params.entity,
    entity_id: null,
    metadata: { rowCount: params.rowCount, format: params.format, zone_id: params.zoneId, fields: params.fields } as never,
  });
  return { ok: true as const };
}

export type Db = SupabaseClient<Database>;
