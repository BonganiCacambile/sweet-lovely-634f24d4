import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { REPORT_TYPES, runReport } from "@/lib/admin/reports.functions";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: () => (
    <MainAdminGuard>
      <ReportsPage />
    </MainAdminGuard>
  ),
});

type ReportId = typeof REPORT_TYPES[number]["id"];

function presetRange(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) };
}

function ReportsPage() {
  const [type, setType] = useState<ReportId>("sales_by_day");
  const [range, setRange] = useState(presetRange(30));
  const fn = useServerFn(runReport);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "reports", type, range],
    queryFn: () => fn({ data: { type, ...range } }),
    refetchOnWindowFocus: false,
  });

  const meta = REPORT_TYPES.find(r => r.id === type)!;
  const columns = data?.columns ?? [];
  const rows = (data?.rows ?? []) as Record<string, unknown>[];

  const exportCols = useMemo(() => columns.map(c => ({ key: c, label: c.replace(/_/g, " ") })), [columns]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Reports"
        description="Generate ad-hoc reports across sales, customers, inventory and reviews."
        actions={<ExportMenu rows={rows} columns={exportCols} filename={`${type}-${range.fromDate}_${range.toDate}`} title={meta.label} />}
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="p-3">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Report</p>
          <div className="space-y-1">
            {REPORT_TYPES.map(r => (
              <button key={r.id} onClick={() => setType(r.id)} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${type === r.id ? "bg-[#ff003c] text-white" : "text-neutral-700 hover:bg-neutral-100"}`}>
                <div className="font-medium">{r.label}</div>
                <div className={`text-[11px] ${type === r.id ? "text-white/80" : "text-neutral-500"}`}>{r.description}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">{meta.label}</h2>
              <p className="text-xs text-neutral-500">{meta.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setRange(presetRange(d))} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Last {d}d</button>
              ))}
              <input type="date" value={range.fromDate} onChange={e => setRange(r => ({ ...r, fromDate: e.target.value }))} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs" />
              <span className="text-xs text-neutral-500">to</span>
              <input type="date" value={range.toDate} onChange={e => setRange(r => ({ ...r, toDate: e.target.value }))} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs" />
              <button onClick={() => refetch()} className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800">{isFetching ? "Running…" : "Run"}</button>
            </div>
          </div>

          {error ? <ErrorPanel error={error} onRetry={() => refetch()} /> : null}
          {isLoading ? <LoadingRows rows={6} /> : (
            rows.length === 0 ? <EmptyState title="No data for the selected period" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 text-neutral-500">
                    <tr>{columns.map(c => <th key={c} className="whitespace-nowrap px-4 py-2 text-left font-medium uppercase tracking-wider">{c.replace(/_/g, " ")}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        {columns.map(c => <td key={c} className="px-4 py-2 align-top text-neutral-800">{formatCell(r[c])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}