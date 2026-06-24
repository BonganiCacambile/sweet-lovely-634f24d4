import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useRouterState, Navigate } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "@/lib/cart-context";
import { CartFab } from "@/components/cart/cart-fab";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoadingScreen } from "@/components/loading-screen";
import { ZoneProvider } from "@/lib/zone-context";
import { ZonePicker, ZoneChip } from "@/components/zone-picker";
import { NotificationsProvider } from "@/lib/notifications-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sweet & Lovely — Pizza & Delivery" },
      { name: "description", content: "Freshly made pizza and fast delivery from Sweet & Lovely. Browse our menu and find a location near you." },
      { name: "author", content: "Sweet & Lovely" },
      { property: "og:site_name", content: "Sweet & Lovely" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Sweet & Lovely — Pizza & Delivery" },
      { property: "og:description", content: "Freshly made pizza and fast delivery from Sweet & Lovely. Browse our menu and find a location near you." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sweet & Lovely — Pizza & Delivery" },
      { name: "twitter:description", content: "Freshly made pizza and fast delivery from Sweet & Lovely. Browse our menu and find a location near you." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/uVCrXAwreINZTgiVWJQNbGypaU83/social-images/social-1782237028201-IMG-20260613-WA0012.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/uVCrXAwreINZTgiVWJQNbGypaU83/social-images/social-1782237028201-IMG-20260613-WA0012.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://sweet-n-lovely-pizza.lovable.app/#organization",
              name: "Sweet & Lovely",
              url: "https://sweet-n-lovely-pizza.lovable.app/",
              logo: "https://sweet-n-lovely-pizza.lovable.app/logo.png",
            },
            {
              "@type": "WebSite",
              "@id": "https://sweet-n-lovely-pizza.lovable.app/#website",
              name: "Sweet & Lovely",
              url: "https://sweet-n-lovely-pizza.lovable.app/",
              publisher: { "@id": "https://sweet-n-lovely-pizza.lovable.app/#organization" },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>
          <CartProvider>
            <ZoneProvider>
              <AuthGate>
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
              <CartFab />
              <CartDrawer />
              <ZonePicker />
              <FloatingZoneChip />
              </AuthGate>
            </ZoneProvider>
            <Toaster position="top-center" richColors />
          </CartProvider>
        </NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function FloatingZoneChip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hide =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/loading") ||
    pathname.startsWith("/checkout");
  if (hide) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-4 z-40 sm:left-6">
      <ZoneChip />
    </div>
  );
}

const PUBLIC_PREFIXES = ["/auth"];

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, authTransition } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));

  if (authTransition === "signing-out") {
    return <LoadingScreen />;
  }
  if (authTransition === "signing-in" && !user) {
    return <LoadingScreen />;
  }
  if (isPublic) return <>{children}</>;
  if (loading) {
    return <LoadingScreen />;
  }
  if (!user) {
    return <Navigate to="/auth" search={{ redirect: pathname } as never} replace />;
  }
  return <>{children}</>;
}
