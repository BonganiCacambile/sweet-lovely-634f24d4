#!/usr/bin/env node
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
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
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

const lcpBudget = Number(LCP_BUDGET_MS);
const ttiBudget = Number(TTI_BUDGET_MS);
const ttfbBudget = Number(TTFB_BUDGET_MS);
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

  const heroImgMatch = html.match(
    new RegExp(`<img[^>]+src=["']([^"']*${HERO_HASH}[^"']*)["']`, "i"),
  );
  if (!heroImgMatch) {
    failures.push("hero-img-not-in-ssr");
    log(`✗ hero <img src> containing ${HERO_HASH} not found in SSR HTML`);
  } else {
    log(`✓ hero <img> rendered server-side: ${heroImgMatch[1].slice(0, 80)}…`);
  }

  const dehydratedContent = html.includes("Your Pizza Party Starts Here!");
  if (!dehydratedContent) {
    failures.push("home-content-not-ssr");
    log(`✗ home page content missing from SSR HTML (loader may not be running)`);
  } else {
    log(`✓ home content rendered server-side (loader prefetch active)`);
  }

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

  let clientHomeContentCalls = 0;
  page.on("request", (req) => {
    if (req.url().includes("getHomeContent")) clientHomeContentCalls++;
  });

  try {
    log(`Navigating to ${APP_URL}/ on ${iphone.name || "iPhone 13"} viewport …`);
    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
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

    await page.screenshot({ path: join(ARTIFACTS, "home-perf-mobile.png") });

    if (failures.length) {
      throw new Error(`Home mobile perf regression: ${failures.join(", ")}`);
    }

    const shouldWrite =
      UPDATE_BASELINE === "1" ||
      !baseline ||
      metrics.lcp < (baseline.lcp ?? Infinity);
    if (shouldWrite) {
      const payload = {
        lcp: metrics.lcp,
        domInteractive: metrics.domInteractive,
        ttfb: metrics.ttfb,
        viewport: { width: metrics.viewportWidth, height: metrics.viewportHeight, dpr: metrics.devicePixelRatio },
        device: iphone.name || "iPhone 13",
        recordedAt: new Date().toISOString(),
        appUrl: APP_URL,
      };
      writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2));
      log(`baseline written to ${BASELINE_PATH}`);
    }

    log(`✅ PASS — mobile home route perf checks green.`);
  } catch (err) {
    await page.screenshot({ path: join(ARTIFACTS, "home-perf-mobile-fail.png") }).catch(() => {});
    console.error("[regression:home-perf-mobile] ❌ FAIL", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
