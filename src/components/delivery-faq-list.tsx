import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { listActiveZones, type PublicZone } from "@/lib/zones.functions";

interface FaqItem {
  title: string;
  body: React.ReactNode;
}

const ZONES_KEY = ["zones", "active"] as const;

function formatNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const formatZar = (v: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(v);

function buildFaqItems(zones: PublicZone[]): FaqItem[] {
  const count = zones.length;
  const names = zones.map((z) => z.name);
  const empty = count === 0;

  const fees = zones.map((z) => z.fee_zar);
  const minOrders = zones.map((z) => z.min_order_zar);
  const etas = zones.map((z) => z.eta_minutes);
  const minFee = fees.length ? Math.min(...fees) : 0;
  const maxFee = fees.length ? Math.max(...fees) : 0;
  const minEta = etas.length ? Math.min(...etas) : 0;
  const maxEta = etas.length ? Math.max(...etas) : 0;
  const minOrder = minOrders.length ? Math.min(...minOrders) : 0;

  const feeRange = minFee === maxFee ? formatZar(minFee) : `${formatZar(minFee)}–${formatZar(maxFee)}`;
  const etaRange = minEta === maxEta ? `${minEta} minutes` : `${minEta}–${maxEta} minutes`;

  const hoursSet = Array.from(new Set(zones.map((z) => z.hours_text).filter(Boolean) as string[]));
  const hoursLine =
    hoursSet.length === 0
      ? null
      : hoursSet.length === 1
        ? hoursSet[0]
        : "Hours vary by location.";

  return [
    {
      title: "Delivery Zones",
      body: (
        <div className="space-y-2 text-neutral-700">
          {empty ? (
            <p>Delivery zones are currently being configured. Please check back soon.</p>
          ) : (
            <>
              <p>
                We currently deliver across {count} active delivery {count === 1 ? "zone" : "zones"} — {formatNames(names)}.
              </p>
              <p>Enter your address at checkout to see live availability and estimated delivery time for your spot.</p>
            </>
          )}
        </div>
      ),
    },
    {
      title: "Delivery Methods & Fees",
      body: (
        <div className="space-y-2 text-neutral-700">
          {empty ? (
            <p>Delivery options will appear once zones are configured.</p>
          ) : (
            <>
              <p>
                Delivery {minFee === maxFee ? "is" : "ranges from"} <strong>{feeRange}</strong> and typically arrives in {etaRange}, depending on your zone.
              </p>
              <p>
                Minimum order {minOrders.every((m) => m === minOrder) ? "is" : "starts at"} <strong>{formatZar(minOrder)}</strong>. Fees and minimums vary by delivery zone — see your zone at checkout for exact pricing.
              </p>
            </>
          )}
        </div>
      ),
    },
    {
      title: "Pickup Info",
      body: (
        <div className="space-y-2 text-neutral-700">
          {empty ? (
            <p>Pickup details will appear once locations are configured.</p>
          ) : (
            <>
              <p>
                Skip the fee — order online and collect from any of our {count} {count === 1 ? "location" : "locations"}: {formatNames(names)}.
              </p>
              {hoursLine ? <p>Pickup hours: {hoursLine}</p> : null}
              <p>You&apos;ll get a notification the moment your order is ready so it&apos;s in your hands while it&apos;s still hot.</p>
            </>
          )}
        </div>
      ),
    },
  ];
}

export function DeliveryFaqList() {
  const [open, setOpen] = useState<number | null>(0);
  const fetchZones = useServerFn(listActiveZones);
  const { data: zones } = useQuery({
    queryKey: ZONES_KEY,
    queryFn: () => fetchZones(),
  });
  useRealtimeTable("delivery_zones", [ZONES_KEY]);
  const items = buildFaqItems(zones ?? []);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-2">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.title}
            className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-neutral-50"
              aria-expanded={isOpen}
            >
              <span className="text-lg font-semibold text-neutral-900 md:text-xl">
                <span className="mr-2 text-neutral-400">{i + 1}.</span>
                {item.title}
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6 pt-0 text-base leading-relaxed">
                  {item.body}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}