import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireAdminGuard } from "@/lib/admin/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock, LifeBuoy, Mail, MapPin, Phone, Search, Send, UserCog, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { formatRelative } from "@/lib/admin/format";
import {
  SUPPORT_REPLY_TEMPLATES,
  renderSupportTemplate,
  TEMPLATE_VARIABLES,
} from "@/lib/admin/support-reply-templates";
import { listSupportReplyTemplates } from "@/lib/admin/support-reply-templates.functions";
import { SUPPORT_CATEGORIES } from "@/lib/support.functions";
import {
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  assignSupportRequest,
  listAssignableEmployees,
  listSupportRequestEvents,
  listSupportRequests,
  listSupportRequestReplies,
  sendSupportRequestReply,
  sendTestSupportReply,
  supportRequestStats,
  updateSupportRequestPriority,
  updateSupportRequestStatus,
  type SupportRequestDto,
} from "@/lib/admin/support-requests.functions";

export const Route = createFileRoute("/_authenticated/admin/support-requests")({
  beforeLoad: requireAdminGuard,
  component: SupportRequestsPage,
});

type SupportRow = SupportRequestDto;

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-neutral-100 text-neutral-600",
  normal: "bg-sky-50 text-sky-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-rose-50 text-rose-700",
};

function ZoneBadge({ name, color }: { name: string | null; color: string | null }) {
  return (
    <span
      data-testid="zone-badge"
      className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700"
    >
      <MapPin className="h-3 w-3" style={color ? { color } : { color: "#ff003c" }} />
      {name ?? "No zone"}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.normal}`}>
      {priority}
    </span>
  );
}

function SupportRequestsPage() {
  const qc = useQueryClient();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listSupportRequests);
  const statsFn = useServerFn(supportRequestStats);
  const statusFn = useServerFn(updateSupportRequestStatus);
  const priorityFn = useServerFn(updateSupportRequestPriority);

  const filters = { zoneId, status, priority, category, assignedTo, from, to, search: debounced, page };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "support-requests", "list", filters],
    queryFn: () => listFn({ data: { ...filters, pageSize: 25 } }),
  });
  const { data: stats } = useQuery({
    queryKey: ["admin", "support-requests", "stats"],
    queryFn: () => statsFn(),
  });
  useRealtimeInvalidate(["support_requests", "support_request_replies"], [["admin", "support-requests"]]);

  const scope = data?.scope ?? stats?.scope;
  const isMain = scope?.isMain ?? false;

  const rows = (data?.rows ?? []) as SupportRow[];
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const setRowStatus = useMutation({
    mutationFn: (v: { id: string; status: string }) => statusFn({ data: v }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin", "support-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRowPriority = useMutation({
    mutationFn: (v: { id: string; priority: string }) => priorityFn({ data: v }),
    onSuccess: () => {
      toast.success("Priority updated");
      qc.invalidateQueries({ queryKey: ["admin", "support-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCols = useMemo(
    () => [
      { key: "reference", label: "Reference" },
      { key: "zone_name", label: "Delivery zone" },
      { key: "name", label: "Customer" },
      { key: "email", label: "Email" },
      { key: "subject", label: "Subject" },
      { key: "category", label: "Category" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "assigned_email", label: "Assigned to" },
      { key: "created_at", label: "Created" },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Support Requests"
        description={
          isMain
            ? "Complaints and questions across every delivery zone."
            : "Complaints and questions for your delivery zone."
        }
        actions={<ExportMenu rows={rows} columns={exportCols as never} filename="support-requests" />}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatBlock label="All requests" value={stats?.total ?? 0} icon={<LifeBuoy className="h-4 w-4" />} />
        <StatBlock label="Open" value={stats?.byStatus.open ?? 0} icon={<Clock className="h-4 w-4" />} />
        <StatBlock label="In progress" value={stats?.byStatus.in_progress ?? 0} icon={<Clock className="h-4 w-4" />} />
        <StatBlock label="Resolved" value={stats?.byStatus.resolved ?? 0} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatBlock label="High priority" value={stats?.highPriorityTotal ?? 0} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {/* Zone overview / filter */}
      <div className="flex flex-wrap gap-2" data-testid="support-zone-filter">
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setZoneId(null);
          }}
          className={`rounded-2xl border px-4 py-3 text-left transition ${zoneId === null ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
        >
          <p className="text-xs font-medium opacity-80">All zones</p>
          <p className="text-lg font-bold">{stats?.total ?? 0}</p>
        </button>
        {(stats?.byZone ?? []).map((z) => (
          <button
            key={z.id}
            type="button"
            data-testid="support-zone-card"
            disabled={z.id === "unassigned"}
            onClick={() => {
              setPage(1);
              setZoneId(z.id);
            }}
            className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${zoneId === z.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
          >
            <p className="flex items-center gap-1 text-xs font-medium opacity-80">
              <MapPin className="h-3 w-3" style={z.color ? { color: z.color } : undefined} />
              {z.name}
            </p>
            <p className="text-lg font-bold">{z.open} open</p>
            <p className="text-[11px] opacity-70">
              {z.highPriority} high · {z.resolvedToday} resolved today
            </p>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              data-testid="support-search"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search reference, customer, email, order number or subject…"
              className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm"
            />
          </div>
          <select
            data-testid="support-status-filter"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {SUPPORT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            data-testid="support-priority-filter"
            value={priority}
            onChange={(e) => {
              setPage(1);
              setPriority(e.target.value);
            }}
            className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="">All priorities</option>
            {SUPPORT_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
            className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="">All categories</option>
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={assignedTo}
            onChange={(e) => {
              setPage(1);
              setAssignedTo(e.target.value);
            }}
            className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
            className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
          />
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button type="button" onClick={() => setSelectedId(r.id)} className="min-w-0 flex-1 text-left">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {r.reference}
                        </span>
                        <ZoneBadge name={r.zone_name} color={r.zone_color} />
                        <StatusBadge status={r.status} />
                        <PriorityBadge priority={r.priority} />
                      </div>
                      <p className="font-medium text-neutral-900">{r.subject}</p>
                      <p className="text-xs text-neutral-500">
                        {r.name} · {r.email}
                        {r.order_number ? ` · Order ${r.order_number}` : ""}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-700">{r.message}</p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {formatRelative(r.created_at)}
                        {r.assigned_email ? ` · assigned to ${r.assigned_email}` : " · unassigned"}
                      </p>
                    </button>
                    <div className="flex shrink-0 flex-col gap-2">
                      <select
                        value={r.status}
                        onChange={(e) => setRowStatus.mutate({ id: r.id, status: e.target.value })}
                        className="h-8 rounded-full border border-neutral-200 bg-white px-2 text-xs"
                      >
                        {SUPPORT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <select
                        value={r.priority}
                        onChange={(e) => setRowPriority.mutate({ id: r.id, priority: e.target.value })}
                        className="h-8 rounded-full border border-neutral-200 bg-white px-2 text-xs"
                      >
                        {SUPPORT_PRIORITIES.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
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
          onClick={() => setSelectedId(null)}
        >
          <div
            data-testid="support-detail"
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {selected.reference}
                  </span>
                  <ZoneBadge name={selected.zone_name} color={selected.zone_color} />
                  <StatusBadge status={selected.status} />
                  <PriorityBadge priority={selected.priority} />
                </div>
                <h2 className="mt-2 text-lg font-semibold text-neutral-900">{selected.subject}</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {selected.name} · {formatRelative(selected.created_at)} · {selected.category}
                  {selected.order_number ? ` · Order ${selected.order_number}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
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

            {selected.resolution ? (
              <p className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                Resolution: {selected.resolution}
              </p>
            ) : null}

            <AssignPanel request={selected} isMain={isMain} />
            <ReplyPanel request={selected} />
            <HistoryPanel requestId={selected.id} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssignPanel({ request, isMain }: { request: SupportRow; isMain: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAssignableEmployees);
  const assignFn = useServerFn(assignSupportRequest);
  const [override, setOverride] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "support-requests", "assignees", request.delivery_zone_id, override],
    queryFn: () => listFn({ data: { zoneId: override ? null : request.delivery_zone_id } }),
  });

  const assign = useMutation({
    mutationFn: (assigneeId: string | null) =>
      assignFn({ data: { id: request.id, assigneeId, override } }),
    onSuccess: () => {
      toast.success("Assignment updated");
      qc.invalidateQueries({ queryKey: ["admin", "support-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-5 rounded-2xl border border-neutral-200 p-4" data-testid="support-assign-panel">
      <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <UserCog className="h-4 w-4 text-neutral-400" /> Assignment
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          data-testid="support-assignee"
          value={request.assigned_to ?? ""}
          onChange={(e) => assign.mutate(e.target.value || null)}
          className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
        >
          <option value="">Unassigned</option>
          {(data?.rows ?? []).map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
              {emp.isMainAdmin ? " (main admin)" : ""}
            </option>
          ))}
        </select>
        {isMain ? (
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Allow cross-zone assignment
          </label>
        ) : null}
      </div>
    </div>
  );
}

function HistoryPanel({ requestId }: { requestId: string }) {
  const fn = useServerFn(listSupportRequestEvents);
  const { data } = useQuery({
    queryKey: ["admin", "support-requests", "events", requestId],
    queryFn: () => fn({ data: { requestId } }),
  });
  if ((data?.rows.length ?? 0) === 0) return null;
  return (
    <div className="mt-5 border-t border-neutral-200 pt-4" data-testid="support-history">
      <h3 className="text-sm font-semibold text-neutral-900">History</h3>
      <ul className="mt-2 space-y-1.5">
        {data!.rows.map((e) => (
          <li key={e.id} className="text-[11px] text-neutral-500">
            {formatRelative(e.created_at)} · {e.actor_email ?? "system"} changed {e.field} from{" "}
            {e.from_value ?? "—"} to {e.to_value ?? "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatBlock({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}


function ReplyPanel({ request }: { request: SupportRow }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [markResolved, setMarkResolved] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [usedTemplate, setUsedTemplate] = useState<{ id: string; label: string } | null>(null);

  const listRepliesFn = useServerFn(listSupportRequestReplies);
  const sendReplyFn = useServerFn(sendSupportRequestReply);
  const sendTestFn = useServerFn(sendTestSupportReply);
  const listTemplatesFn = useServerFn(listSupportReplyTemplates);

  const { data: templateData } = useQuery({
    queryKey: ["admin", "support-reply-templates", "active"],
    queryFn: () => listTemplatesFn({ data: { includeDisabled: false } }),
    staleTime: 60_000,
  });
  const templates =
    (templateData?.rows.length ?? 0) > 0
      ? templateData!.rows.map((t) => ({
          id: t.id,
          label: t.label,
          description: t.description ?? "",
          body: t.body,
        }))
      : SUPPORT_REPLY_TEMPLATES;

  const templateVars = { name: request.name, email: request.email, reference: request.id };
  const previewTemplate = templates.find((t) => t.id === previewId) ?? null;

  const { data: replies, isLoading } = useQuery({
    queryKey: ["admin", "support-requests", "replies", request.id],
    queryFn: () => listRepliesFn({ data: { requestId: request.id } }),
  });

  const send = useMutation({
    mutationFn: () =>
      sendReplyFn({
        data: {
          requestId: request.id,
          body,
          markResolved,
          templateId: usedTemplate?.id ?? "",
          templateLabel: usedTemplate?.label ?? "",
        },
      }),
    onSuccess: (r) => {
      setBody("");
      setMarkResolved(false);
      setUsedTemplate(null);
      toast.success(
        r.deliveredInApp
          ? "Reply sent to the customer's notifications"
          : "Reply saved — no account linked, use the email link to send it",
      );
      qc.invalidateQueries({ queryKey: ["admin", "support-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendTest = useMutation({
    mutationFn: () =>
      sendTestFn({
        data: {
          requestId: request.id,
          body,
          testEmail,
          templateId: usedTemplate?.id ?? "",
          templateLabel: usedTemplate?.label ?? "",
        },
      }),
    onSuccess: (r) => {
      if (r.deliveredInApp) {
        toast.success(`Test reply sent to ${r.email} in-app`);
      } else {
        toast.message(`No account for ${r.email} — opening your email client`);
        if (typeof window !== "undefined") window.location.href = r.mailto;
      }
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

      <div className="mt-3" data-testid="support-reply-templates">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">Quick replies</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.description}
              data-testid={`support-reply-template-${t.id}`}
              onMouseEnter={() => setPreviewId(t.id)}
              onFocus={() => setPreviewId(t.id)}
              onClick={() => {
                setPreviewId(t.id);
                setUsedTemplate({ id: t.id, label: t.label });
                const text = renderSupportTemplate(t, templateVars);
                setBody((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text));
              }}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {t.label}
            </button>
          ))}
          {body.trim() ? (
            <button
              type="button"
              data-testid="support-reply-clear"
              onClick={() => {
                setBody("");
                setUsedTemplate(null);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800"
            >
              Clear
            </button>
          ) : null}
        </div>

        {previewTemplate ? (
          <div
            className="mt-2 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-3"
            data-testid="support-reply-template-preview"
          >
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">
              Preview · {previewTemplate.label}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-800">
              {renderSupportTemplate(previewTemplate, templateVars)}
            </p>
            <p className="mt-2 text-[11px] text-neutral-500">
              Variables filled from this request: {TEMPLATE_VARIABLES.map((v) => v.token).join(", ")}
            </p>
          </div>
        ) : null}
      </div>

      <textarea
        data-testid="support-reply-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder={`Write a reply to ${request.name}…`}
        className="mt-3 w-full rounded-2xl border border-neutral-200 p-3 text-sm text-neutral-900 outline-none focus:border-neutral-400"
      />

      <div className="mt-3 rounded-2xl border border-neutral-200 p-3" data-testid="support-reply-test-mode">
        <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
          <input
            type="checkbox"
            data-testid="support-reply-test-toggle"
            checked={testMode}
            onChange={(e) => setTestMode(e.target.checked)}
          />
          Test mode — send this draft to my own address first
        </label>
        {testMode ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="email"
              data-testid="support-reply-test-email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@sweetnlovely.co.za"
              className="min-w-[220px] flex-1 rounded-full border border-neutral-200 px-3 py-1.5 text-xs outline-none focus:border-neutral-400"
            />
            <button
              type="button"
              data-testid="support-reply-test-send"
              disabled={!body.trim() || !testEmail.trim() || sendTest.isPending}
              onClick={() => sendTest.mutate()}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              {sendTest.isPending ? "Sending test…" : "Send test"}
            </button>
            <p className="w-full text-[11px] text-neutral-500">
              Test sends are never stored on the request and never reach the customer.
            </p>
          </div>
        ) : null}
      </div>

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
