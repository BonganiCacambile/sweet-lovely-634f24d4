import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell for the Sweet 'n Lovely Android/iOS builds.
 *
 * `server.url` points at the hosted app so the native shell always runs the
 * latest deployment; remove it (and run `npx cap sync` after `bun run build`)
 * if you want a fully bundled offline build instead.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.sweetnlovely",
  appName: "Sweet 'n Lovely",
  webDir: "dist/client",
  server: {
    url: "https://sweet-n-lovely.lovable.app",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
