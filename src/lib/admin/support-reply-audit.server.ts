import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ReplyAuditRow = {
  id: string;
  created_at: string;
  kind: "sent" | "test";
  actor_email: string | null;
  request_id: string;
  request_name: string | null;
  request_email: string | null;
  request_message: string | null;
  request_status: string | null;
  target_email: string | null;
  channel: string | null;
  status: string | null;
  delivered_in_app: boolean | null;
  template_id: string | null;
  template_label: string | null;
  body: string | null;
  metadata_json: string;
};

export type ReplyAuditQuery = {
  kind: "" | "sent" | "test";
  search: string;
  template: string;
  from: string;
  to: string;
  offset: number;
  limit: number;
};

/**
 * Shared query used by both the paginated audit list and the CSV export so the
 * exported file always matches exactly what the admin sees on screen.
 */
export async function fetchReplyAudit(
  supabase: SupabaseClient<Database>,
  params: ReplyAuditQuery,
): Promise<{ rows: ReplyAuditRow[]; total: number }> {
  const actions =
    params.kind === "sent"
      ? ["support_request.reply"]
      : params.kind === "test"
        ? ["support_request.reply_test"]
        : ["support_request.reply", "support_request.reply_test"];

  // Resolve matching support requests so search can hit customer name/email too.
  let matchedRequestIds: string[] | null = null;
  if (params.search) {
    const s = `%${params.search}%`;
    const { data: reqs, error: reqErr } = await supabase
      .from("support_requests")
      .select("id")
      .or(`name.ilike.${s},email.ilike.${s}`)
      .limit(500);
    if (reqErr) throw new Error(reqErr.message);
    matchedRequestIds = (reqs ?? []).map((r) => r.id);
  }

  let q = supabase
    .from("audit_logs")
    .select("id, created_at, action, actor_email, entity_id, metadata", { count: "exact" })
    .in("action", actions)
    .order("created_at", { ascending: false });

  if (params.from) q = q.gte("created_at", new Date(params.from).toISOString());
  if (params.to) q = q.lte("created_at", new Date(`${params.to}T23:59:59.999Z`).toISOString());

  if (params.template) {
    const t = `%${params.template}%`;
    q = q.or(`metadata->>template_id.ilike.${t},metadata->>template_label.ilike.${t}`);
  }

  if (params.search) {
    const s = `%${params.search}%`;
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

  const { data: logs, error, count } = await q.range(params.offset, params.offset + params.limit - 1);
  if (error) throw new Error(error.message);

  const requestIds = [
    ...new Set((logs ?? []).map((l) => l.entity_id).filter(Boolean) as string[]),
  ];
  const replyIds = [
    ...new Set(
      (logs ?? [])
        .map((l) => (l.metadata as Record<string, unknown> | null)?.["reply_id"])
        .filter((v): v is string => typeof v === "string"),
    ),
  ];

  const requestMap = new Map<
    string,
    { name: string; email: string; message: string; status: string }
  >();
  if (requestIds.length > 0) {
    const { data: reqs } = await supabase
      .from("support_requests")
      .select("id, name, email, message, status")
      .in("id", requestIds);
    for (const r of reqs ?? [])
      requestMap.set(r.id, { name: r.name, email: r.email, message: r.message, status: r.status });
  }

  const bodyMap = new Map<string, string>();
  if (replyIds.length > 0) {
    const { data: replies } = await supabase
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
    const previewBody = typeof meta["preview_body"] === "string" ? (meta["preview_body"] as string) : null;
    return {
      id: l.id,
      created_at: l.created_at,
      kind: isTest ? "test" : "sent",
      actor_email: l.actor_email,
      request_id: requestId,
      request_name: req?.name ?? null,
      request_email: req?.email ?? null,
      request_message: req?.message ?? null,
      request_status: req?.status ?? null,
      target_email: isTest
        ? ((meta["test_email"] as string | undefined) ?? null)
        : (req?.email ?? null),
      channel: (meta["channel"] as string | undefined) ?? null,
      status: (meta["status"] as string | undefined) ?? null,
      delivered_in_app:
        typeof meta["delivered_in_app"] === "boolean" ? (meta["delivered_in_app"] as boolean) : null,
      template_id: typeof meta["template_id"] === "string" ? (meta["template_id"] as string) : null,
      template_label:
        typeof meta["template_label"] === "string" ? (meta["template_label"] as string) : null,
      body: replyId ? (bodyMap.get(replyId) ?? previewBody) : previewBody,
      metadata_json: JSON.stringify(meta),
    };
  });

  return { rows, total: count ?? 0 };
}

const CSV_HEADERS = [
  "logged_at",
  "kind",
  "admin_email",
  "request_id",
  "customer_name",
  "customer_email",
  "target_email",
  "template_id",
  "template_label",
  "channel",
  "request_status",
  "delivered_in_app",
  "body",
];

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replaceAll('"', '""')}"`;
}

export function replyAuditToCsv(rows: ReplyAuditRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.kind,
        r.actor_email,
        r.request_id,
        r.request_name,
        r.request_email,
        r.target_email,
        r.template_id,
        r.template_label,
        r.channel,
        r.request_status,
        r.delivered_in_app,
        r.body,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}
