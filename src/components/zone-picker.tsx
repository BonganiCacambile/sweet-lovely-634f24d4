import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import { MapPin, Clock, Truck, X, Check } from "lucide-react";
import { useZone } from "@/lib/zone-context";
import { formatPrice } from "@/lib/cart-context";

/**
 * Modal zone picker. Auto-opens on customer routes when no zone is selected.
 * Admin and auth routes are skipped.
 */
export function ZonePicker() {
  const { zones, loading, selected, setSelectedSlug, pickerOpen, openPicker, closePicker } =
    useZone();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isCustomerRoute =
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/loading");

  // Auto-open on customer routes when no zone is chosen.
  React.useEffect(() => {
    if (!isCustomerRoute) return;
    if (loading) return;
    if (!selected && zones.length > 0 && !pickerOpen) openPicker();
  }, [isCustomerRoute, loading, selected, zones.length, pickerOpen, openPicker]);

  if (!pickerOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        onClick={selected ? closePicker : undefined}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#ff003c]">
              Delivery zone
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900">
              Where are we delivering?
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Choose your area so we can show accurate fees and ETAs.
            </p>
          </div>
          {selected && (
            <button
              onClick={closePicker}
              className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-neutral-100" />
              ))}
            </div>
          ) : zones.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">
              No active delivery zones right now. Please check back soon.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {zones.map((z) => {
                const active = selected?.slug === z.slug;
                return (
                  <li key={z.id}>
                    <button
                      onClick={() => {
                        setSelectedSlug(z.slug);
                        closePicker();
                      }}
                      className={
                        "group relative flex w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg " +
                        (active
                          ? "border-[#ff003c] bg-[#fff0f3]"
                          : "border-neutral-200 bg-white hover:border-neutral-300")
                      }
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ background: z.color ?? "#ff003c" }}
                          />
                          <h3 className="text-base font-bold tracking-tight">{z.name}</h3>
                        </div>
                        {active && (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#ff003c] text-white">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      {z.description && (
                        <p className="text-xs text-neutral-500">{z.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
                        <span className="inline-flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {formatPrice(z.fee_zar)} fee
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> ~{z.eta_minutes} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> min {formatPrice(z.min_order_zar)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact chip that shows the current zone and opens the picker. */
export function ZoneChip({ className }: { className?: string }) {
  const { selected, openPicker, loading } = useZone();
  if (loading) return null;
  return (
    <button
      onClick={openPicker}
      className={
        "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm backdrop-blur-md transition hover:bg-white " +
        (className ?? "")
      }
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: selected?.color ?? "#ff003c" }}
      />
      <MapPin className="h-3.5 w-3.5" />
      {selected ? selected.name : "Choose zone"}
    </button>
  );
}