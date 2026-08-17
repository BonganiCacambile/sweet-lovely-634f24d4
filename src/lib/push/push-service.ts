import {
  clearWebLocalToken,
  describeDevice,
  detectPlatform,
  getCapacitor,
  getOrCreateWebLocalToken,
  isNativeRuntime,
  type PushPlatform,
} from "./platform";
import {
  ackLocalDelivery,
  deactivatePushDevice,
  registerPushDevice,
  touchPushDevice,
} from "./push.functions";

/**
 *  Sweet 'n Lovely React
 *          |
 *          v
 *   Notification Service (this file)
 *          |
 *          +---- Web notifications        (Notification API, available today)
 *          +---- Capacitor Android push   (FCM, wired when @capacitor/push-notifications is installed)
 *          +---- Capacitor iOS push       (APNs, same plugin)
 *
 * Nothing here assumes a browser-only world: `detectPlatform()` and
 * `isNativeRuntime()` decide at runtime which channel provides the token, and
 * the rest of the app (registration, preferences, delivery log, deep links)
 * is channel-agnostic.
 */

export type PermissionState = "unsupported" | "default" | "granted" | "denied";

const DECLINED_KEY = "snl.push.declined";

export function webPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionState;
}

export function hasDeclined(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DECLINED_KEY) === "1" || webPermission() === "denied";
}

export function rememberDeclined(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DECLINED_KEY, "1");
}

export function clearDeclined(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DECLINED_KEY);
}

export function currentToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("snl.push.active-token") ?? "";
}

function setCurrentToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("snl.push.active-token", token);
}

/**
 * Native token acquisition. Returns null when Capacitor (or the push plugin)
 * is not installed — we never fabricate a native token.
 */
async function acquireNativeToken(): Promise<{ token: string; provider: string } | null> {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable("PushNotifications")) return null;
  try {
    // Resolved at runtime only: the package is intentionally not a dependency
    // yet, so it must not be statically analysable by TS/Vite.
    const spec = "@capacitor/push-notifications";
    const mod = (await import(/* @vite-ignore */ spec)) as {
      PushNotifications: {
        requestPermissions: () => Promise<{ receive: string }>;
        register: () => Promise<void>;
        addListener: (
          event: string,
          cb: (payload: { value?: string }) => void,
        ) => Promise<{ remove: () => Promise<void> }>;
      };
    };
    const PN = mod.PushNotifications;
    const perm = await PN.requestPermissions();
    if (perm.receive !== "granted") return null;

    const token = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 15000);
      void PN.addListener("registration", (payload) => {
        clearTimeout(timer);
        resolve(payload.value ?? null);
      });
      void PN.register();
    });
    if (!token) return null;
    return { token, provider: detectPlatform() === "ios" ? "apns" : "fcm" };
  } catch {
    // Plugin not installed / native layer not configured yet.
    return null;
  }
}

export type EnableResult =
  | { ok: true; platform: PushPlatform; provider: string }
  | { ok: false; reason: "unsupported" | "denied" | "error"; message?: string };

/**
 * Ask for permission (only ever from an explicit user action) and register
 * this device against the signed-in Supabase user.
 */
export async function enablePushOnThisDevice(): Promise<EnableResult> {
  try {
    const native = await acquireNativeToken();

    if (!native) {
      if (isNativeRuntime()) {
        // Running natively but the push plugin isn't set up yet.
        return { ok: false, reason: "unsupported", message: "Native push is not configured yet" };
      }
      if (webPermission() === "unsupported") return { ok: false, reason: "unsupported" };
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        rememberDeclined();
        return { ok: false, reason: "denied" };
      }
    }

    const token = native?.token ?? getOrCreateWebLocalToken();
    const provider = native?.provider ?? "web-local";
    setCurrentToken(token);
    clearDeclined();

    await registerPushDevice({
      data: {
        token,
        platform: detectPlatform(),
        provider,
        device_name: describeDevice(),
        app_version: null,
      },
    });
    return { ok: true, platform: detectPlatform(), provider };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}

/** Stops delivery to this device without touching the user's other devices. */
export async function disablePushOnThisDevice(): Promise<void> {
  const token = currentToken();
  if (!token) return;
  try {
    await deactivatePushDevice({ data: { token } });
  } catch {
    /* best-effort */
  }
}

/**
 * Called on sign-out. The device binding is deactivated server-side and the
 * local token is discarded so the next account on this device gets a fresh
 * one and can never inherit the previous user's notifications.
 */
export async function releaseDeviceOnSignOut(): Promise<void> {
  await disablePushOnThisDevice();
  clearWebLocalToken();
  if (typeof window !== "undefined") window.localStorage.removeItem("snl.push.active-token");
}

export async function touchDevice(): Promise<void> {
  const token = currentToken();
  if (!token) return;
  try {
    await touchPushDevice({ data: { token } });
  } catch {
    /* best-effort */
  }
}

export function isEnabledOnThisDevice(): boolean {
  return Boolean(currentToken()) && (isNativeRuntime() || webPermission() === "granted");
}

/**
 * Web channel delivery: while the tab is alive but not focused, render a real
 * system notification so the customer sees the update outside the page.
 * Native platforms are handled by the OS, so this is a no-op there.
 */
export async function deliverLocally(n: {
  id: string;
  title: string;
  body: string | null;
  data?: Record<string, unknown> | null;
}): Promise<void> {
  if (isNativeRuntime()) return;
  const token = currentToken();
  if (!token || webPermission() !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;

  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  try {
    const url = typeof n.data?.["url"] === "string" ? (n.data["url"] as string) : "/account/notifications";
    const notif = new Notification("🍕 Sweet 'n Lovely", {
      body: n.body ? `${n.title} — ${n.body}` : n.title,
      tag: n.id,
      icon: "/favicon.ico",
      data: { url },
    });
    notif.onclick = () => {
      try {
        window.focus();
        window.location.assign(url);
      } finally {
        notif.close();
      }
    };
  } catch (e) {
    status = "failed";
    error = (e as Error).message.slice(0, 300);
  }

  try {
    await ackLocalDelivery({ data: { notificationId: n.id, token, status, error } });
  } catch {
    /* delivery logging must never break the UI */
  }
}