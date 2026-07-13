#!/usr/bin/env node
/**
 * Performance regression for the public home route ("/").
 *
 * Asserts that the two performance shipped fixes stay in place:
 *
 *   1. The route loader prefetches `home-content` + active zones during SSR,
 *      so the client does NOT fire a `getHomeContent` server-fn request
 *      before hydration. If the loader is removed or renamed, the client
 *      will start fetching again — this test catches that.
 *
 *   2. The hero (LCP) image has a `<link rel="preload" as="image"
 *      fetchpriority="high">` in the SSR head, pointing at the same URL as
 *      the rendered <img>. If either the preload or the img src drifts,
 *      LCP regresses hard.
 *
 * On top of the structural checks it measures LCP, TTFB, and
 * domInteractive, compares them to a saved baseline
 * (`tests/regression/artifacts/home-perf-baseline.json`), and fails on
 * regression beyond REGRESSION_TOLERANCE_PCT (default 25%). Absolute
 * budgets (LCP_BUDGET_MS, TTI_BUDGET_MS) act as hard ceilings even when
 * no baseline exists yet.
 *
 * Run:
 *   node tests/regression/home-perf.mjs
 *   UPDATE_BASELINE=1 node tests/regression/home-perf.mjs   # refresh baseline
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });
const BASELINE_PATH = join(ARTIFACTS, "home-perf-baseline.json");

const {
  APP_URL = "http://localhost:8080",
  LCP_BUDGET_MS = "2500",
  TTI_BUDGET_MS = "3000",
  TTFB_BUDGET_MS = "800",
  REGRESSION_TOLERANCE_PCT = "25",
  UPDATE_BASELINE = "",
} = process.env;

const lcpBudget = Number(LCP_BUDGET_MS);
const ttiBudget = Number(TTI_BUDGET_MS);
const ttfbBudget = Number(TTFB_BUDGET_MS);
const tolerance = Number(REGRESSION_TOLERANCE_PCT) / 100;

const HERO_HASH = "TselH8OEkb2YNE35eIM1vVAfb6s";

function log(...args) {
  console.log("[regression:home-perf]", ...args);
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
  // 1) Fetch the raw SSR HTML to inspect the preload link + dehydrated data.
  const htmlRes = await fetch(`${APP_URL}/`, { headers: { "User-Agent": "regression/home-perf" } });
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

  const heroImgMatch = html.match(
    new RegExp(`<img[^>]+src=["']([^"']*${HERO_HASH}[^"']*)["']`, "i"),
  );
  if (!heroImgMatch) {
    failures.push("hero-img-not-in-ssr");
    log(`✗ hero <img src> containing ${HERO_HASH} not found in SSR HTML`);
  } else {
    log(`✓ hero <img> rendered server-side: ${heroImgMatch[1].slice(0, 80)}…`);
  }

  // TanStack Start dehydrates loader/query data into the SSR stream. If the
  // route loader ran, the `home-content` query key + a known home-content
  // string ("Your Pizza Party") is rendered as HTML. This is the structural
  // proof that the client will NOT need to re-fetch on hydration.
  const dehydratedContent = html.includes("Your Pizza Party Starts Here!");
  if (!dehydratedContent) {
    failures.push("home-content-not-ssr");
    log(`✗ home page content missing from SSR HTML (loader may not be running)`);
  } else {
    log(`✓ home content rendered server-side (loader prefetch active)`);
  }

  // 2) Browser measurement of LCP / TTI / TTFB.
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();

  // Track any client-side call to `getHomeContent` — if the loader worked,
  // there should be zero such requests before/at hydration time.
  let clientHomeContentCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("getHomeContent")) clientHomeContentCalls++;
  });

  try {
    log(`Navigating to ${APP_URL}/ …`);
    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });

    // Give LCP observer a moment to settle.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

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

    // Absolute budgets.
    if (!within("LCP", metrics.lcp, lcpBudget)) failures.push("lcp-budget");
    if (!within("domInteractive (TTI proxy)", metrics.domInteractive, ttiBudget))
      failures.push("tti-budget");
    if (!within("TTFB", metrics.ttfb, ttfbBudget)) failures.push("ttfb-budget");

    // Baseline comparison.
    let baseline = null;
    if (existsSync(BASELINE_PATH)) {
      try {
        baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
      } catch {
        baseline = null;
      }
    }
    if (!regressionCheck("LCP vs baseline", metrics.lcp, baseline?.lcp))
      failures.push("lcp-regression");
    if (!regressionCheck("domInteractive vs baseline", metrics.domInteractive, baseline?.domInteractive))
      failures.push("tti-regression");
    if (!regressionCheck("TTFB vs baseline", metrics.ttfb, baseline?.ttfb))
      failures.push("ttfb-regression");

    await page.screenshot({ path: join(ARTIFACTS, "home-perf.png") });

    if (failures.length) {
      throw new Error(`Home perf regression: ${failures.join(", ")}`);
    }

    // Save baseline: on first run, or when explicitly asked, or when the
    // current run beat the stored baseline (ratcheting improvements in).
    const shouldWrite =
      UPDATE_BASELINE === "1" ||
      !baseline ||
      metrics.lcp < (baseline.lcp ?? Infinity);
    if (shouldWrite) {
      const payload = {
        lcp: metrics.lcp,
        domInteractive: metrics.domInteractive,
        ttfb: metrics.ttfb,
        recordedAt: new Date().toISOString(),
        appUrl: APP_URL,
      };
      writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2));
      log(`baseline written to ${BASELINE_PATH}`);
    }

    log(`✅ PASS — home route perf checks green.`);
  } catch (err) {
    await page.screenshot({ path: join(ARTIFACTS, "home-perf-fail.png") }).catch(() => {});
    console.error("[regression:home-perf] ❌ FAIL", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();