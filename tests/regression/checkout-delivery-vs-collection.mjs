#!/usr/bin/env node
/**
 * Checkout regression suite: Delivery vs Collection flows.
 *
 * Covers:
 *   - Delivery / collection summary totals update correctly
 *   - Toggling between delivery and collection updates the UI and summary
 *   - Customer and delivery-address form validation
 *   - Minimum-order warning
 *   - Zone-level collection-disabled enforcement
 *   - Payment processing / failure / retry messaging
 *   - End-to-end successful payment (Paystack test charge + order creation)
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { createEphemeralCustomerSession } from "./lib/browser-session.mjs";

loadEnvFiles();

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });

const {
  APP_URL = "http://localhost:8080",
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_PROJECT_ID,
  PAYSTACK_SECRET_KEY,
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
need("PAYSTACK_SECRET_KEY", PAYSTACK_SECRET_KEY);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CART_KEY = "sweet-lovely-cart-v1";
const ZONE_KEY = "sweet-lovely-zone-v1";

/**
 * The storefront sits behind a global auth gate (AuthGate in
 * src/routes/__root.tsx). Without a session the app redirects /checkout to
 * /auth mid-interaction, which is what previously surfaced as
 * "element was detached from the DOM" on #firstName. Every browser context
 * therefore boots with a real signed-in customer session.
 */
let CUSTOMER = null;

const PRODUCT_SLUG = "margarita-muse";
const PRODUCT_TITLE = "Margarita Muse";
const PRODUCT_PRICE = 80;

/**
 * Zone configuration is admin-editable production data (fee, ETA, minimum,
 * collection availability), so the suite resolves it from the live database at
 * startup instead of hardcoding values that drift whenever an admin edits a
 * zone. Assertions are derived from the same numbers the app reads.
 */
let ZONE_BOTH = null; // slug of a zone offering delivery + collection
let ZONE_DELIVERY_ONLY = null; // slug of a delivery-only zone
let ZONE_BOTH_CFG = null;

const TAX_RATE = 0.05;

function money(n) {
  return `R${Number(n).toFixed(2)}`;
}

async function resolveZones() {
  const { data, error } = await admin
    .from("delivery_zones")
    .select(
      "slug, name, fee_zar, min_order_zar, eta_minutes, collection_prep_minutes, delivery_enabled, collection_enabled, free_delivery_threshold_zar, is_active",
    )
    .eq("is_active", true);
  if (error) throw new Error(`Could not load delivery zones: ${error.message}`);

  const subtotal = PRODUCT_PRICE * 2;
  const both = data.find(
    (z) =>
      z.delivery_enabled &&
      z.collection_enabled &&
      Number(z.min_order_zar) <= subtotal &&
      Number(z.min_order_zar) > PRODUCT_PRICE && // so the 1-item cart is below minimum
      !(Number(z.free_delivery_threshold_zar ?? 0) > 0 && subtotal >= Number(z.free_delivery_threshold_zar)),
  );
  const deliveryOnly = data.find((z) => z.delivery_enabled && !z.collection_enabled);
  if (!both) throw new Error("No active zone offers both delivery and collection with a usable minimum.");
  if (!deliveryOnly) throw new Error("No active delivery-only zone found.");

  ZONE_BOTH = both.slug;
  ZONE_DELIVERY_ONLY = deliveryOnly.slug;
  ZONE_BOTH_CFG = {
    name: both.name,
    fee: Number(both.fee_zar),
    min: Number(both.min_order_zar),
    eta: Number(both.eta_minutes),
    prep: Number(both.collection_prep_minutes ?? 20),
  };
}

const CART_TWO = [cartItem(PRODUCT_SLUG, PRODUCT_TITLE, PRODUCT_PRICE, 2)];
const CART_ONE = [cartItem(PRODUCT_SLUG, PRODUCT_TITLE, PRODUCT_PRICE, 1)];

function cartItem(id, title, price, quantity) {
  return { id, title, price, quantity, image: "" };
}

function log(...args) {
  console.log("[checkout]", ...args);
}

async function seedCheckout(page, zoneSlug, items) {
  // Seed session + cart + zone on a blank origin first, then load checkout so
  // hydration reads the saved values instead of redirecting to /auth or /cart.
  await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([cartKey, zoneKey, cart, zone, authKey, authValue]) => {
      window.localStorage.setItem(authKey, authValue);
      window.localStorage.setItem(cartKey, JSON.stringify(cart));
      window.localStorage.setItem(zoneKey, zone);
    },
    [
      CART_KEY,
      ZONE_KEY,
      items,
      zoneSlug,
      CUSTOMER.storageKey,
      JSON.stringify(CUSTOMER.session),
    ],
  );
  await page.goto(`${APP_URL}/checkout`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1:has-text('Checkout')", { timeout: 15_000 });
  // The form only exists once auth + cart hydration have settled.
  await page.waitForSelector("#firstName", { state: "visible", timeout: 15_000 });
}

async function fillCustomerStep(page) {
  await page.fill("#firstName", "Regression");
  await page.fill("#lastName", "Bot");
  await page.fill("#email", "checkout-regression@example.com");
  await page.fill("#phone", "+27000000000");
}

async function fillDeliveryAddress(page) {
  await page.fill("#country", "South Africa");
  await page.fill("#state", "Western Cape");
  await page.fill("#city", "Cape Town");
  await page.fill("#postal", "1234");
  await page.fill("#address", "1 Main Road");
}

async function continueToNextStep(page) {
  await page.click('button:has-text("Continue")');
}

async function selectFulfillment(page, label) {
  // Click the first "Delivery"/"Collection" button (fulfillment card in the form panel).
  await page.locator(`button:has-text("${label}")`).first().click();
}

async function getSummaryRow(page, label) {
  if (label === "Total") {
    return await page.locator("aside span.text-xl.font-extrabold.tracking-tight").first().textContent();
  }
  return await page.locator(`div:has(> dt:has-text("${label}")) dd`).first().textContent();
}

async function installPaystackMock(page, behavior) {
  // Block the real Paystack script and inject a mock that behaves as requested.
  await page.route("https://js.paystack.co/v1/inline.js", (route) => route.abort());
  await page.evaluate((b) => {
    window.PaystackPop = {
      setup: (opts) => {
        window.__paystackOpts = opts;
        return {
          openIframe: () => {
            if (b.type === "success") {
              // Small delay so the processing animation has a chance to render.
              setTimeout(() => opts.callback({ reference: b.reference }), 200);
            } else {
              setTimeout(() => opts.onClose(), 200);
            }
          },
        };
      },
    };
  }, behavior);
}

async function createPaystackCharge(amountKobo) {
  const res = await fetch("https://api.paystack.co/charge", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "checkout-regression@example.com",
      amount: String(amountKobo),
      card: {
        number: "4084084084084081",
        cvv: "408",
        expiry_month: "12",
        expiry_year: "30",
      },
    }),
  });
  const json = await res.json();
  if (!json.status || json.data?.status !== "success" || !json.data?.reference) {
    throw new Error(`Paystack test charge failed: ${JSON.stringify(json)}`);
  }
  return json.data.reference;
}

async function cleanupOrderByReference(reference) {
  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (!order) return;
  await admin.rpc("rollback_order_stock", { _order_id: order.id });
  await admin.from("order_items").delete().eq("order_id", order.id);
  await admin.from("orders").delete().eq("id", order.id);
}

async function waitForStep(page, heading) {
  await page.waitForSelector(`h2:has-text("${heading}")`, { timeout: 10_000 });
}

async function screenshot(page, name) {
  await page.screenshot({ path: join(ARTIFACTS, `checkout-${name}.png`) }).catch(() => {});
}

async function testDeliverySummary(page) {
  await seedCheckout(page, ZONE_BOTH, CART_TWO);
  await fillCustomerStep(page);
  await continueToNextStep(page);
  await waitForStep(page, "How would you like your order?");
  await fillDeliveryAddress(page);
  await continueToNextStep(page);
  await waitForStep(page, "Payment");

  const subtotal = PRODUCT_PRICE * 2;
  const tax = subtotal * TAX_RATE;
  assert.equal(await getSummaryRow(page, "Subtotal"), money(subtotal));
  assert.equal(await getSummaryRow(page, "Delivery"), money(ZONE_BOTH_CFG.fee));
  assert.equal(await getSummaryRow(page, "Tax"), money(tax));
  assert.equal(await getSummaryRow(page, "Total"), money(subtotal + ZONE_BOTH_CFG.fee + tax));
  assert.equal(await getSummaryRow(page, "Order type"), "Delivery");
  assert.equal(await getSummaryRow(page, "Estimated"), `~${ZONE_BOTH_CFG.eta} min`);
  await screenshot(page, "delivery-summary");
}

async function testCollectionSummary(page) {
  await seedCheckout(page, ZONE_BOTH, CART_TWO);
  await fillCustomerStep(page);
  await continueToNextStep(page);
  await waitForStep(page, "How would you like your order?");
  await selectFulfillment(page, "Collection");
  await continueToNextStep(page);
  await waitForStep(page, "Payment");

  const subtotal = PRODUCT_PRICE * 2;
  const tax = subtotal * TAX_RATE;
  assert.equal(await getSummaryRow(page, "Subtotal"), money(subtotal));
  assert.equal(await getSummaryRow(page, "Delivery"), "R0.00 (Collection)");
  assert.equal(await getSummaryRow(page, "Tax"), money(tax));
  assert.equal(await getSummaryRow(page, "Total"), money(subtotal + tax));
  assert.equal(await getSummaryRow(page, "Order type"), "Collection");
  assert.equal(await getSummaryRow(page, "Ready in"), `~${ZONE_BOTH_CFG.prep} min`);
  await screenshot(page, "collection-summary");
}

async function testDeliveryCollectionToggle(page) {
  await seedCheckout(page, ZONE_BOTH, CART_TWO);
  await fillCustomerStep(page);
  await continueToNextStep(page);
  await waitForStep(page, "How would you like your order?");

  const subtotal = PRODUCT_PRICE * 2;
  const tax = subtotal * TAX_RATE;
  const deliveryTotal = money(subtotal + ZONE_BOTH_CFG.fee + tax);
  const collectionTotal = money(subtotal + tax);

  // Delivery is default.
  assert.equal(await getSummaryRow(page, "Delivery"), money(ZONE_BOTH_CFG.fee));
  assert.equal(await getSummaryRow(page, "Total"), deliveryTotal);
  await page.waitForSelector("#address", { state: "visible", timeout: 5_000 });

  await selectFulfillment(page, "Collection");
  await page.waitForSelector('div:has-text("Collection details")', { timeout: 5_000 });
  assert.equal(await getSummaryRow(page, "Delivery"), "R0.00 (Collection)");
  assert.equal(await getSummaryRow(page, "Total"), collectionTotal);
  await page.waitForSelector("#address", { state: "hidden", timeout: 5_000 });

  await selectFulfillment(page, "Delivery");
  await page.waitForSelector("#address", { state: "visible", timeout: 5_000 });
  assert.equal(await getSummaryRow(page, "Delivery"), money(ZONE_BOTH_CFG.fee));
  assert.equal(await getSummaryRow(page, "Total"), deliveryTotal);

  await screenshot(page, "toggle");
}

async function testCustomerValidation(page) {
  await seedCheckout(page, ZONE_BOTH, CART_TWO);
  await continueToNextStep(page);
  await page.waitForTimeout(300);

  // All required fields should be invalid and show an error message.
  for (const id of ["firstName", "lastName", "email", "phone"]) {
    const aria = await page.locator(`#${id}`).getAttribute("aria-invalid");
    assert.equal(aria, "true", `${id} should be invalid`);
    assert.ok(
      await page.locator(`#${id}`).locator("xpath=..").locator('p:has-text("Required")').count(),
      `${id} should show Required error`,
    );
  }

  await fillCustomerStep(page);
  await continueToNextStep(page);
  await waitForStep(page, "How would you like your order?");
  await screenshot(page, "customer-validation");
}

async function testDeliveryAddressValidation(page) {
  await seedCheckout(page, ZONE_BOTH, CART_TWO);
  await fillCustomerStep(page);
  await continueToNextStep(page);
  await waitForStep(page, "How would you like your order?");
  await continueToNextStep(page);
  await page.waitForTimeout(300);

  for (const id of ["country", "state", "city", "postal", "address"]) {
    const aria = await page.locator(`#${id}`).getAttribute("aria-invalid");
    assert.equal(aria, "true", `${id} should be invalid`);
    assert.ok(
      await page.locator(`#${id}`).locator("xpath=..").locator('p:has-text("Required")').count(),
      `${id} should show Required error`,
    );
  }

  await fillDeliveryAddress(page);
  await continueToNextStep(page);
  await waitForStep(page, "Payment");
  await screenshot(page, "address-validation");
}

async function testMinimumOrderWarning(page) {
  await seedCheckout(page, ZONE_BOTH, CART_ONE);
  const shortfall = money(ZONE_BOTH_CFG.min - PRODUCT_PRICE);
  await page.waitForSelector(`p:has-text("Add ${shortfall} more")`, { timeout: 5_000 });
  await fillCustomerStep(page);
  await continueToNextStep(page);
  await waitForStep(page, "How would you like your order?");
  await selectFulfillment(page, "Collection");
  await continueToNextStep(page);
  await waitForStep(page, "Payment");

  await installPaystackMock(page, { type: "failure" });
  await page.click('[data-testid="checkout-pay"]');
  await page.waitForSelector('li[data-sonner-toast]:has-text("Order below")', { timeout: 10_000 });
  await screenshot(page, "minimum-order");
}

async function testCollectionDisabled(page) {
  await seedCheckout(page, ZONE_DELIVERY_ONLY, CART_TWO);
  await fillCustomerStep(page);
  await continueToNextStep(page);
  await waitForStep(page, "How would you like your order?");

  const collectionBtn = page.locator('button:has-text("Collection")').first();
  assert.equal(await collectionBtn.isDisabled(), true, "Collection button should be disabled");

  // Clicking it should not change the active fulfillment card.
  await collectionBtn.click({ force: true });
  await page.waitForTimeout(200);
  const active = page.locator('button[aria-pressed="true"]').first();
  assert.ok((await active.textContent()).includes("Delivery"), "Delivery should remain active");

  await screenshot(page, "collection-disabled");
}

async function testPaymentFailureAndRetry(page) {
  await seedCheckout(page, ZONE_BOTH, CART_TWO);
  await fillCustomerStep(page);
  await continueToNextStep(page);
  await waitForStep(page, "How would you like your order?");
  await selectFulfillment(page, "Collection");
  await continueToNextStep(page);
  await waitForStep(page, "Payment");

  await installPaystackMock(page, { type: "failure" });
  // Stable test IDs instead of transient copy/animation timing.
  const processing = page.locator('[data-testid="payment-processing"]');
  const failed = page.locator('[data-testid="payment-failed"]');
  await Promise.all([
    // The processing panel can be short-lived, so start waiting before clicking.
    processing.waitFor({ state: "attached", timeout: 10_000 }),
    page.click('[data-testid="checkout-pay"]'),
  ]);
  await failed.waitFor({ state: "visible", timeout: 15_000 });
  await failed.locator('text=Payment did').waitFor({ timeout: 5_000 });
  const retry = page.locator('[data-testid="payment-retry"]');
  await retry.waitFor({ state: "visible", timeout: 10_000 });
  await retry.click();
  await failed.waitFor({ state: "hidden", timeout: 10_000 });
  await page.waitForSelector('[data-testid="checkout-pay"]:not([disabled])', { timeout: 10_000 });
  await screenshot(page, "payment-failure-retry");
}

async function testPaymentSuccess(page) {
  const collectionTotal = PRODUCT_PRICE * 2 * (1 + TAX_RATE);
  const reference = await createPaystackCharge(Math.round(collectionTotal * 100));

  try {
    await seedCheckout(page, ZONE_BOTH, CART_TWO);
    await fillCustomerStep(page);
    await continueToNextStep(page);
    await waitForStep(page, "How would you like your order?");
    await selectFulfillment(page, "Collection");
    await continueToNextStep(page);
    await waitForStep(page, "Payment");

    await installPaystackMock(page, { type: "success", reference });
    const success = page.locator('[data-testid="payment-success"]');
    await Promise.all([
      success.waitFor({ state: "attached", timeout: 30_000 }),
      page.click('[data-testid="checkout-pay"]'),
    ]);
    await page.waitForURL("**/checkout/success**", { timeout: 20_000 });

    // Verify the order was persisted.
    const { data: order } = await admin
      .from("orders")
      .select("id, order_number, total_zar, fulfillment_method")
      .eq("paystack_reference", reference)
      .maybeSingle();
    assert.ok(order, "Order should exist in Supabase");
    assert.equal(Number(order.total_zar), collectionTotal);
    assert.equal(order.fulfillment_method, "collection");
    await screenshot(page, "payment-success");
  } finally {
    await cleanupOrderByReference(reference);
  }
}

async function runAll() {
  const tests = [
    { name: "Delivery summary updates correctly", run: testDeliverySummary },
    { name: "Collection summary updates correctly", run: testCollectionSummary },
    { name: "Delivery/Collection toggle updates summary and form", run: testDeliveryCollectionToggle },
    { name: "Customer step validation blocks empty fields", run: testCustomerValidation },
    { name: "Delivery address validation blocks empty fields", run: testDeliveryAddressValidation },
    { name: "Minimum order warning shows below threshold", run: testMinimumOrderWarning },
    { name: "Collection disabled when zone does not offer it", run: testCollectionDisabled },
    { name: "Payment failure shows retry messaging", run: testPaymentFailureAndRetry },
    { name: "Payment success creates order and shows animation", run: testPaymentSuccess },
  ];

  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new RegExp(onlyArg.slice("--only=".length), "i") : null;
  const selected = only ? tests.filter((t) => only.test(t.name)) : tests;

  const browser = await chromium.launch({ headless: true });
  const failures = [];

  CUSTOMER = await createEphemeralCustomerSession({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    projectId: SUPABASE_PROJECT_ID,
    emailPrefix: "checkout",
  });
  log(`Signed in as ephemeral customer ${CUSTOMER.email}`);

  await resolveZones();
  log(
    `Zones resolved — both: ${ZONE_BOTH} (fee ${ZONE_BOTH_CFG.fee}, min ${ZONE_BOTH_CFG.min}, eta ${ZONE_BOTH_CFG.eta}), delivery-only: ${ZONE_DELIVERY_ONLY}`,
  );

  for (const { name, run } of selected) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on("console", (m) => {
      if (process.env.DEBUG_CHECKOUT) console.log("  [browser]", m.type(), m.text().slice(0, 300));
    });
    try {
      log(`Running ${name}…`);
      await run(page);
      log(`✅ PASS — ${name}`);
    } catch (err) {
      console.error(`[checkout] ❌ FAIL — ${name}:`, err.message);
      await screenshot(page, `fail-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
      failures.push(name);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  await CUSTOMER.cleanup();
  log("Cleaned up ephemeral customer.");

  if (failures.length) {
    console.error(`\n[checkout] ❌ FAIL — ${failures.length} test(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  log("✅ PASS — all checkout regression tests passed.");
}

runAll().catch((err) => {
  console.error("[checkout] Fatal error:", err);
  process.exit(1);
});
