import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, LoadingRows } from "@/components/admin/data-shell";
import {
  exportSupportReplyAudit,
  listSupportReplyAudit,
  type ReplyAuditRow,
} from "@/lib/admin/support-reply-audit.functions";
import { listSupportReplyTemplates } from "@/lib/admin/support-reply-templates.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/support-reply-audit")({
  beforeLoad: requireMainAdminGuard,
  head: () => ({
    meta: [
      { title: "Support Reply Audit | Sweet 'n Lovely Admin" },
      { name: "description", content: "Audit trail of support replies and test sends." },
    ],
  }),
  component: () => (
    <MainAdminGuard>
      <ReplyAuditPage />
    </MainAdminGuard>
  ),
});

function ReplyAuditPage() {
  const listFn = useServerFn(listSupportReplyAudit);
  const exportFn = useServerFn(exportSupportReplyAudit);
  const templatesFn = useServerFn(listSupportReplyTemplates);
  const [kind, setKind] = useState<"" | "sent" | "test">("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<ReplyAuditRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "support-reply-audit", kind, search, template, from, to, page],
    queryFn: () => listFn({ data: { kind, search, template, from, to, page, pageSize } }),
    placeholderData: keepPreviousData,
  });

  const { data: templateData } = useQuery({
    queryKey: ["admin", "support-reply-templates", "all"],
    queryFn: () => templatesFn({ data: { includeDisabled: true } }),
    staleTime: 60_000,
  });

  async function handleExport() {
    setExporting(true);
    try {
      const res = await exportFn({ data: { kind, search, template, from, to } });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        res.truncated
          ? `Exported the first ${res.rows} of ${res.total} records`
          : `Exported ${res.rows} record${res.rows === 1 ? "" : "s"}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6" data-testid="support-reply-audit-page">
      <PageHeader
        title="Support Reply Audit"
        description="Every reply sent to a customer and every test send, with who sent it and where it went."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            data-testid="reply-audit-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by request ID, customer or admin email…"
            className="min-w-[260px] flex-1 rounded-full border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-neutral-400"
          />
          <select
            data-testid="reply-audit-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as "" | "sent" | "test");
              setPage(1);
            }}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
          >
            <option value="">All sends</option>
            <option value="sent">Customer replies</option>
            <option value="test">Test sends</option>
          </select>
          <input
            type="date"
            data-testid="reply-audit-from"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
          />
          <input
            type="date"
            data-testid="reply-audit-to"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
          />
          <input
            list="reply-audit-template-options"
            data-testid="reply-audit-template"
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value);
              setPage(1);
            }}
            placeholder="Template name or ID…"
            className="min-w-[200px] rounded-full border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-neutral-400"
          />
          <datalist id="reply-audit-template-options">
            {(templateData?.rows ?? []).map((t) => (
              <option key={t.id} value={t.label} />
            ))}
            {(templateData?.rows ?? []).map((t) => (
              <option key={`${t.id}-id`} value={t.id} />
            ))}
          </datalist>
          <button
            type="button"
            data-testid="reply-audit-export"
            onClick={handleExport}
            disabled={exporting || rows.length === 0}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {exporting ? "Preparing CSV…" : "Export CSV"}
          </button>
          {kind || search || template || from || to ? (
            <button
              type="button"
              data-testid="reply-audit-reset"
              onClick={() => {
                setKind("");
                setSearch("");
                setTemplate("");
                setFrom("");
                setTo("");
                setPage(1);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800"
            >
              Reset
            </button>
          ) : null}
        </div>

        {isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState title="No reply activity" hint="Replies and test sends will appear here." />
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-neutral-200 p-3" data-testid="reply-audit-row">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.kind === "test"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {r.kind === "test" ? "Test send" : "Customer reply"}
                  </span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  <span>· by {r.actor_email ?? "unknown admin"}</span>
                  {r.channel ? <span>· {r.channel === "in_app" ? "in-app" : "email"}</span> : null}
                  {r.delivered_in_app !== null ? (
                    <span>· {r.delivered_in_app ? "delivered in-app" : "email handoff"}</span>
                  ) : null}
                  {r.status ? <span>· request {r.status}</span> : null}
                  {r.template_label || r.template_id ? (
                    <span
                      className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800"
                      data-testid="reply-audit-template-badge"
                    >
                      {r.template_label ?? r.template_id}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    data-testid="reply-audit-view"
                    onClick={() => setDetail(r)}
                    className="ml-auto rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    View details
                  </button>
                </div>
                <p className="mt-1.5 text-sm text-neutral-800">
                  To <span className="font-medium">{r.target_email ?? "unknown"}</span>
                  {r.request_name ? ` · ${r.request_name}` : ""} · ref{" "}
                  <span className="font-mono text-xs">{r.request_id.slice(0, 8)}</span>
                </p>
                {r.body ? (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-neutral-600">{r.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
          <span data-testid="reply-audit-total">{total} record{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-neutral-200 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-neutral-200 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {detail ? <AuditDetailDialog row={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}

function AuditDetailDialog({ row, onClose }: { row: ReplyAuditRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/40 p-4"
      onClick={onClose}
      data-testid="reply-audit-detail"
    >
      <div
        className="mt-10 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {row.kind === "test" ? "Test send" : "Customer reply"} details
            </h2>
            <p className="text-xs text-neutral-500">{new Date(row.created_at).toLocaleString()}</p>
          </div>
          <button
            type="button"
            data-testid="reply-audit-detail-close"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Detail label="Log ID" value={row.id} mono />
          <Detail label="Request ID" value={row.request_id} mono />
          <Detail label="Sent by" value={row.actor_email ?? "unknown admin"} />
          <Detail label="Delivered to" value={row.target_email ?? "unknown"} />
          <Detail label="Customer" value={row.request_name ?? "—"} />
          <Detail label="Customer email" value={row.request_email ?? "—"} />
          <Detail label="Template" value={row.template_label ?? row.template_id ?? "No template"} />
          <Detail label="Channel" value={row.channel ?? "—"} />
          <Detail label="Request status" value={row.status ?? row.request_status ?? "—"} />
          <Detail
            label="In-app delivery"
            value={row.delivered_in_app === null ? "—" : row.delivered_in_app ? "Yes" : "Email handoff"}
          />
        </dl>

        <section className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Original request</p>
          <p
            className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-800"
            data-testid="reply-audit-detail-request"
          >
            {row.request_message ?? "The original support request is no longer available."}
          </p>
        </section>

        <section className="mt-3">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Rendered reply</p>
          <p
            className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-800"
            data-testid="reply-audit-detail-body"
          >
            {row.body ?? "The reply body is no longer stored for this entry."}
          </p>
        </section>

        <section className="mt-3">
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">Raw audit metadata</p>
          <pre className="mt-1 max-h-48 overflow-auto rounded-2xl bg-neutral-900 p-3 text-[11px] leading-relaxed text-neutral-100">
            {JSON.stringify(row.metadata, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className={`mt-0.5 text-neutral-800 ${mono ? "font-mono text-[11px] break-all" : ""}`}>{value}</dd>
    </div>
  );
}
