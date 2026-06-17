import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import ContactFormFramerComponent from "@/framer/contact-form";
import { CityGrid } from "@/components/city-grid";
import { DeliveryFaqList } from "@/components/delivery-faq-list";
import { useActiveZoneCities } from "@/hooks/use-active-zones";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Sweet & Lovely" },
      { name: "description", content: "Get in touch with Sweet & Lovely — questions, feedback, catering." },
      { property: "og:title", content: "Contact — Pepper" },
      { property: "og:description", content: "Get in touch with Pepper — questions, feedback, catering." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { cities } = useActiveZoneCities();
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
            <div className="mt-6 grid gap-8 sm:mt-8 sm:grid-cols-2 sm:gap-10">
              {ADDRESSES.map((a) => (
                <div key={a.city}>
                  <h3 className="text-base font-semibold text-neutral-900">{a.city}:</h3>
                  <p className="mt-3 text-sm text-neutral-700">{a.address}</p>
                  <a
                    href={`mailto:${a.email}`}
                    className="mt-3 block break-all text-sm text-neutral-400 hover:text-neutral-600"
                  >
                    {a.email}
                  </a>
                  <p className="mt-3 text-sm text-neutral-900">{a.phone}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl md:text-3xl">
              Write Us a Message
            </h2>
            <div className="mt-6 w-full overflow-hidden sm:mt-8">
              <ContactFormFramerComponent.Responsive
                variants={{
                  base: "Mobile",
                  sm: "Mobile",
                  md: "Desktop",
                  lg: "Desktop",
                  xl: "Desktop",
                  "2xl": "Desktop",
                }}
                style={{ width: "100%", maxWidth: "100%" }}
              />
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

const ADDRESSES = [
  {
    city: "New York",
    address: "113 E31st St, New York, NY 10016",
    email: "newyork@sweetandlovely.pizza",
    phone: "+01 222 555 444",
  },
  {
    city: "London",
    address: "Ingeni Building, Broadwick St, London W1F 0DL, UK",
    email: "london@sweetandlovely.pizza",
    phone: "+44 333 555 777",
  },
  {
    city: "Amsterdam",
    address: "Keizersgracht 351, 1016 EZ Amsterdam, Netherlands",
    email: "amsterdam@sweetandlovely.pizza",
    phone: "+31 555 444 222",
  },
  {
    city: "Berlin",
    address: "Genter Str. 14, 13353 Berlin, Germany",
    email: "berlin@sweetandlovely.pizza",
    phone: "+49 777 333 888",
  },
  {
    city: "Bucharest",
    address: "Strada General Christian Tell 1-3, București 030167",
    email: "bucharest@sweetandlovely.pizza",
    phone: "+40 555 444 777",
  },
];