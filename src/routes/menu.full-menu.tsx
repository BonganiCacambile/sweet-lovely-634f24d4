import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/menu/full-menu")({
  head: () => ({
    meta: [
      { title: "Full Menu — Pepper" },
      { name: "description", content: "Browse the full Pepper menu — pizzas, sides and desserts." },
      { property: "og:title", content: "Full Menu — Pepper" },
      { property: "og:description", content: "Browse the full Pepper menu — pizzas, sides and desserts." },
    ],
  }),
  component: FullMenuPage,
});

function FullMenuPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Full Menu</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Menu items will appear here once connected to the backend.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm underline">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}