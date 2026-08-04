#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

/**
 * Mobile viewport variant of the home route performance regression.
 *
 * Same structural + metric checks as `home-perf.mjs`, but runs Playwright
 * with a mobile viewport, device scale factor, and touch enabled — the
 * form factor where LCP and TTI matter most and where the hero image
 * preload has the biggest impact.
 *
 * Baseline is stored separately from the desktop variant at
 * `tests/regression/artifacts/home-perf-mobile-baseline.json`.
 *
 * Run:
 *   node tests/regression/home-perf-mobile.mjs
 *   UPDATE_BASELINE=1 node tests/regression/home-perf-mobile.mjs
 */
import { chromium, devices } from "playwright";
import {
  budgetFor,
  DEV_BUDGET_MULTIPLIER,
  detectServerMode,
  perfMode,
  readBaseline,
  seedAuthenticatedSession,
  writeBaseline,
} from "./lib/perf-session.mjs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });
const BASELINE_PATH = join(ARTIFACTS, "home-perf-mobile-baseline.json");

const {
  APP_URL = "http://localhost:8080",
  // Mobile budgets are looser than desktop — mobile CPU/network is slower.
  LCP_BUDGET_MS = "3500",
  TTI_BUDGET_MS = "4000",
  TTFB_BUDGET_MS = "1000",
  REGRESSION_TOLERANCE_PCT = "25",
  UPDATE_BASELINE = "",
} = process.env;

let lcpBudget = Number(LCP_BUDGET_MS);
let ttiBudget = Number(TTI_BUDGET_MS);
let ttfbBudget = Number(TTFB_BUDGET_MS);
const tolerance = Number(REGRESSION_TOLERANCE_PCT) / 100;

const HERO_HASH = "TselH8OEkb2YNE35eIM1vVAfb6s";

function log(...args) {
  console.log("[regression:home-perf-mobile]", ...args);
}

function within(label, ms, budget) {
  const ok = ms <= budget;
  log(`${ok ? "✓" : "✗"} ${label}: ${ms.toFixed(0)}ms (budget ${budget}ms)`);
  return ok;
}

function regressionCheck(label, current, baseline) {
  if (baseline == null) {
    log(`• ${label}: ${current.toFixed(0)}ms (no baseline yet)`);
    return true;
  }
  const ceiling = baseline * (1 + tolerance);
  const ok = current <= ceiling;
  log(
    `${ok ? "✓" : "✗"} ${label}: ${current.toFixed(0)}ms vs baseline ${baseline.toFixed(0)}ms ` +
      `(ceiling ${ceiling.toFixed(0)}ms, +${(tolerance * 100).toFixed(0)}%)`,
  );
  return ok;
}

async function run() {
  // 1) SSR HTML structural checks — device-independent, but re-run here so
  //    the mobile suite is self-contained and can be executed on its own.
  const htmlRes = await fetch(`${APP_URL}/`, {
    headers: { "User-Agent": "regression/home-perf-mobile" },
  });
  const html = await htmlRes.text();

  const failures = [];

  const hasPreload =
    /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]*>/i.test(html) &&
    html.includes(HERO_HASH);
  if (!hasPreload) {
    failures.push("hero-preload-missing");
    log(`✗ hero <link rel="preload" as="image"> for ${HERO_HASH} not found in SSR HTML`);
  } else {
    log(`✓ hero preload link present in SSR HTML`);
  }

  // The storefront sits behind the global auth gate, so SSR always renders a
  // loading shell — real content is asserted after hydration with a session.
  const serverMode = await detectServerMode(APP_URL);
  const mode = perfMode(serverMode);
  log(`measuring mode: ${mode}`);
  lcpBudget = budgetFor(lcpBudget, serverMode);
  ttiBudget = budgetFor(ttiBudget, serverMode);
  ttfbBudget = budgetFor(ttfbBudget, serverMode);
  if (serverMode === "dev") log(`• dev server detected — budgets scaled x${DEV_BUDGET_MULTIPLIER}`);

  // 2) Browser measurement on a mobile emulation profile.
  const browser = await chromium.launch({ headless: true });
  // Use Playwright's built-in iPhone descriptor as the base, so viewport,
  // deviceScaleFactor, touch, and mobile user agent all line up with a
  // real handset.
  const iphone = devices["iPhone 13"];
  const ctx = await browser.newContext({
    ...iphone,
    // Keep locale/timezone predictable so hydration diffing is stable.
    locale: "en-US",
    timezoneId: "Europe/London",
  });
  const page = await ctx.newPage();
  let session = null;

  let clientHomeContentCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("getHomeContent")) clientHomeContentCalls++;
  });

  try {
    session = await seedAuthenticatedSession(page, APP_URL);
    log(`signed in as ${session.email}`);
    log(`Navigating to ${APP_URL}/ on ${iphone.name || "iPhone 13"} viewport …`);
    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const heroImg = await page
      .locator(`img[src*="${HERO_HASH}"]`)
      .first()
      .isVisible()
      .catch(() => false);
    if (!heroImg) {
      failures.push("hero-img-not-rendered");
      log(`✗ hero <img> containing ${HERO_HASH} not visible after hydration`);
    } else {
      log(`✓ hero <img> rendered for the signed-in customer`);
    }

    const metrics = await page.evaluate(async () => {
      const nav = performance.getEntriesByType("navigation")[0];
      const lcpEntry = await new Promise((resolve) => {
        const entries = performance.getEntriesByType("largest-contentful-paint");
        if (entries.length) return resolve(entries[entries.length - 1]);
        let last = null;
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) last = e;
        });
        try {
          obs.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          return resolve(null);
        }
        setTimeout(() => {
          obs.disconnect();
          resolve(last);
        }, 500);
      });
      return {
        ttfb: nav ? nav.responseStart : 0,
        domInteractive: nav ? nav.domInteractive : 0,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
        lcp: lcpEntry ? lcpEntry.renderTime || lcpEntry.startTime : 0,
        lcpElement: lcpEntry && lcpEntry.element ? lcpEntry.element.tagName : null,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      };
    });

    log(`metrics: ${JSON.stringify(metrics)}`);
    log(`client-side getHomeContent calls before/at load: ${clientHomeContentCalls}`);

    if (clientHomeContentCalls > 0) {
      failures.push("client-refetched-home-content");
      log(`✗ client fired ${clientHomeContentCalls} getHomeContent call(s) — loader prefetch broken`);
    } else {
      log(`✓ no client-side getHomeContent fetch (SSR prefetch honored)`);
    }

    // Sanity: confirm we actually rendered at a mobile viewport, so future
    // regressions where someone hardcodes a desktop layout are caught.
    if (metrics.viewportWidth >= 768) {
      failures.push("viewport-not-mobile");
      log(`✗ viewport width ${metrics.viewportWidth}px is not mobile-sized`);
    } else {
      log(`✓ mobile viewport confirmed (${metrics.viewportWidth}x${metrics.viewportHeight} @${metrics.devicePixelRatio}x)`);
    }

    if (!within("LCP", metrics.lcp, lcpBudget)) failures.push("lcp-budget");
    if (!within("domInteractive (TTI proxy)", metrics.domInteractive, ttiBudget))
      failures.push("tti-budget");
    if (!within("TTFB", metrics.ttfb, ttfbBudget)) failures.push("ttfb-budget");

    const baseline = readBaseline(BASELINE_PATH, mode);
    if (!baseline) log(`• no comparable baseline for mode "${mode}" — recording a fresh one`);
    if (!regressionCheck("LCP vs baseline", metrics.lcp, baseline?.lcp))
      failures.push("lcp-regression");
    if (!regressionCheck("domInteractive vs baseline", metrics.domInteractive, baseline?.domInteractive))
      failures.push("tti-regression");
    if (!regressionCheck("TTFB vs baseline", metrics.ttfb, baseline?.ttfb))
      failures.push("ttfb-regression");

    await page.screenshot({ path: join(ARTIFACTS, "home-perf-mobile.png") });

    if (failures.length) {
      throw new Error(`Home mobile perf regression: ${failures.join(", ")}`);
    }

    const shouldWrite =
      UPDATE_BASELINE === "1" ||
      !baseline ||
      metrics.lcp < (baseline.lcp ?? Infinity);
    if (shouldWrite) {
      writeBaseline(
        BASELINE_PATH,
        {
          lcp: metrics.lcp,
          domInteractive: metrics.domInteractive,
          ttfb: metrics.ttfb,
          viewport: { width: metrics.viewportWidth, height: metrics.viewportHeight, dpr: metrics.devicePixelRatio },
          device: iphone.name || "iPhone 13",
          appUrl: APP_URL,
        },
        mode,
      );
      log(`baseline written to ${BASELINE_PATH}`);
    }

    log(`✅ PASS — mobile home route perf checks green.`);
  } catch (err) {
    await page.screenshot({ path: join(ARTIFACTS, "home-perf-mobile-fail.png") }).catch(() => {});
    console.error("[regression:home-perf-mobile] ❌ FAIL", err);
    process.exitCode = 1;
  } finally {
    if (session) await session.cleanup().catch(() => {});
    await browser.close();
  }
}

run();
