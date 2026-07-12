#!/usr/bin/env node
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
need("ADMIN_EMAIL", ADMIN_EMAIL);
need("ADMIN_PASSWORD", ADMIN_PASSWORD);

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

async function signInAdmin() {
  const { data, error } = await userClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error || !data.session || !data.user) {
    throw new Error(`Admin sign-in failed: ${error?.message ?? "no session"}`);
  }
  return { session: data.session, userId: data.user.id };
}

function within(label, ms, budget) {
  const ok = ms <= budget;
  log(`${ok ? "✓" : "✗"} ${label}: ${ms.toFixed(0)}ms (budget ${budget}ms)`);
  return ok;
}

async function run() {
  const { session, userId } = await signInAdmin();
  log(`Signed in as ${ADMIN_EMAIL} (${userId.slice(0, 8)}…)`);

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

    // 1) Cold navigation to the new page — measure first meaningful paint.
    log("Navigating to /admin/employee-activity…");
    const t0 = performance.now();
    await page.goto(`${APP_URL}/admin/employee-activity`, {
      waitUntil: "domcontentloaded",
    });
    // Wait for the presence table OR an empty state to render — both signal
    // the page is interactive.
    await page.waitForSelector(
      'table thead th:has-text("Employee"), [role="status"], h3:has-text("No admin users")',
      { timeout: 15_000 },
    );
    const pageMs = performance.now() - t0;
    if (!within("Cold load /admin/employee-activity", pageMs, pageBudget))
      failures.push("page-load");
    await page.screenshot({ path: join(ARTIFACTS, "perf_1_loaded.png") });

    // 2) Wait for the activity feed panel too.
    await page.waitForSelector('p:has-text("Activity Feed")', { timeout: 10_000 });

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
    const beforeRows = await page.locator("ol > li").count();
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
      `ol > li:has-text("${RUN_TAG}")`,
      { timeout: rtBudget + 2_000 },
    );
    const rtMs = performance.now() - tRT;
    if (!within("Realtime feed update", rtMs, rtBudget)) failures.push("realtime");
    await page.screenshot({ path: join(ARTIFACTS, "perf_2_realtime.png") });

    // 5) Hot navigation away and back — should be much faster than cold.
    await page.goto(`${APP_URL}/admin`, { waitUntil: "domcontentloaded" });
    const tHot = performance.now();
    await page.goto(`${APP_URL}/admin/employee-activity`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('p:has-text("Activity Feed")', { timeout: 10_000 });
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
  }
}

run();