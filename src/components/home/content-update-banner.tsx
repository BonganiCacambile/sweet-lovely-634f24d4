import { Sparkles } from "lucide-react";

/**
 * YouTube/X-style "new content available" pill. Non-intrusive, only refreshes
 * home data (never the whole app) when the customer opts in.
 */
export function ContentUpdateBanner({
  visible,
  onRefresh,
  onDismiss,
  busy,
}: {
  visible: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="home-content-update-banner"
      className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8"
    >
      <div className="flex items-center gap-3 rounded-full border border-border bg-foreground/95 px-4 py-2.5 text-sm text-background shadow-lg backdrop-blur">
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-medium">New menu updates are available</span>
        <button
          type="button"
          data-testid="home-content-refresh"
          onClick={onRefresh}
          disabled={busy}
          className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
        <button
          type="button"
          data-testid="home-content-later"
          onClick={onDismiss}
          className="rounded-full px-2 py-1 text-xs font-medium opacity-70 transition hover:opacity-100"
        >
          Later
        </button>
      </div>
    </div>
  );
}