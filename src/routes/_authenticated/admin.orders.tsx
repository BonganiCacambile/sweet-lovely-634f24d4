import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { listOrders, getOrder, updateOrderStatus, orderStats } from "@/lib/admin/orders.functions";
import { useDebounced } from "@/hooks/use-debounced";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { formatRelative, formatZar, formatDateTime } from "@/lib/admin/format";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: OrdersPage,
});

const STATUSES = ["pending","preparing","processing","out_for_delivery","completed","delivered","cancelled","refunded"] as const;

function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "total_zar" | "order_number">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listOrders);
  const statsFn = useServerFn(orderStats);
  const queryKey = ["admin","orders","list",{ search: debounced, status, fromDate, toDate, sortBy, sortDir, page }] as const;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { search: debounced, status, fromDate, toDate, sortBy, sortDir, page, pageSize: 25 } }),
  });
  const { data: stats } = useQuery({ queryKey: ["admin","orders","stats"], queryFn: () => statsFn() });

  useRealtimeTable("orders", [["admin","orders","list"], ["admin","orders","stats"]], (e) => {
    if (e.eventType === "INSERT") toast.success("New order received");
  });

  const exportCols = useMemo(() => ([
    { key: "order_number", label: "Order #" },
    { key: "customer_name", label: "Customer" },
    { key: "customer_email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "total_zar", label: "Total (R)", map: (r: { total_zar: number }) => Number(r.total_zar).toFixed(2) },
    { key: "created_at", label: "Created", map: (r: { created_at: string }) => formatDateTime(r.created_at) },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commerce"
        title="Orders"
        description="Live order pipeline, fulfilment status, refunds and customer history."
        actions={<ExportMenu rows={data?.rows ?? []} columns={exportCols as never} filename="orders" title="Orders export" />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total orders" value={stats?.total ?? 0} />
        <StatCard label="Today" value={stats?.todayCount ?? 0} />
        <StatCard label="Revenue" value={formatZar(stats?.revenue ?? 0)} />
        <StatCard label="Pending" value={stats?.byStatus.pending ?? 0} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search order #, customer, email…"
              className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-400"
            />
          </div>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={fromDate.slice(0,10)} onChange={(e) => { setPage(1); setFromDate(e.target.value ? new Date(e.target.value).toISOString() : ""); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm" />
          <input type="date" value={toDate.slice(0,10)} onChange={(e) => { setPage(1); setToDate(e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : ""); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm" />
          <select value={`${sortBy}:${sortDir}`} onChange={(e) => { const [a,b] = e.target.value.split(":"); setSortBy(a as never); setSortDir(b as never); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm">
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="total_zar:desc">Highest total</option>
            <option value="total_zar:asc">Lowest total</option>
            <option value="order_number:asc">Order # A-Z</option>
          </select>
        </div>

        {error ? (
          <div className="p-4"><ErrorPanel error={error} onRetry={() => void refetch()} /></div>
        ) : isLoading ? (
          <LoadingRows />
        ) : (data?.rows.length ?? 0) === 0 ? (
          <div className="p-6"><EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="No orders yet" hint="New orders will appear here in real time." /></div>
        ) : (
          <>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.rows.map((o) => (
                    <tr key={o.id} className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50/70" onClick={() => setSelectedId(o.id)}>
                      <td className="px-3 py-3 font-medium text-neutral-900">{o.order_number}</td>
                      <td className="px-3 py-3 text-neutral-700">
                        <p className="font-medium">{o.customer_name}</p>
                        <p className="text-xs text-neutral-500">{o.customer_email}</p>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{formatZar(Number(o.total_zar))}</td>
                      <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-3 py-3 text-right text-xs text-neutral-500">{formatRelative(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={data!.pageSize} total={data!.total} onPage={setPage} />
          </>
        )}
      </Card>

      {selectedId && <OrderDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/70 bg-white/80 p-4">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function OrderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getOrder);
  const setStatus = useServerFn(updateOrderStatus);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin","orders","detail", id], queryFn: () => getFn({ data: { id } }) });
  const mutation = useMutation({
    mutationFn: (status: string) => setStatus({ data: { id, status: status as never } }),
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin","orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-neutral-900/40" onClick={onClose} />
      <aside className="flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-100 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">Order</p>
            <h2 className="text-lg font-semibold">{data?.order_number ?? "…"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 space-y-5 p-4 text-sm">
          {error ? <ErrorPanel error={error} /> : isLoading || !data ? <LoadingRows rows={3} /> : (
            <>
              <section>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Customer</p>
                <p className="font-medium">{data.customer_name}</p>
                <p className="text-neutral-600">{data.customer_email}</p>
                {data.customer_phone && <p className="text-neutral-600">{data.customer_phone}</p>}
                {data.address && <p className="mt-1 text-neutral-600">{data.address}</p>}
              </section>
              <section>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Status</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button key={s} disabled={mutation.isPending || data.status === s} onClick={() => mutation.mutate(s)}
                      className={`rounded-full border px-3 py-1 text-xs capitalize ${data.status === s ? "border-[#ff003c] bg-[#fff0f3] text-[#ff003c]" : "border-neutral-200 bg-white hover:bg-neutral-50"} disabled:opacity-60`}>
                      {s.replaceAll("_"," ")}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Items</p>
                <ul className="mt-1 divide-y divide-neutral-100">
                  {data.order_items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">{it.title_snapshot}</p>
                        <p className="text-xs text-neutral-500">{it.quantity} × {formatZar(Number(it.unit_price_zar))}</p>
                      </div>
                      <p className="tabular-nums">{formatZar(Number(it.line_total_zar))}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="border-t border-neutral-100 pt-3 text-right">
                <p className="text-xs text-neutral-500">Subtotal {formatZar(Number(data.subtotal_zar))}</p>
                <p className="text-xs text-neutral-500">Delivery {formatZar(Number(data.delivery_zar))}</p>
                <p className="mt-1 text-lg font-semibold">Total {formatZar(Number(data.total_zar))}</p>
                {data.paystack_reference && <p className="mt-2 text-[11px] text-neutral-500">Paystack ref: {data.paystack_reference}</p>}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}