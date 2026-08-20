export const AUDIT_RETENTION_GROUP = "audit_retention";
export const REPLY_AUDIT_ACTIONS = [
  "support_request.reply",
  "support_request.reply_test",
  "support_reply_audit.export",
];

export type AuditRetentionSettings = {
  enabled: boolean;
  retentionDays: number;
  keepCustomerReplies: boolean;
  lastRunAt: string | null;
  lastRunDeleted: number;
  lastRunSource: string | null;
};

export const DEFAULT_RETENTION: AuditRetentionSettings = {
  enabled: false,
  retentionDays: 365,
  keepCustomerReplies: true,
  lastRunAt: null,
  lastRunDeleted: 0,
  lastRunSource: null,
};

type Row = { key: string; value: unknown };

export function settingsFromRows(rows: Row[]): AuditRetentionSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, fallback: number) => {
    const v = map.get(k);
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const bool = (k: string, fallback: boolean) => {
    const v = map.get(k);
    return typeof v === "boolean" ? v : fallback;
  };
  const str = (k: string) => {
    const v = map.get(k);
    return typeof v === "string" && v ? v : null;
  };
  return {
    enabled: bool("enabled", DEFAULT_RETENTION.enabled),
    retentionDays: num("retention_days", DEFAULT_RETENTION.retentionDays),
    keepCustomerReplies: bool("keep_customer_replies", DEFAULT_RETENTION.keepCustomerReplies),
    lastRunAt: str("last_run_at"),
    lastRunDeleted: num("last_run_deleted", 0),
    lastRunSource: str("last_run_source"),
  };
}

/**
 * Deletes reply-audit entries older than the retention window. Runs with the
 * service-role client because audit_logs deliberately denies DELETE via RLS.
 */
export async function purgeReplyAudit(opts: {
  retentionDays: number;
  keepCustomerReplies: boolean;
  source: string;
  dryRun?: boolean;
}): Promise<{ deleted: number; cutoff: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - opts.retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const actions = opts.keepCustomerReplies
    ? REPLY_AUDIT_ACTIONS.filter((a) => a !== "support_request.reply")
    : REPLY_AUDIT_ACTIONS;

  if (opts.dryRun) {
    const { count, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .in("action", actions)
      .lt("created_at", cutoff);
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0, cutoff };
  }

  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .delete()
    .in("action", actions)
    .lt("created_at", cutoff)
    .select("id");
  if (error) throw new Error(error.message);
  const deleted = (data ?? []).length;

  const stamp = new Date().toISOString();
  await supabaseAdmin.from("system_settings").upsert(
    [
      { group_key: AUDIT_RETENTION_GROUP, key: "last_run_at", value: stamp },
      { group_key: AUDIT_RETENTION_GROUP, key: "last_run_deleted", value: deleted },
      { group_key: AUDIT_RETENTION_GROUP, key: "last_run_source", value: opts.source },
    ],
    { onConflict: "group_key,key" },
  );

  return { deleted, cutoff };
}
