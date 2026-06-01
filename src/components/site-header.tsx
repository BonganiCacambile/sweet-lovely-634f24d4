import NavFramerComponent from "@/framer/top-nav/nav";

/** Top navigation rendered with the Framer-exported Nav (all variants/animations preserved). */
export function SiteHeader() {
  return (
    <header className="w-full">
      <NavFramerComponent.Responsive />
    </header>
  );
}