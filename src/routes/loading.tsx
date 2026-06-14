import { createFileRoute } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/loading-screen";

export const Route = createFileRoute("/loading")({
  head: () => ({
    meta: [
      { title: "Loading… | Sweet & Lovely" },
      { name: "description", content: "Just a moment while we prepare something delicious." },
    ],
  }),
  component: LoadingRoute,
});

function LoadingRoute() {
  return <LoadingScreen message="Preparing something delicious" />;
}
