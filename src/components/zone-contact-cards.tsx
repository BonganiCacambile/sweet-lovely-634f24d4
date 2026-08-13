import { MapPin, Phone, Mail, Clock } from "lucide-react";
import type { PublicZone } from "@/lib/zones.functions";

interface Props {
  zones: PublicZone[];
  isLoading?: boolean;
}

/** Customer-facing delivery zone contact cards (live Supabase data). */
export function ZoneContactCards({ zones, isLoading }: Props) {
  if (isLoading && zones.length === 0) {
    return <p className="text-sm text-neutral-500">Loading delivery zones…</p>;
  }
  if (zones.length === 0) {
    return <p className="text-sm text-neutral-500">No delivery zones are available yet.</p>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {zones.map((z) => {
        const address = z.collection_address || z.description;
        return (
          <article
            key={z.id}
            className="group rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_36px_-22px_rgba(255,0,60,0.35)]"
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: z.color || "#ff003c" }}
                aria-hidden="true"
              >
                <MapPin className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-neutral-900">{z.name}</h3>
            </div>

            <ul className="mt-5 space-y-3 text-sm">
              {address ? (
                <li className="flex items-start gap-3 text-neutral-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  <span>{address}</span>
                </li>
              ) : null}
              {z.contact_phone ? (
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  <a
                    href={`tel:${z.contact_phone.replace(/[^\d+]/g, "")}`}
                    className="min-h-[24px] font-medium text-neutral-900 underline-offset-4 hover:text-primary hover:underline"
                  >
                    {z.contact_phone}
                  </a>
                </li>
              ) : null}
              {z.contact_email ? (
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  <a
                    href={`mailto:${z.contact_email}`}
                    className="break-all text-neutral-700 underline-offset-4 hover:text-primary hover:underline"
                  >
                    {z.contact_email}
                  </a>
                </li>
              ) : null}
              {z.hours_text ? (
                <li className="flex items-start gap-3 text-neutral-500">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  <span>{z.hours_text}</span>
                </li>
              ) : null}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
