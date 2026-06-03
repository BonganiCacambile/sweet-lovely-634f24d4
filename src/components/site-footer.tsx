import FooterFramerComponent from "@/framer/footer";

/** Framer-exported site footer with newsletter + nav links. */
export function SiteFooter() {
  return (
    <div className="w-full px-4 sm:px-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <FooterFramerComponent.Responsive />
      </div>
    </div>
  );
}