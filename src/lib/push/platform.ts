/**
 * Client-safe platform detection for the notification abstraction.
 *
 * The app currently runs as a web app but is intended to be packaged with
 * Capacitor for Android/iOS later. Everything here is feature-detected at
 * runtime, so no native code is required today and no rewrite is required
 * when Capacitor is installed.
 */
export type PushPlatform = "web" | "android" | "ios";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
};

export function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap ?? null;
}

export function isNativeRuntime(): boolean {
  const cap = getCapacitor();
  return Boolean(cap?.isNativePlatform?.());
}

export function detectPlatform(): PushPlatform {
  const cap = getCapacitor();
  if (cap?.isNativePlatform?.()) {
    const p = String(cap.getPlatform?.() ?? "").toLowerCase();
    if (p === "android") return "android";
    if (p === "ios") return "ios";
  }
  return "web";
}

/** Human-friendly device label; never includes anything identifying beyond the UA family. */
export function describeDevice(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Mac OS X/i.test(ua)
        ? "macOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : "Web";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  return `${os} · ${browser}`;
}

const LOCAL_TOKEN_KEY = "snl.push.device-token";

/**
 * Stable per-browser identifier used as the "token" for the web-local
 * channel (system notifications rendered by the running tab). This is NOT a
 * push-provider token; when a real provider (FCM/APNs via Capacitor, or Web
 * Push with VAPID) is configured, its token replaces this value.
 */
export function getOrCreateWebLocalToken(): string {
  if (typeof window === "undefined") return "";
  let t = window.localStorage.getItem(LOCAL_TOKEN_KEY);
  if (!t) {
    t = `web-local:${crypto.randomUUID()}`;
    window.localStorage.setItem(LOCAL_TOKEN_KEY, t);
  }
  return t;
}

export function clearWebLocalToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_TOKEN_KEY);
}