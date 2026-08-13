import { Mail, Phone, Clock, MapPin } from "lucide-react";
import { useActiveZones } from "@/hooks/use-active-zones";

/**
 * Live, card-based directory of delivery-zone contact details.
 * Data comes straight from public.delivery_zones via listActiveZones,
 * so Admin Panel edits appear here automatically.
 */
export function ZoneContactCards() {
  const { zones, isLoading } = useActiveZones();

  if (isLoading && zones.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100"
          />
        ))}
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No delivery zones are available right now.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="zone-contact-cards">
      {zones.map((z) => (
        <div
          key={z.id}
          data-testid="zone-contact-card"
          className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: z.color ?? "#111111" }}
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-neutral-900">
                {z.name}
              </h3>
              {z.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{z.description}</p>
              ) : null}

              <div className="mt-4 space-y-2.5">
                {z.contact_phone ? (
                  <a
                    href={`tel:${z.contact_phone.replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-2 text-sm font-medium text-neutral-900 hover:underline"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="truncate">{z.contact_phone}</span>
                  </a>
                ) : null}
                {z.contact_email ? (
                  <a
                    href={`mailto:${z.contact_email}`}
                    className="flex items-center gap-2 text-sm text-neutral-700 hover:underline"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="truncate">{z.contact_email}</span>
                  </a>
                ) : null}
                {z.hours_text ? (
                  <p className="flex items-center gap-2 text-sm text-neutral-500">
                    <Clock className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="truncate">{z.hours_text}</span>
                  </p>
                ) : null}
                {z.collection_enabled && z.collection_address ? (
                  <p className="flex items-start gap-2 text-sm text-neutral-500">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <span>{z.collection_address}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}