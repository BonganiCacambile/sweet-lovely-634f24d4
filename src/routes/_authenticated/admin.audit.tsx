import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { listAudit, auditFacets } from "@/lib/admin/audit.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { isMainAdmin, assignedZoneName } = useAuth();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listAudit);
  const facetsFn = useServerFn(auditFacets);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "audit", "list", { search: debounced, action, entity, zoneId, fromDate, toDate, page }],
    queryFn: () => listFn({ data: { search: debounced, action, entity, zoneId, fromDate, toDate, page, pageSize: 50 } }),
    refetchOnWindowFocus: true,
  });
  const { data: facets } = useQuery({ queryKey: ["admin", "audit", "facets"], queryFn: () => facetsFn() });

  const rows = data?.rows ?? [];

  const exportCols = useMemo(() => ([
    { key: "created_at", label: "When", map: (r: { created_at: string }) => formatDateTime(r.created_at) },
    { key: "actor_email", label: "Actor" },
    { key: "action", label: "Action" },
    { key: "entity", label: "Entity" },
    { key: "entity_id", label: "Entity ID" },
    {
      key: "zone_id",
      label: "Zone",
      map: (r: { metadata: unknown }) => {
        const m = r.metadata as { zone_id?: string } | null;
        return m?.zone_id ?? "";
      },
    },
    { key: "metadata", label: "Metadata", map: (r: { metadata: unknown }) => JSON.stringify(r.metadata) },
  ]), []);

  const selectedZoneName = useMemo(() => {
    if (!isMainAdmin) return assignedZoneName;
    if (!zoneId) return null;
    return facets?.zones?.find((z) => z.id === zoneId)?.name ?? null;
  }, [isMainAdmin, assignedZoneName, zoneId, facets?.zones]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        title="Audit logs"
        description={
          isMainAdmin
            ? "A searchable trail of every admin and system action. Filter by delivery zone to inspect a single zone."
            : `Audit trail for your assigned delivery zone${assignedZoneName ? ` (${assignedZoneName})` : ""}. You only see actions that happened in your zone.`
        }
        actions={<ExportMenu rows={rows} columns={exportCols as never} filename="audit-logs" title="Audit logs" />}
      />

      {(selectedZoneName || (!isMainAdmin && assignedZoneName)) && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
          <MapPin className="h-3 w-3" />
          {isMainAdmin
            ? `Filtering: ${selectedZoneName}`
            : `Zone: ${assignedZoneName}`}
        </div>
      )}

      <Card>
        <div className="grid gap-2 border-b border-neutral-100 p-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search actor, action, entity…"
              className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm"
            />
          </div>
          {isMainAdmin && (
            <select
              value={zoneId}
              onChange={(e) => { setPage(1); setZoneId(e.target.value); }}
              className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
              aria-label="Filter by delivery zone"
            >
              <option value="">All zones</option>
              {facets?.zones?.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          )}
          <select value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm">
            <option value="">All actions</option>
            {facets?.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={entity} onChange={(e) => { setPage(1); setEntity(e.target.value); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm">
            <option value="">All entities</option>
            {facets?.entities.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm" />
          <input type="date" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm" />
        </div>

        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <div className="p-4"><ErrorPanel error={error} onRetry={refetch} /></div>
        ) : rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No audit events" hint="Adjust filters or take an admin action." /></div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50/70 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Actor</th>
                    <th className="px-4 py-2 font-medium">Action</th>
                    <th className="px-4 py-2 font-medium">Entity</th>
                    <th className="px-4 py-2 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50/60">
                      <td className="px-4 py-3 text-xs text-neutral-600" title={formatDateTime(r.created_at)}>{formatRelative(r.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-neutral-700">{r.actor_email ?? r.actor_id ?? "system"}</td>
                      <td className="px-4 py-3"><code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">{r.action}</code></td>
                      <td className="px-4 py-3 text-xs">{r.entity ?? "—"}{r.entity_id ? <span className="ml-1 text-neutral-400">·{String(r.entity_id).slice(0, 8)}</span> : null}</td>
                      <td className="px-4 py-3"><pre className="max-w-[320px] truncate text-[11px] text-neutral-500">{JSON.stringify(r.metadata)}</pre></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-neutral-100 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="space-y-1 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">{r.action}</code>
                    <span className="text-xs text-neutral-500">{formatRelative(r.created_at)}</span>
                  </div>
                  <p className="text-xs text-neutral-600">{r.actor_email ?? "system"} · {r.entity ?? "—"}</p>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={data?.pageSize ?? 50} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}