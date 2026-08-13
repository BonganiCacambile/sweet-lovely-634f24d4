import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CityGrid } from "@/components/city-grid";
import { DeliveryFaqList } from "@/components/delivery-faq-list";
import { useActiveZoneCities, useActiveZones } from "@/hooks/use-active-zones";
import { ContactForm } from "@/components/contact-form";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Sweet & Lovely" },
      { name: "description", content: "Get in touch with Sweet & Lovely — questions, feedback, catering." },
      { property: "og:title", content: "Contact — Sweet & Lovely" },
      { property: "og:description", content: "Get in touch with Sweet & Lovely — questions, feedback, catering." },
      { property: "og:url", content: "https://sweet-n-lovely-pizza.lovable.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://sweet-n-lovely-pizza.lovable.app/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { cities } = useActiveZoneCities();
  const { zones, isLoading: zonesLoading } = useActiveZones();
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />

      {/* Hero */}
      <section className="w-full px-4 pt-12 sm:px-6 sm:pt-16 md:pt-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl md:text-7xl lg:text-8xl">
            Contact Us
          </h1>
          <p className="mt-6 max-w-2xl text-sm text-neutral-900 sm:mt-8 sm:text-base md:text-lg">
            Whether you have a question, feedback, or just want to say hi, we&apos;re always here for you.
            Reach out and let us know how we can make your experience even better.
          </p>
        </div>
      </section>

      {/* Addresses + Form */}
      <section className="w-full px-4 py-12 sm:px-6 sm:py-16 md:py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Addresses */}
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl md:text-3xl">
              Addresses
            </h2>
            {zonesLoading && zones.length === 0 ? (
              <p className="mt-6 text-sm text-neutral-500">Loading locations…</p>
            ) : zones.length === 0 ? (
              <p className="mt-6 text-sm text-neutral-500">
                No delivery locations are available yet.
              </p>
            ) : (
              <div className="mt-6 grid gap-8 sm:mt-8 sm:grid-cols-2 sm:gap-10">
                {zones.map((z) => (
                  <div key={z.id}>
                    <h3 className="text-base font-semibold text-neutral-900">{z.name}:</h3>
                    {z.description ? (
                      <p className="mt-3 text-sm text-neutral-700">{z.description}</p>
                    ) : null}
                    {z.contact_email ? (
                      <a
                        href={`mailto:${z.contact_email}`}
                        className="mt-3 block break-all text-sm text-neutral-400 hover:text-neutral-600"
                      >
                        {z.contact_email}
                      </a>
                    ) : null}
                    {z.contact_phone ? (
                      <a
                        href={`tel:${z.contact_phone.replace(/\s+/g, "")}`}
                        className="mt-3 block text-sm text-neutral-900 hover:text-neutral-600"
                      >
                        {z.contact_phone}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form */}
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl md:text-3xl">
              Write Us a Message
            </h2>
            <div className="mt-6 sm:mt-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Maps & Delivery Info */}
      <section className="w-full px-4 pb-12 sm:px-6 sm:pb-16 md:pb-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl md:text-5xl lg:text-6xl">
            Maps & Delivery Info
          </h2>
          <div className="mt-8 sm:mt-10">
            <CityGrid cities={cities} />
          </div>
          <div className="mt-12 sm:mt-16">
            <DeliveryFaqList />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}