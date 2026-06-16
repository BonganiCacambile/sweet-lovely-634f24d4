import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { getMyOrderDetail } from "@/lib/account/account.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { formatPrice, useCart } from "@/lib/cart-context";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Printer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order details — Sweet & Lovely" }] }),
  component: OrderDetailPage,
});

const STAGES = [
  { key: "pending", label: "Received", icon: Clock },
  { key: "preparing", label: "Preparing", icon: Package },
  { key: "out_for_delivery", label: "Out for delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const cart = useCart();
  const fetchDetail = useServerFn(getMyOrderDetail);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-order", orderId],
    queryFn: () => fetchDetail({ data: { id: orderId } }),
  });
  useRealtimeInvalidate(["orders", "order_items"], [["my-order", orderId]]);

  if (isLoading) {
    return (
      <AccountShell title="Order">
        <Card>
          <div className="flex items-center justify-center py-10 text-neutral-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading order…
          </div>
        </Card>
      </AccountShell>
    );
  }

  if (isError || !data) {
    return (
      <AccountShell title="Order">
        <Card>
          <p className="text-sm text-neutral-600">We couldn't load this order.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Try again
          </button>
        </Card>
      </AccountShell>
    );
  }

  const o = data.order;
  const status = String(o.status).toLowerCase();
  const cancelled = status === "cancelled" || status === "refunded";
  const stageIndex = STAGES.findIndex((s) => s.key === status);

  const reorder = () => {
    let added = 0;
    for (const it of o.order_items ?? []) {
      cart.addItem(
        { id: it.product_slug ?? `${o.id}-${it.id}`, title: it.title_snapshot, price: Number(it.unit_price_zar) },
        it.quantity,
      );
      added += it.quantity;
    }
    toast.success(`Added ${added} item${added === 1 ? "" : "s"} to cart`);
  };

  return (
    <AccountShell title={`Order #${o.order_number}`}>
      <div className="space-y-4">
        <Link
          to="/account/orders"
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-[#ff003c]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to orders
        </Link>

        {/* Tracking */}
        <Card>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Tracking</p>
          {cancelled ? (
            <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium capitalize text-neutral-700">
              Order {status}
            </p>
          ) : (
            <ol className="mt-4 grid grid-cols-4 gap-2">
              {STAGES.map((s, idx) => {
                const reached = idx <= stageIndex;
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex flex-col items-center text-center">
                    <span
                      className={
                        "flex h-9 w-9 items-center justify-center rounded-full " +
                        (reached ? "bg-[#ff003c] text-white" : "bg-neutral-100 text-neutral-400")
                      }
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={"mt-2 text-[11px] font-medium " + (reached ? "text-neutral-900" : "text-neutral-400")}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Items */}
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Items</p>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                <Printer className="h-3.5 w-3.5" /> Print invoice
              </button>
              <button
                onClick={reorder}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reorder
              </button>
            </div>
          </div>
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {(o.order_items ?? []).map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2">
                <span className="text-neutral-800">
                  {it.title_snapshot}
                  <span className="ml-2 text-xs text-neutral-500">× {it.quantity}</span>
                </span>
                <span className="font-medium text-neutral-900">{formatPrice(Number(it.line_total_zar))}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-dashed border-neutral-200 pt-3 text-sm">
            <Row label="Subtotal" value={formatPrice(Number(o.subtotal_zar))} />
            <Row label="Delivery" value={formatPrice(Number(o.delivery_zar))} />
            <Row label="Total" value={formatPrice(Number(o.total_zar))} bold />
          </dl>
        </Card>

        {/* Customer */}
        <Card>
          <p className="text-sm font-semibold text-neutral-900">Delivery & contact</p>
          <dl className="mt-3 space-y-1 text-sm">
            <Row label="Name" value={o.customer_name} />
            <Row label="Email" value={o.customer_email ?? "—"} />
            <Row label="Phone" value={o.customer_phone ?? "—"} />
            <Row label="Address" value={o.address ?? "—"} />
            {o.notes && <Row label="Notes" value={o.notes} />}
            {o.paystack_reference && <Row label="Payment ref" value={o.paystack_reference} />}
          </dl>
        </Card>
      </div>
    </AccountShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={"text-right " + (bold ? "text-base font-extrabold text-neutral-900" : "font-medium text-neutral-800")}>
        {value}
      </dd>
    </div>
  );
}