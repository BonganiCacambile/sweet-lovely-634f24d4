import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { isNativeRuntime } from "@/lib/push/platform";
import { attachNativePushListeners, clearNativeNotificationTray } from "@/lib/push/native";
import { useNotifications } from "@/lib/notifications-context";

/**
 * Wires OS-delivered push (FCM/APNs) into the running app: foreground pushes
 * become in-app toasts, taps deep-link to the order, and the bell refreshes.
 * Renders nothing and does nothing at all on the web.
 */
export function NativePushBridge() {
  const navigate = useNavigate();
  const { refresh } = useNotifications();

  useEffect(() => {
    if (!isNativeRuntime()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void attachNativePushListeners({
      onReceived: ({ title, body, url }) => {
        void refresh();
        toast(title, {
          description: body || undefined,
          action: url ? { label: "View", onClick: () => void navigate({ to: url }) } : undefined,
        });
      },
      onOpened: (url) => {
        void refresh();
        void clearNativeNotificationTray();
        if (url) void navigate({ to: url });
      },
    }).then((off) => {
      if (cancelled) off();
      else cleanup = off;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [navigate, refresh]);

  return null;
}
