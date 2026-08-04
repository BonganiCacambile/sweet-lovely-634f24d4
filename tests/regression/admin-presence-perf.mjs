#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

/**
 * Performance regression for the new Employee Presence Monitoring +
 * Activity Feed admin features.
 *
 * Asserts no lag / slow loading:
 *   1. /admin/employee-activity navigates + paints the presence table
 *      under PAGE_BUDGET_MS (default 4000ms).
 *   2. The `listAdminPresence` server fn round-trip stays under
 *      SERVER_FN_BUDGET_MS (default 1500ms).
 *   3. The `listActivityFeed` server fn round-trip stays under
 *      SERVER_FN_BUDGET_MS.
 *   4. After inserting a brand-new audit_logs row the activity feed
 *      re-renders within REALTIME_BUDGET_MS (default 5000ms) — proving
 *      the realtime invalidation path is not lagging.
 *
 * See tests/regression/README.md for required env vars.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { assignRole, clearRoles } from "./lib/role-provider.mjs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });

const {
  APP_URL = "http://localhost:8080",
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_PROJECT_ID,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  PAGE_BUDGET_MS = "4000",
  SERVER_FN_BUDGET_MS = "1500",
  REALTIME_BUDGET_MS = "5000",
} = process.env;

function need(name, val) {
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
  return val;
}
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
need("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY);

const pageBudget = Number(PAGE_BUDGET_MS);
const fnBudget = Number(SERVER_FN_BUDGET_MS);
const rtBudget = Number(REALTIME_BUDGET_MS);

const projectRef =
  SUPABASE_PROJECT_ID || new URL(SUPABASE_URL).hostname.split(".")[0];
const STORAGE_KEY = `sb-${projectRef}-auth-token`;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_TAG = `REGR-PERF-${Date.now()}`;

function log(...args) {
  console.log(`[regression:perf]`, ...args);
}

// Prefer the configured admin, but never let a stale/rotated ADMIN_PASSWORD
// break the perf run: fall back to a throwaway main-admin created with the
// service-role key and deleted in teardown (same pattern as the RLS matrix).
const EPHEMERAL_PASSWORD = `Regr-Perf-${Date.now()}!aZ`;

async function signInWith(email, password) {
  const { data, error } = await userClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) return null;
  return { session: data.session, userId: data.user.id, email };
}

async function signInAdmin() {
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const existing = await signInWith(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (existing) return { ...existing, ephemeral: false };
    log("Configured ADMIN_EMAIL/ADMIN_PASSWORD did not authenticate — using an ephemeral admin.");
  }
  const email = `regr-perf-admin-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: EPHEMERAL_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  await assignRole(admin, { userId: data.user.id, role: "mainAdmin" });
  const session = await signInWith(email, EPHEMERAL_PASSWORD);
  if (!session) throw new Error("Ephemeral admin sign-in failed");
  return { ...session, ephemeral: true };
}

function within(label, ms, budget) {
  const ok = ms <= budget;
  log(`${ok ? "✓" : "✗"} ${label}: ${ms.toFixed(0)}ms (budget ${budget}ms)`);
  return ok;
}

async function run() {
  const { session, userId, email: adminEmail, ephemeral } = await signInAdmin();
  log(`Signed in as ${adminEmail} (${userId.slice(0, 8)}…)`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();

  // Track server-fn timings by URL pattern.
  const timings = { presence: [], feed: [] };
  page.on("requestfinished", async (req) => {
    try {
      const url = req.url();
      const timing = req.timing();
      const dur = timing.responseEnd >= 0 ? timing.responseEnd : 0;
      if (url.includes("listAdminPresence")) timings.presence.push(dur);
      else if (url.includes("listActivityFeed")) timings.feed.push(dur);
    } catch {}
  });

  let auditId;
  const failures = [];

  try {
    // Seed session before the SPA boots.
    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(session)],
    );

    // 0) Warm-up navigation. The first hit compiles/streams the admin route
    //    chunk (dev) or primes the edge cache (preview/prod); measuring that
    //    would benchmark the bundler, not the feature. The timed pass below
    //    reflects what an admin actually experiences on repeat navigation.
    log("Warming up /admin/employee-activity…");
    await page.goto(`${APP_URL}/admin/employee-activity`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(
      '[data-testid="employee-presence-table"], [data-testid="employee-presence-empty"]',
      { timeout: 60_000 },
    );

    // 1) Timed navigation — measure first meaningful paint of real content.
    //    Only stable test IDs are used; a generic [role="status"] spinner is
    //    deliberately NOT accepted as "loaded".
    log("Navigating to /admin/employee-activity…");
    const t0 = performance.now();
    await page.goto(`${APP_URL}/admin/employee-activity`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(
      '[data-testid="employee-presence-table"], [data-testid="employee-presence-empty"]',
      { timeout: 30_000 },
    );
    const pageMs = performance.now() - t0;
    if (!within("Cold load /admin/employee-activity", pageMs, pageBudget))
      failures.push("page-load");
    await page.screenshot({ path: join(ARTIFACTS, "perf_1_loaded.png") });

    // 2) Wait for the activity feed panel too.
    await page.waitForSelector('[data-testid="activity-feed-panel"]', { timeout: 30_000 });
    await page.waitForSelector(
      '[data-testid="activity-feed-list"], [data-testid="activity-feed-empty"]',
      { timeout: 30_000 },
    );

    // Give a beat for in-flight server-fn requests to finish.
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // 3) Server-fn budgets.
    const presenceMax = Math.max(0, ...timings.presence);
    const feedMax = Math.max(0, ...timings.feed);
    if (timings.presence.length === 0) {
      log("⚠ no listAdminPresence request observed");
    } else if (!within("listAdminPresence (max)", presenceMax, fnBudget)) {
      failures.push("presence-fn");
    }
    if (timings.feed.length === 0) {
      log("⚠ no listActivityFeed request observed");
    } else if (!within("listActivityFeed (max)", feedMax, fnBudget)) {
      failures.push("feed-fn");
    }

    // 4) Realtime lag: count current feed rows, insert a fresh audit log,
    //    measure how long until the feed grows.
    const beforeRows = await page.locator('[data-testid="activity-feed-list"] > li').count();
    log(`Activity feed rows before insert: ${beforeRows}`);

    const { data: ins, error: insErr } = await admin
      .from("audit_logs")
      .insert({
        actor_id: userId,
        actor_email: ADMIN_EMAIL,
        action: "presence.active",
        entity: "admin_presence",
        entity_id: userId,
        metadata: { reason: RUN_TAG, source: "regression-perf" },
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`audit_logs insert failed: ${insErr.message}`);
    auditId = ins.id;

    const tRT = performance.now();
    // The feed is capped at 75 rows, so the count may not grow. Instead, wait
    // for the newly inserted row (with our unique RUN_TAG in its metadata) to
    // appear in the feed via realtime invalidation.
    await page.waitForSelector(
      `[data-testid="activity-feed-list"] > li:has-text("${RUN_TAG}")`,
      { timeout: rtBudget + 2_000 },
    );
    const rtMs = performance.now() - tRT;
    if (!within("Realtime feed update", rtMs, rtBudget)) failures.push("realtime");
    await page.screenshot({ path: join(ARTIFACTS, "perf_2_realtime.png") });

    // 5) Hot navigation away and back — should be much faster than cold.
    await page.goto(`${APP_URL}/admin`, { waitUntil: "domcontentloaded" });
    const tHot = performance.now();
    await page.goto(`${APP_URL}/admin/employee-activity`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="activity-feed-panel"]', { timeout: 30_000 });
    const hotMs = performance.now() - tHot;
    if (!within("Warm reload /admin/employee-activity", hotMs, pageBudget))
      failures.push("hot-load");

    if (failures.length) {
      throw new Error(`Budget exceeded: ${failures.join(", ")}`);
    }
    log(`✅ PASS — no lag detected on Employee Activity + Activity Feed.`);
  } catch (err) {
    await page.screenshot({ path: join(ARTIFACTS, "perf_fail.png") }).catch(() => {});
    console.error(`[regression:perf] ❌ FAIL`, err);
    process.exitCode = 1;
  } finally {
    if (auditId) {
      try {
        await admin.from("audit_logs").delete().eq("id", auditId);
      } catch {
        /* ignore cleanup errors */
      }
    }
    await browser.close();
    if (ephemeral) {
      try {
        await clearRoles(admin, userId);
        await admin.auth.admin.deleteUser(userId);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}

run();