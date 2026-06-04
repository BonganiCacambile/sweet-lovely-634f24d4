import NavFramerComponent from "@/framer/top-nav/nav";

/** Top navigation rendered with the Framer-exported Nav (all variants/animations preserved). */
export function SiteHeader() {
  return (
    <header className="w-full">
      <NavFramerComponent.Responsive
        variants={{
          base: "Mobile - Default",
          sm: "Mobile - Default",
          md: "Tablet",
          lg: "Desktop",
          xl: "Desktop",
          "2xl": "Desktop",
        }}
      />
    </header>
  );
}