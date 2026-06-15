import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { ShoppingBag, Loader2, ArrowRight } from "lucide-react";
import { getMyOrders } from "@/lib/orders.functions";
import { formatPrice } from "@/lib/cart-context";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export const Route = createFileRoute("/_authenticated/account/orders")({
  head: () => ({ meta: [{ title: "Your orders — Sweet & Lovely" }] }),
  component: OrdersPage,
});

const STATUS_STYLES: Record<string, string> = {
  preparing: "bg-amber-50 text-amber-700",
  out_for_delivery: "bg-blue-50 text-blue-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-neutral-100 text-neutral-600",
};

function OrdersPage() {
  const fetchOrders = useServerFn(getMyOrders);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => fetchOrders(),
  });
  useRealtimeInvalidate(["orders", "order_items"], [["my-orders"]]);

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

  const orders = data?.orders ?? [];

  if (orders.length === 0) {
    return (
      <AccountShell title="Orders">
        <Card>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
              <ShoppingBag className="h-6 w-6" />
            </span>
            <p className="text-base font-semibold text-neutral-900">No orders yet</p>
            <p className="mt-1 text-sm text-neutral-500">
              When you place your first order it'll show up here.
            </p>
            <Link
              to="/menu/full-menu"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white"
            >
              Browse menu <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="Orders">
      <div className="space-y-4">
        {orders.map((o) => {
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
                      ? created.toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
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

              <div className="mt-4 flex items-center justify-between border-t border-dashed border-neutral-200 pt-3">
                <span className="text-xs text-neutral-500">Total</span>
                <span className="text-base font-extrabold text-neutral-900">
                  {formatPrice(Number(o.total_zar))}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </AccountShell>
  );
}