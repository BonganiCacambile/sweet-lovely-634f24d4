import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Section } from "@/components/section";
import { SiteFooter } from "@/components/site-footer";
import ContactFormFramerComponent from "@/framer/contact-form";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Pepper" },
      { name: "description", content: "Get in touch with Pepper — questions, feedback, catering." },
      { property: "og:title", content: "Contact — Pepper" },
      { property: "og:description", content: "Get in touch with Pepper — questions, feedback, catering." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteHeader />
      <Section title="Contact us" subtitle="We'd love to hear from you.">
        <div className="mx-auto flex max-w-3xl justify-center">
          <ContactFormFramerComponent.Responsive />
        </div>
      </Section>
      <SiteFooter />
    </div>
  );
}