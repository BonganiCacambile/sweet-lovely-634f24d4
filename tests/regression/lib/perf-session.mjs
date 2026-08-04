/**
 * Shared helpers for the performance regression suites.
 *
 * Two things changed since the original perf baselines were recorded:
 *
 *  1. The storefront sits behind a global auth gate (AuthGate in
 *     src/routes/__root.tsx). Anonymous visitors are served a loading
 *     screen and redirected to /auth, so measuring "/" anonymously no
 *     longer measures the real customer experience. Perf runs must boot
 *     with a real Supabase session, exactly like a signed-in customer.
 *
 *  2. Baselines recorded against a cold Vite dev server are not
 *     comparable to a production build. Baselines are therefore tagged
 *     with a mode (`authenticated:dev` / `authenticated:prod`) and only
 *     compared when the mode matches the current run.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createEphemeralCustomerSession } from "./browser-session.mjs";

/** Detect whether APP_URL is served by the Vite dev server or a build. */
export async function detectServerMode(appUrl) {
  try {
    const res = await fetch(`${appUrl}/@vite/client`, {
      headers: { "User-Agent": "regression/perf" },
    });
    if (res.ok) {
      const body = await res.text();
      if (body.includes("vite") || body.includes("hot")) return "dev";
    }
  } catch {
    /* ignore */
  }
  return "prod";
}

/**
 * Dev-server bundles are unminified and compiled on demand, so raw dev
 * numbers are not comparable to production. Budgets are scaled instead of
 * being silently skipped, so a dev run still catches gross regressions.
 */
export const DEV_BUDGET_MULTIPLIER = Number(process.env.DEV_BUDGET_MULTIPLIER || 2);

export function budgetFor(baseMs, serverMode) {
  return serverMode === "dev" ? Math.round(baseMs * DEV_BUDGET_MULTIPLIER) : baseMs;
}

export function perfMode(serverMode) {
  return `authenticated:${serverMode}`;
}

/**
 * Seed a signed-in customer session into the browser context so the
 * measured page renders real storefront content instead of the auth gate's
 * loading screen. Returns { cleanup } — always call it in `finally`.
 */
export async function seedAuthenticatedSession(page, appUrl) {
  const {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_PROJECT_ID,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Perf suites need SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY " +
        "to sign in — the storefront is behind the global auth gate.",
    );
  }

  const sess = await createEphemeralCustomerSession({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    projectId: SUPABASE_PROJECT_ID,
    emailPrefix: "regr-perf",
  });

  // Establish the localhost origin, then write the session there.
  await page.goto(`${appUrl}/auth`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, session]) => window.localStorage.setItem(key, JSON.stringify(session)),
    [sess.storageKey, sess.session],
  );

  return { cleanup: sess.cleanup, email: sess.email, userId: sess.userId };
}

/** Read a baseline only when it was recorded in the same mode. */
export function readBaseline(path, mode) {
  if (!existsSync(path)) return null;
  try {
    const b = JSON.parse(readFileSync(path, "utf8"));
    if (b.mode !== mode) return null;
    return b;
  } catch {
    return null;
  }
}

export function writeBaseline(path, payload, mode) {
  writeFileSync(path, JSON.stringify({ ...payload, mode, recordedAt: new Date().toISOString() }, null, 2));
}
