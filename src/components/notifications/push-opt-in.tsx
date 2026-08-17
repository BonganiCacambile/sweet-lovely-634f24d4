import { useEffect, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  enablePushOnThisDevice,
  hasDeclined,
  isEnabledOnThisDevice,
  rememberDeclined,
  touchDevice,
  webPermission,
} from "@/lib/push/push-service";
import { isNativeRuntime } from "@/lib/push/platform";

/**
 * Soft opt-in. It never fires the OS permission prompt on load — the prompt
 * only appears after the customer taps "Enable". A decline is remembered, so
 * we never nag; they can still turn it on from Account → Notifications.
 */
export function PushOptInPrompt() {
  const { user, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (isEnabledOnThisDevice()) {
      void touchDevice();
      return;
    }
    if (hasDeclined()) return;
    if (!isNativeRuntime() && webPermission() === "unsupported") return;
    // Let the page settle first — this is a suggestion, not an interruption.
    const t = setTimeout(() => setShow(true), 6000);
    return () => clearTimeout(t);
  }, [user, loading]);

  if (!show) return null;

  const dismiss = () => {
    rememberDeclined();
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    const res = await enablePushOnThisDevice();
    setBusy(false);
    setShow(false);
    if (res.ok) toast.success("Notifications enabled on this device");
    else if (res.reason === "denied") toast("You can enable notifications later in Account → Notifications");
    else toast.error(res.message ?? "Couldn't enable notifications on this device");
  };

  return (
    <div
      data-testid="push-opt-in"
      className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl md:bottom-6 md:right-6 md:left-auto"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">Know the moment your order moves</p>
          <p className="mt-1 text-xs text-neutral-600">
            Get alerts when your order is confirmed, prepared, out for delivery or ready for collection —
            even when the app isn't open. Promotions stay off unless you switch them on.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              data-testid="push-opt-in-enable"
              onClick={() => void enable()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Enable notifications
            </button>
            <button
              onClick={dismiss}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}