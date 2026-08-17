/**
 * Capacitor-specific push implementation (Android/FCM + iOS/APNs).
 *
 * Everything is loaded through a dynamic import so the web bundle never
 * evaluates the native plugin: on the web these helpers simply no-op and the
 * browser Notification channel in `push-service.ts` stays in charge.
 */
import { detectPlatform, isNativeRuntime } from "./platform";

type PermissionStatus = { receive: "prompt" | "prompt-with-rationale" | "granted" | "denied" };
type PluginListenerHandle = { remove: () => Promise<void> };

type NativeNotification = {
  id?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type PushPlugin = {
  checkPermissions: () => Promise<PermissionStatus>;
  requestPermissions: () => Promise<PermissionStatus>;
  register: () => Promise<void>;
  removeAllDeliveredNotifications: () => Promise<void>;
  createChannel?: (channel: {
    id: string;
    name: string;
    description?: string;
    importance: 1 | 2 | 3 | 4 | 5;
    visibility?: -1 | 0 | 1;
    sound?: string;
    vibration?: boolean;
  }) => Promise<void>;
  addListener: {
    (event: "registration", cb: (token: { value: string }) => void): Promise<PluginListenerHandle>;
    (event: "registrationError", cb: (err: { error: string }) => void): Promise<PluginListenerHandle>;
    (event: "pushNotificationReceived", cb: (n: NativeNotification) => void): Promise<PluginListenerHandle>;
    (
      event: "pushNotificationActionPerformed",
      cb: (a: { actionId: string; notification: NativeNotification }) => void,
    ): Promise<PluginListenerHandle>;
  };
};

async function loadPlugin(): Promise<PushPlugin | null> {
  if (!isNativeRuntime()) return null;
  try {
    const mod = await import("@capacitor/push-notifications");
    return mod.PushNotifications as unknown as PushPlugin;
  } catch {
    return null;
  }
}

/** Android needs an explicit high-importance channel for order updates. */
async function ensureOrderChannel(plugin: PushPlugin) {
  if (detectPlatform() !== "android" || !plugin.createChannel) return;
  try {
    await plugin.createChannel({
      id: "orders",
      name: "Order updates",
      description: "Confirmations, preparation, delivery and collection alerts",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* channel already exists */
  }
}

/**
 * Requests OS permission and resolves the FCM/APNs token. Returns null on the
 * web, when the plugin is missing, or when the customer declines.
 */
export async function acquireNativePushToken(): Promise<{ token: string; provider: string } | null> {
  const plugin = await loadPlugin();
  if (!plugin) return null;
  try {
    let status = await plugin.checkPermissions();
    if (status.receive !== "granted") status = await plugin.requestPermissions();
    if (status.receive !== "granted") return null;

    await ensureOrderChannel(plugin);

    const token = await new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void Promise.all(handles.map((h) => h.then((x) => x.remove()).catch(() => {})));
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), 15000);
      const handles = [
        plugin.addListener("registration", (t) => finish(t.value || null)),
        plugin.addListener("registrationError", () => finish(null)),
      ];
      void plugin.register();
    });

    if (!token) return null;
    return { token, provider: detectPlatform() === "ios" ? "apns" : "fcm" };
  } catch {
    return null;
  }
}

export type NativePushHandlers = {
  /** Fired while the app is in the foreground; the OS does not show a banner then. */
  onReceived?: (n: { title: string; body: string; url: string | null; data: Record<string, unknown> }) => void;
  /** Fired when the customer taps the notification (cold start or background). */
  onOpened?: (url: string | null, data: Record<string, unknown>) => void;
};

function deepLinkOf(n: NativeNotification): string | null {
  const data = (n.data ?? {}) as Record<string, unknown>;
  const url = data["url"];
  if (typeof url === "string" && url.startsWith("/")) return url;
  const orderId = data["order_id"];
  if (typeof orderId === "string" && orderId) return `/account/orders/${orderId}`;
  return null;
}

/**
 * Attaches the runtime listeners. Returns a cleanup function; on the web it
 * attaches nothing and the cleanup is a no-op.
 */
export async function attachNativePushListeners(handlers: NativePushHandlers): Promise<() => void> {
  const plugin = await loadPlugin();
  if (!plugin) return () => {};

  const handles: Promise<PluginListenerHandle>[] = [];

  if (handlers.onReceived) {
    handles.push(
      plugin.addListener("pushNotificationReceived", (n) => {
        handlers.onReceived?.({
          title: n.title ?? "Sweet 'n Lovely",
          body: n.body ?? "",
          url: deepLinkOf(n),
          data: (n.data ?? {}) as Record<string, unknown>,
        });
      }),
    );
  }

  if (handlers.onOpened) {
    handles.push(
      plugin.addListener("pushNotificationActionPerformed", ({ notification }) => {
        handlers.onOpened?.(deepLinkOf(notification), (notification.data ?? {}) as Record<string, unknown>);
      }),
    );
  }

  return () => {
    void Promise.all(handles.map((h) => h.then((x) => x.remove()).catch(() => {})));
  };
}

/** Clears the tray after the customer has caught up in-app. */
export async function clearNativeNotificationTray(): Promise<void> {
  const plugin = await loadPlugin();
  if (!plugin) return;
  try {
    await plugin.removeAllDeliveredNotifications();
  } catch {
    /* best-effort */
  }
}
