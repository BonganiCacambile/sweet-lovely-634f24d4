import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findEmailsByUserIds } from "@/lib/admin/user-lookup.server";

export const SUPPORT_EMAIL_GROUP = "support_email";
/** Settings key used when a zone has no explicit override. */
export const SUPPORT_EMAIL_DEFAULT_KEY = "default";

export type ZoneEmailConfig = {
  /** Send support emails at all for this zone. */
  enabled: boolean;
  /** "all" = every main + zone admin; "custom" = only the selected user ids. */
  mode: "all" | "custom";
  /** Selected admin user ids (only used when mode === "custom"). */
  userIds: string[];
  /** Extra addresses that always receive the alert for this zone. */
  extraEmails: string[];
};

export const DEFAULT_ZONE_CONFIG: ZoneEmailConfig = {
  enabled: true,
  mode: "all",
  userIds: [],
  extraEmails: [],
};

export function zoneKey(zoneId: string | null): string {
  return zoneId ? `zone:${zoneId}` : SUPPORT_EMAIL_DEFAULT_KEY;
}

export function parseZoneConfig(value: unknown): ZoneEmailConfig {
  const v = (value ?? {}) as Partial<ZoneEmailConfig>;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_ZONE_CONFIG.enabled,
    mode: v.mode === "custom" ? "custom" : "all",
    userIds: Array.isArray(v.userIds)
      ? v.userIds.filter((x): x is string => typeof x === "string")
      : [],
    extraEmails: Array.isArray(v.extraEmails)
      ? v.extraEmails.filter((x): x is string => typeof x === "string")
      : [],
  };
}

/** Candidate admins for a zone: every main admin plus that zone's zone-admins. */
export async function listCandidateAdmins(
  zoneId: string | null,
): Promise<Array<{ userId: string; email: string; isMain: boolean; isZoneAdmin: boolean }>> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role, assigned_zone_id");
  if (error) {
    console.error("[support-email] role lookup failed", error.message);
    return [];
  }
  const map = new Map<string, { isMain: boolean; isZoneAdmin: boolean }>();
  for (const r of data ?? []) {
    const uid = r.user_id as string;
    const isMain = r.role === "admin";
    const isZoneAdmin = Boolean(zoneId) && r.assigned_zone_id === zoneId;
    if (!isMain && !isZoneAdmin) continue;
    const prev = map.get(uid) ?? { isMain: false, isZoneAdmin: false };
    map.set(uid, { isMain: prev.isMain || isMain, isZoneAdmin: prev.isZoneAdmin || isZoneAdmin });
  }
  const emails = await findEmailsByUserIds(Array.from(map.keys()));
  return Array.from(map.entries())
    .map(([userId, flags]) => ({ userId, email: emails[userId] ?? "", ...flags }))
    .filter((r) => r.email)
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** Effective config for a zone, falling back to the global default row. */
export async function getZoneEmailConfig(zoneId: string | null): Promise<ZoneEmailConfig> {
  const keys = [SUPPORT_EMAIL_DEFAULT_KEY];
  if (zoneId) keys.push(zoneKey(zoneId));
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("key, value")
    .eq("group_key", SUPPORT_EMAIL_GROUP)
    .in("key", keys);
  if (error) {
    console.error("[support-email] settings lookup failed", error.message);
    return DEFAULT_ZONE_CONFIG;
  }
  const rows = data ?? [];
  const specific = zoneId ? rows.find((r) => r.key === zoneKey(zoneId)) : undefined;
  const fallback = rows.find((r) => r.key === SUPPORT_EMAIL_DEFAULT_KEY);
  if (specific) return parseZoneConfig(specific.value);
  if (fallback) return parseZoneConfig(fallback.value);
  return DEFAULT_ZONE_CONFIG;
}

/** Final recipient addresses for a support request in the given zone. */
export async function resolveSupportRecipients(zoneId: string | null): Promise<string[]> {
  const config = await getZoneEmailConfig(zoneId);
  if (!config.enabled) return [];
  const candidates = await listCandidateAdmins(zoneId);
  const selected =
    config.mode === "custom"
      ? candidates.filter((c) => config.userIds.includes(c.userId))
      : candidates;
  const out = new Set<string>();
  for (const c of selected) out.add(c.email.toLowerCase());
  for (const e of config.extraEmails) {
    const trimmed = e.trim().toLowerCase();
    if (trimmed) out.add(trimmed);
  }
  return Array.from(out);
}
