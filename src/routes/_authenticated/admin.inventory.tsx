import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, Search, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { formatRelative } from "@/lib/admin/format";
import { listInventory, adjustStock, setLowStockThreshold, listMovements } from "@/lib/admin/inventory.functions";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  component: InventoryPage,
});

type InvRow = Awaited<ReturnType<typeof listInventory>>["rows"][number];

function InventoryPage() {
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<InvRow | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listInventory);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin","inventory","list",{ search: debounced, lowOnly, page }],
    queryFn: () => listFn({ data: { search: debounced, lowOnly, page, pageSize: 50, sortBy: "stock", sortDir: "asc" } }),
  });

  useRealtimeTable("inventory_movements", [["admin","inventory","list"], ["admin","inventory","movements"]], (e) => {
    if (e.eventType === "INSERT") toast.info("Inventory updated");
  });
  useRealtimeTable("products", [["admin","inventory","list"]]);

  const lowCount = (data?.rows ?? []).filter((r) => r.stock <= r.low_stock_threshold).length;

  const exportCols = useMemo(() => ([
    { key: "slug", label: "Slug" },
    { key: "title", label: "Product" },
    { key: "stock", label: "Stock" },
    { key: "low_stock_threshold", label: "Low-stock threshold" },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Track stock levels, low-stock alerts and movement history."
        actions={<ExportMenu rows={data?.rows ?? []} columns={exportCols as never} filename="inventory" />}
      />

      {lowCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <span><strong>{lowCount}</strong> product(s) at or below their low-stock threshold.</span>
          <button onClick={() => setLowOnly(true)} className="ml-auto text-xs font-semibold underline">Show only low stock</button>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search products…" className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only</label>
        </div>

        {error ? <div className="p-4"><ErrorPanel error={error} onRetry={() => void refetch()} /></div>
          : isLoading ? <LoadingRows />
          : (data?.rows.length ?? 0) === 0 ? <div className="p-6"><EmptyState icon={<Boxes className="h-5 w-5" />} title="No products" /></div>
          : (
            <>
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-neutral-500">
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Stock</th>
                      <th className="px-3 py-2 font-medium">Threshold</th>
                      <th className="px-3 py-2 font-medium">Updated</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.rows.map((r) => {
                      const low = r.stock <= r.low_stock_threshold;
                      return (
                        <tr key={r.slug} className="border-t border-neutral-100">
                          <td className="px-3 py-3">
                            <p className="font-medium">{r.title}</p>
                            <p className="text-xs text-neutral-500">{r.slug} · {r.category_slug}</p>
                          </td>
                          <td className={`px-3 py-3 tabular-nums ${low ? "text-rose-600 font-semibold" : ""}`}>{r.stock}</td>
                          <td className="px-3 py-3"><ThresholdEditor slug={r.slug} value={r.low_stock_threshold} /></td>
                          <td className="px-3 py-3 text-xs text-neutral-500">{formatRelative(r.updated_at)}</td>
                          <td className="px-3 py-3 text-right">
                            <div className="inline-flex gap-1">
                              <button onClick={() => setAdjusting(r)} className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50">Adjust</button>
                              <button onClick={() => setHistoryFor(r.slug)} className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50">History</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={data!.pageSize} total={data!.total} onPage={setPage} />
            </>
          )}
      </Card>

      {adjusting && <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} />}
      {historyFor && <HistoryDrawer slug={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function ThresholdEditor({ slug, value }: { slug: string; value: number }) {
  const qc = useQueryClient();
  const fn = useServerFn(setLowStockThreshold);
  const [v, setV] = useState(value);
  const m = useMutation({
    mutationFn: () => fn({ data: { slug, threshold: Number(v) } }),
    onSuccess: () => { toast.success("Threshold saved"); qc.invalidateQueries({ queryKey: ["admin","inventory"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <input type="number" min={0} value={v} onChange={(e) => setV(Number(e.target.value))} onBlur={() => { if (v !== value) m.mutate(); }} className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-xs tabular-nums" />
  );
}

function AdjustModal({ product, onClose }: { product: InvRow; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(adjustStock);
  const [delta, setDelta] = useState(0);
  const [type, setType] = useState<"restock" | "adjustment" | "return" | "sale">("restock");
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { slug: product.slug, delta: Number(delta), type, reason: reason || undefined } }),
    onSuccess: () => { toast.success("Stock adjusted"); qc.invalidateQueries({ queryKey: ["admin","inventory"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">Adjust stock</p>
            <h2 className="text-lg font-semibold">{product.title}</h2>
            <p className="text-xs text-neutral-500">Current: {product.stock}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </div>
        <form className="mt-4 space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as never)} className="w-full rounded-xl border border-neutral-200 px-3 py-2">
              <option value="restock">Restock (+)</option>
              <option value="adjustment">Adjustment (±)</option>
              <option value="return">Return (+)</option>
              <option value="sale">Sale (-)</option>
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Delta (use negative numbers to deduct)</span>
            <input type="number" required value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="w-full rounded-xl border border-neutral-200 px-3 py-2 tabular-nums" />
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Reason (optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-3 py-2" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs">Cancel</button>
            <button type="submit" disabled={m.isPending || delta === 0} className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e6003a] disabled:opacity-60">{m.isPending ? "Saving…" : "Apply"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryDrawer({ slug, onClose }: { slug: string; onClose: () => void }) {
  const fn = useServerFn(listMovements);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin","inventory","movements", slug], queryFn: () => fn({ data: { slug, page: 1, pageSize: 100 } }) });
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-neutral-900/40" onClick={onClose} />
      <aside className="flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-100 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">Movements</p>
            <h2 className="text-lg font-semibold">{slug}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 p-4">
          {error ? <ErrorPanel error={error} /> : isLoading ? <LoadingRows rows={4} /> : (data?.rows.length ?? 0) === 0 ? <EmptyState title="No movements yet" /> : (
            <ul className="divide-y divide-neutral-100">
              {data!.rows.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{m.type} <span className={m.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}>({m.quantity >= 0 ? "+" : ""}{m.quantity})</span></p>
                    {m.reason && <p className="text-xs text-neutral-500">{m.reason}</p>}
                    <p className="text-[11px] text-neutral-400">{m.actor_email ?? "system"} · {formatRelative(m.created_at)}</p>
                  </div>
                  <p className="tabular-nums text-neutral-600">→ {m.balance_after}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}