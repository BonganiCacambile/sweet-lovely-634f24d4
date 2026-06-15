import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Plug, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { formatRelative } from "@/lib/admin/format";
import { listIntegrations, updateIntegration } from "@/lib/admin/integrations.functions";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listIntegrations);
  const updFn = useServerFn(updateIntegration);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "integrations"], queryFn: () => listFn(), refetchOnWindowFocus: true,
  });
  const update = useMutation({
    mutationFn: (vars: { id: string; status: "connected" | "disconnected" | "pending" | "error" }) => updFn({ data: vars }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "integrations"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = data ?? [];
  const groups = rows.reduce<Record<string, typeof rows>>((acc, r) => { (acc[r.category] ??= []).push(r); return acc; }, {});

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Integrations" description="Connect third-party providers for payments, email, SMS and analytics." />
      {error ? <ErrorPanel error={error} onRetry={() => refetch()} /> : null}
      {isLoading ? <LoadingRows rows={4} height={70} /> : (
        <div className="space-y-6">
          {Object.entries(groups).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">{cat}</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map(it => (
                  <Card key={it.id} className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100"><Plug className="h-5 w-5 text-neutral-600" /></div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{it.display_name}</p>
                          <p className="font-mono text-[11px] text-neutral-500">{it.provider}</p>
                        </div>
                      </div>
                      <StatusBadge status={it.status} />
                    </div>
                    {it.last_checked_at && <p className="mt-3 text-[11px] text-neutral-500">Checked {formatRelative(it.last_checked_at)}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {it.status !== "connected" && (
                        <button onClick={() => update.mutate({ id: it.id, status: "connected" })} className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700">Mark connected</button>
                      )}
                      {it.status !== "disconnected" && (
                        <button onClick={() => update.mutate({ id: it.id, status: "disconnected" })} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">Disconnect</button>
                      )}
                      <button onClick={() => update.mutate({ id: it.id, status: it.status as "connected" | "disconnected" | "pending" | "error" })} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">Re-check</button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "connected") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Connected</span>;
  if (status === "error") return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"><XCircle className="h-3 w-3" /> Error</span>;
  if (status === "pending") return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Pending</span>;
  return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">Disconnected</span>;
}
