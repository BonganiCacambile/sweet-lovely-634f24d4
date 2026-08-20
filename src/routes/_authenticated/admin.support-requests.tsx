import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy, Mail, Phone, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { formatRelative } from "@/lib/admin/format";
import {
  listSupportRequests,
  listSupportRequestReplies,
  sendSupportRequestReply,
  supportRequestStats,
  updateSupportRequestStatus,
} from "@/lib/admin/support-requests.functions";

export const Route = createFileRoute("/_authenticated/admin/support-requests")({
  beforeLoad: requireMainAdminGuard,
  component: () => (
    <MainAdminGuard>
      <SupportRequestsPage />
    </MainAdminGuard>
  ),
});

type StatusFilter = "" | "new" | "in_progress" | "resolved" | "archived";
type SupportRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  source: string;
  created_at: string;
};

const STATUSES: { value: Exclude<StatusFilter, "">; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

function SupportRequestsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SupportRow | null>(null);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listSupportRequests);
  const statsFn = useServerFn(supportRequestStats);
  const statusFn = useServerFn(updateSupportRequestStatus);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "support-requests", "list", { status, search: debounced, page }],
    queryFn: () => listFn({ data: { status, search: debounced, page, pageSize: 25 } }),
  });
  const { data: stats } = useQuery({
    queryKey: ["admin", "support-requests", "stats"],
    queryFn: () => statsFn(),
  });

  const setRowStatus = useMutation({
    mutationFn: (v: { id: string; status: Exclude<StatusFilter, ""> }) => statusFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success("Support request updated");
      setSelected((cur) => (cur && cur.id === v.id ? { ...cur, status: v.status } : cur));
      qc.invalidateQueries({ queryKey: ["admin", "support-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCols = useMemo(
    () => [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "message", label: "Message" },
      { key: "status", label: "Status" },
      { key: "source", label: "Source" },
      { key: "created_at", label: "Received" },
    ],
    [],
  );

  const rows = (data?.rows ?? []) as SupportRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Support Requests"
        description="Messages submitted through the Contact Us form."
        actions={<ExportMenu rows={rows} columns={exportCols as never} filename="support-requests" />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="Total" value={stats?.total ?? 0} />
        <StatBlock label="New" value={stats?.byStatus.new ?? 0} />
        <StatBlock label="In progress" value={stats?.byStatus.in_progress ?? 0} />
        <StatBlock label="Last 24h" value={stats?.last24h ?? 0} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              data-testid="support-search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by name, email, phone or message…"
              className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm"
            />
          </div>
          <select
            data-testid="support-status-filter"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as StatusFilter);
            }}
            className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorPanel error={error} onRetry={() => void refetch()} />
          </div>
        ) : isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No support requests" />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-neutral-100" data-testid="support-list">
              {rows.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-900">{r.name}</span>
                        <span className="text-xs text-neutral-500">{r.email}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="line-clamp-2 text-sm text-neutral-700">{r.message}</p>
                      <p className="mt-1 text-[11px] text-neutral-500">{formatRelative(r.created_at)}</p>
                    </button>
                    <select
                      value={r.status}
                      onChange={(e) =>
                        setRowStatus.mutate({ id: r.id, status: e.target.value as Exclude<StatusFilter, ""> })
                      }
                      className="h-8 shrink-0 rounded-full border border-neutral-200 bg-white px-2 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={data!.pageSize} total={data!.total} onPage={setPage} />
          </>
        )}
      </Card>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            data-testid="support-detail"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{selected.name}</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatRelative(selected.created_at)} · {selected.source}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900">
                <Mail className="h-4 w-4 text-neutral-400" /> {selected.email}
              </a>
              {selected.phone ? (
                <a
                  href={`tel:${selected.phone.replace(/\s+/g, "")}`}
                  className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900"
                >
                  <Phone className="h-4 w-4 text-neutral-400" /> {selected.phone}
                </a>
              ) : null}
            </div>

            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-800">
              {selected.message}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={selected.status === s.value}
                  onClick={() => setRowStatus.mutate({ id: selected.id, status: s.value })}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <ReplyPanel request={selected} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReplyPanel({ request }: { request: SupportRow }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [markResolved, setMarkResolved] = useState(false);

  const listRepliesFn = useServerFn(listSupportRequestReplies);
  const sendReplyFn = useServerFn(sendSupportRequestReply);

  const { data: replies, isLoading } = useQuery({
    queryKey: ["admin", "support-requests", "replies", request.id],
    queryFn: () => listRepliesFn({ data: { requestId: request.id } }),
  });

  const send = useMutation({
    mutationFn: () => sendReplyFn({ data: { requestId: request.id, body, markResolved } }),
    onSuccess: (r) => {
      setBody("");
      setMarkResolved(false);
      toast.success(
        r.deliveredInApp
          ? "Reply sent to the customer's notifications"
          : "Reply saved — no account linked, use the email link to send it",
      );
      qc.invalidateQueries({ queryKey: ["admin", "support-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 border-t border-neutral-200 pt-4" data-testid="support-reply-panel">
      <h3 className="text-sm font-semibold text-neutral-900">Replies</h3>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <p className="text-xs text-neutral-500">Loading replies…</p>
        ) : (replies?.rows.length ?? 0) === 0 ? (
          <p className="text-xs text-neutral-500">No replies yet.</p>
        ) : (
          replies!.rows.map((r) => (
            <div key={r.id} className="rounded-2xl bg-neutral-50 p-3" data-testid="support-reply-item">
              <p className="text-[11px] text-neutral-500">
                {r.author_email ?? "Admin"} · {formatRelative(r.created_at)} · {r.channel === "in_app" ? "in-app" : "email"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{r.body}</p>
            </div>
          ))
        )}
      </div>

      <textarea
        data-testid="support-reply-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder={`Write a reply to ${request.name}…`}
        className="mt-3 w-full rounded-2xl border border-neutral-200 p-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            data-testid="support-reply-resolve"
            checked={markResolved}
            onChange={(e) => setMarkResolved(e.target.checked)}
          />
          Mark as resolved after sending
        </label>
        <div className="flex items-center gap-2">
          <a
            href={`mailto:${request.email}?subject=${encodeURIComponent(
              "Re: your Sweet 'n Lovely support request",
            )}&body=${encodeURIComponent(body)}`}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Open in email
          </a>
          <button
            type="button"
            data-testid="support-reply-send"
            disabled={!body.trim() || send.isPending}
            onClick={() => send.mutate()}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> {send.isPending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/70 bg-white/80 p-4">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
