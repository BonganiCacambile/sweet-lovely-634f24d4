import { createFileRoute } from "@tanstack/react-router";
import { FramerShowcase } from "@/components/framer-showcase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pepper — Pizza & Delivery" },
      { name: "description", content: "Fresh pizza, fast delivery. Browse the menu and find a Pepper near you." },
      { property: "og:title", content: "Pepper — Pizza & Delivery" },
      { property: "og:description", content: "Fresh pizza, fast delivery. Browse the menu and find a Pepper near you." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-white py-10">
      <FramerShowcase />
    </div>
  );
}
