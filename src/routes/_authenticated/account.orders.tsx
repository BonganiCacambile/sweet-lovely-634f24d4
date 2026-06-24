import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AccountShell, Card } from "@/components/auth/account-shell";
import {
  ShoppingBag,
  Loader2,
  ArrowRight,
  Search,
  RefreshCw,
  FileText,
  XCircle,
  Trash2,
} from "lucide-react";
import { getMyOrders, cancelMyOrder, deleteMyOrder } from "@/lib/orders.functions";
import { formatPrice, useCart } from "@/lib/cart-context";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account/orders")({
  head: () => ({ meta: [{ title: "Your orders — Sweet & Lovely" }] }),
  component: OrdersPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  preparing: "bg-amber-50 text-amber-700",
  out_for_delivery: "bg-blue-50 text-blue-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-neutral-100 text-neutral-600",
  refunded: "bg-rose-50 text-rose-700",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "preparing", label: "Processing" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
] as const;

function OrdersPage() {
  const fetchOrders = useServerFn(getMyOrders);
  const cancelFn = useServerFn(cancelMyOrder);
  const deleteFn = useServerFn(deleteMyOrder);
  const qc = useQueryClient();
  const cart = useCart();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => fetchOrders(),
  });
  useRealtimeInvalidate(["orders", "order_items"], [["my-orders"]]);

  const cancelOrder = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["account-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't cancel"),
  });

  const removeOrder = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Order removed");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["account-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't delete"),
  });

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");

  const orders = data?.orders ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && String(o.status) !== filter) return false;
      if (!q) return true;
      return (
        String(o.order_number).toLowerCase().includes(q) ||
        (o.order_items ?? []).some((it) => String(it.title_snapshot).toLowerCase().includes(q))
      );
    });
  }, [orders, filter, search]);

  const reorder = (o: (typeof orders)[number]) => {
    let added = 0;
    for (const it of o.order_items ?? []) {
      cart.addItem(
        {
          id: it.product_slug ?? `${o.id}-${it.id}`,
          title: it.title_snapshot,
          price: Number(it.unit_price_zar),
        },
        it.quantity,
      );
      added += it.quantity;
    }
    toast.success(`Added ${added} item${added === 1 ? "" : "s"} to cart`);
  };

  if (isLoading) {
    return (
      <AccountShell title="Orders">
        <Card>
          <div className="flex items-center justify-center py-10 text-neutral-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your orders…
          </div>
        </Card>
      </AccountShell>
    );
  }

  if (isError) {
    return (
      <AccountShell title="Orders">
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-neutral-600">We couldn't load your orders right now.</p>
            <button
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Try again
            </button>
          </div>
        </Card>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="Orders">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order # or item"
              className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#ff003c]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                  (filter === f.key
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
              <ShoppingBag className="h-6 w-6" />
            </span>
            <p className="text-base font-semibold text-neutral-900">
              {orders.length === 0 ? "No orders yet" : "No matching orders"}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {orders.length === 0
                ? "When you place your first order it'll show up here."
                : "Try clearing your filters or search."}
            </p>
            {orders.length === 0 && (
              <Link
                to="/menu/full-menu"
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white"
              >
                Browse menu <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {filtered.map((o) => {
            const status = (o.status ?? "preparing").toLowerCase();
            const created = o.created_at ? new Date(o.created_at) : null;
            return (
              <Card key={o.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-neutral-500">
                      Order #{o.order_number}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {created
                        ? created.toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize " +
                      (STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600")
                    }
                  >
                    {status.replaceAll("_", " ")}
                  </span>
                </div>

                <ul className="mt-4 divide-y divide-neutral-100 text-sm">
                  {(o.order_items ?? []).map((it) => (
                    <li key={it.id} className="flex items-center justify-between py-2">
                      <span className="text-neutral-800">
                        {it.title_snapshot}
                        <span className="ml-2 text-xs text-neutral-500">× {it.quantity}</span>
                      </span>
                      <span className="font-medium text-neutral-900">
                        {formatPrice(Number(it.line_total_zar))}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-neutral-200 pt-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/account/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      <FileText className="h-3.5 w-3.5" /> Details & invoice
                    </Link>
                    <button
                      onClick={() => reorder(o)}
                      className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Reorder
                    </button>
                    {!["cancelled", "refunded", "delivered", "completed"].includes(status) && (
                      <button
                        onClick={() => {
                          if (confirm(`Cancel order #${o.order_number}? This cannot be undone.`))
                            cancelOrder.mutate(o.id);
                        }}
                        disabled={cancelOrder.isPending}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </button>
                    )}
                    {["cancelled", "refunded", "delivered", "completed"].includes(status) && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete order #${o.order_number} from your history?`))
                            removeOrder.mutate(o.id);
                        }}
                        disabled={removeOrder.isPending}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                  <span className="text-base font-extrabold text-neutral-900">
                    {formatPrice(Number(o.total_zar))}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}