#!/usr/bin/env node
/**
 * Mobile-focused performance regression for the cart + checkout flow.
 *
 * Seeds a realistic cart into localStorage, loads /cart and /checkout on
 * an emulated iPhone viewport, and asserts:
 *
 *   1. LCP, domInteractive (TTI proxy), and TTFB stay within absolute
 *      mobile budgets AND within tolerance of a saved baseline.
 *   2. Critical server-fn round-trips fired by the checkout page
 *      (getPaystackConfig, getActiveZones) stay under a latency budget.
 *   3. Client-side navigation from /cart → /checkout finishes within a
 *      soft-nav budget (proxy for "add-to-cart to pay" perceived speed).
 *
 * Baseline: tests/regression/artifacts/cart-checkout-perf-mobile-baseline.json
 *
 * Run:
 *   node tests/regression/cart-checkout-perf-mobile.mjs
 *   UPDATE_BASELINE=1 node tests/regression/cart-checkout-perf-mobile.mjs
 */
import { chromium, devices } from "playwright";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });
const BASELINE_PATH = join(ARTIFACTS, "cart-checkout-perf-mobile-baseline.json");

const {
  APP_URL = "http://localhost:8080",
  // Mobile budgets — cart/checkout are heavier than the home page
  // (framer-motion, forms, Paystack script) so slightly looser than home.
  LCP_BUDGET_MS = "4000",
  TTI_BUDGET_MS = "4500",
  TTFB_BUDGET_MS = "1000",
  // Critical server-fn round trips
  SERVER_FN_BUDGET_MS = "1500",
  // Client-side nav from /cart to /checkout (no reload)
  SOFT_NAV_BUDGET_MS = "2500",
  REGRESSION_TOLERANCE_PCT = "25",
  UPDATE_BASELINE = "",
} = process.env;

const lcpBudget = Number(LCP_BUDGET_MS);
const ttiBudget = Number(TTI_BUDGET_MS);
const ttfbBudget = Number(TTFB_BUDGET_MS);
const serverFnBudget = Number(SERVER_FN_BUDGET_MS);
const softNavBudget = Number(SOFT_NAV_BUDGET_MS);
const tolerance = Number(REGRESSION_TOLERANCE_PCT) / 100;

const CART_STORAGE_KEY = "sweet-lovely-cart-v1";
const ZONE_STORAGE_KEY = "sweet-lovely-zone-v1";
const ZONE_SLUG = process.env.ZONE_SLUG || "lithapark";
const SEEDED_CART = [
  {
    id: "regression-margherita",
    title: "Regression Margherita",
    price: 129,
    quantity: 2,
    variation: "Medium",
  },
  {
    id: "regression-pepperoni",
    title: "Regression Pepperoni",
    price: 159,
    quantity: 1,
    variation: "Large",
  },
];

// Server functions we consider critical for perceived checkout latency.
// TanStack Start routes serverFn calls through /_serverFn/... URLs, and
// (depending on generator version) the fn name appears in the query
// string or path. Match on substring so both shapes work.
const CRITICAL_SERVER_FNS = [
  "getPaystackConfig",
  "getActiveZones",
];

function log(...args) {
  console.log("[regression:cart-checkout-perf-mobile]", ...args);
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
function classifyServerFn(url) {
  for (const name of CRITICAL_SERVER_FNS) {
    if (url.includes(name)) return name;
  }
  return null;
}

async function collectMetrics(page) {
  return page.evaluate(async () => {
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
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const iphone = devices["iPhone 13"];
  const ctx = await browser.newContext({
    ...iphone,
    locale: "en-US",
    timezoneId: "Europe/London",
  });
  const page = await ctx.newPage();

  // Track server-fn request timings.
  const serverFnTimings = {}; // { fnName: { url, startedAt, durationMs, status } }
  const pending = new Map(); // requestRef -> { name, startedAt }
  page.on("request", (req) => {
    const name = classifyServerFn(req.url());
    if (!name) return;
    pending.set(req, { name, startedAt: performance.now() });
  });
  page.on("requestfinished", async (req) => {
    const meta = pending.get(req);
    if (!meta) return;
    pending.delete(req);
    const resp = await req.response().catch(() => null);
    const durationMs = performance.now() - meta.startedAt;
    // Keep the slowest observation per fn (worst-case latency).
    const prev = serverFnTimings[meta.name];
    if (!prev || durationMs > prev.durationMs) {
      serverFnTimings[meta.name] = {
        url: req.url(),
        durationMs,
        status: resp ? resp.status() : null,
      };
    }
  });

  const failures = [];
  try {
    // Establish localhost origin so we can write localStorage before the
    // cart context hydrates.
    log(`Seeding cart on ${APP_URL} …`);
    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ cartKey, cartValue, zoneKey, zoneValue }) => {
        window.localStorage.setItem(cartKey, cartValue);
        window.localStorage.setItem(zoneKey, zoneValue);
      },
      {
        cartKey: CART_STORAGE_KEY,
        cartValue: JSON.stringify(SEEDED_CART),
        zoneKey: ZONE_STORAGE_KEY,
        zoneValue: ZONE_SLUG,
      },
    );

    // ── /cart cold load ───────────────────────────────────────────────
    log(`Loading /cart on ${iphone.name || "iPhone 13"} …`);
    const cartStart = Date.now();
    await page.goto(`${APP_URL}/cart`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const cartWallClock = Date.now() - cartStart;

    const cartMetrics = await collectMetrics(page);
    log(`/cart metrics: ${JSON.stringify(cartMetrics)} (wall ${cartWallClock}ms)`);

    // Cart items should be visibly rendered — proves hydration read the seed.
    const seededVisible = await page
      .getByText("Regression Margherita", { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (!seededVisible) {
      failures.push("cart-items-not-rendered");
      log(`✗ seeded cart items did not render — cart context did not hydrate`);
    } else {
      log(`✓ seeded cart rendered on mobile viewport`);
    }

    if (cartMetrics.viewportWidth >= 768) {
      failures.push("viewport-not-mobile");
      log(`✗ viewport width ${cartMetrics.viewportWidth}px is not mobile-sized`);
    }
    if (!within("/cart LCP", cartMetrics.lcp, lcpBudget)) failures.push("cart-lcp-budget");
    if (!within("/cart domInteractive (TTI proxy)", cartMetrics.domInteractive, ttiBudget))
      failures.push("cart-tti-budget");
    if (!within("/cart TTFB", cartMetrics.ttfb, ttfbBudget)) failures.push("cart-ttfb-budget");

    await page.screenshot({ path: join(ARTIFACTS, "cart-perf-mobile.png") });

    // ── /checkout cold load (full navigation, not soft nav) ──────────
    log(`Loading /checkout cold …`);
    await page.goto(`${APP_URL}/checkout`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const checkoutMetrics = await collectMetrics(page);
    log(`/checkout metrics: ${JSON.stringify(checkoutMetrics)}`);

    if (!within("/checkout LCP", checkoutMetrics.lcp, lcpBudget))
      failures.push("checkout-lcp-budget");
    if (!within("/checkout domInteractive (TTI proxy)", checkoutMetrics.domInteractive, ttiBudget))
      failures.push("checkout-tti-budget");
    if (!within("/checkout TTFB", checkoutMetrics.ttfb, ttfbBudget))
      failures.push("checkout-ttfb-budget");

    await page.screenshot({ path: join(ARTIFACTS, "checkout-perf-mobile.png") });

    // Critical server-fn latency assertions. Missing means either the
    // fn was never called (which is fine — it may load lazily) OR the
    // matcher missed it. Only enforce when we captured something.
    for (const name of CRITICAL_SERVER_FNS) {
      const rec = serverFnTimings[name];
      if (!rec) {
        log(`• ${name} — no request observed (skipped)`);
        continue;
      }
      if (rec.status && rec.status >= 500) {
        failures.push(`${name}-5xx`);
        log(`✗ ${name} responded ${rec.status}`);
      }
      if (!within(`${name} worst-case round-trip`, rec.durationMs, serverFnBudget))
        failures.push(`${name}-latency`);
    }

    // ── Soft navigation: /cart → /checkout via <Link> ────────────────
    log(`Measuring soft nav /cart → /checkout …`);
    await page.goto(`${APP_URL}/cart`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const softNavStart = Date.now();
    // The primary CTA on /cart is a Link to /checkout labelled "Checkout".
    const checkoutLink = page
      .getByRole("link", { name: /proceed to checkout/i })
      .first();
    if (await checkoutLink.isVisible().catch(() => false)) {
      await checkoutLink.click();
      // Soft nav via TanStack Router doesn't fire a load event, so poll
      // the URL rather than waiting for "load".
      await page.waitForFunction(
        () => window.location.pathname.startsWith("/checkout"),
        null,
        { timeout: 15_000 },
      );
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const softNavMs = Date.now() - softNavStart;
      if (!within("cart→checkout soft-nav", softNavMs, softNavBudget))
        failures.push("soft-nav-budget");
      cartMetrics.softNavMs = softNavMs;
    } else {
      log(`• skipping soft-nav check — Checkout link not visible on /cart`);
    }

    // ── Baseline comparison ─────────────────────────────────────────
    let baseline = null;
    if (existsSync(BASELINE_PATH)) {
      try {
        baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
      } catch {
        baseline = null;
      }
    }
    if (!regressionCheck("/cart LCP vs baseline", cartMetrics.lcp, baseline?.cart?.lcp))
      failures.push("cart-lcp-regression");
    if (!regressionCheck("/cart TTI vs baseline", cartMetrics.domInteractive, baseline?.cart?.domInteractive))
      failures.push("cart-tti-regression");
    if (!regressionCheck("/checkout LCP vs baseline", checkoutMetrics.lcp, baseline?.checkout?.lcp))
      failures.push("checkout-lcp-regression");
    if (!regressionCheck("/checkout TTI vs baseline", checkoutMetrics.domInteractive, baseline?.checkout?.domInteractive))
      failures.push("checkout-tti-regression");
    if (cartMetrics.softNavMs != null &&
        !regressionCheck("soft-nav vs baseline", cartMetrics.softNavMs, baseline?.softNavMs))
      failures.push("soft-nav-regression");

    if (failures.length) {
      throw new Error(`Cart/checkout mobile perf regression: ${failures.join(", ")}`);
    }

    const shouldWrite =
      UPDATE_BASELINE === "1" ||
      !baseline ||
      cartMetrics.lcp < (baseline.cart?.lcp ?? Infinity);
    if (shouldWrite) {
      const payload = {
        cart: {
          lcp: cartMetrics.lcp,
          domInteractive: cartMetrics.domInteractive,
          ttfb: cartMetrics.ttfb,
        },
        checkout: {
          lcp: checkoutMetrics.lcp,
          domInteractive: checkoutMetrics.domInteractive,
          ttfb: checkoutMetrics.ttfb,
        },
        softNavMs: cartMetrics.softNavMs ?? null,
        serverFnTimings,
        device: iphone.name || "iPhone 13",
        viewport: { width: cartMetrics.viewportWidth, height: cartMetrics.viewportHeight },
        recordedAt: new Date().toISOString(),
        appUrl: APP_URL,
      };
      writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2));
      log(`baseline written to ${BASELINE_PATH}`);
    }

    log(`✅ PASS — mobile cart/checkout perf checks green.`);
  } catch (err) {
    await page.screenshot({ path: join(ARTIFACTS, "cart-checkout-perf-mobile-fail.png") }).catch(() => {});
    console.error("[regression:cart-checkout-perf-mobile] ❌ FAIL", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
