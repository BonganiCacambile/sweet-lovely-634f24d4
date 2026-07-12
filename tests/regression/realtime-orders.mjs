#!/usr/bin/env node
/**
 * Regression: a new customer order must appear in the admin Orders
 * dashboard in real time, without a page refresh.
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

const projectRef =
  SUPABASE_PROJECT_ID || new URL(SUPABASE_URL).hostname.split(".")[0];
const STORAGE_KEY = `sb-${projectRef}-auth-token`;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORDER_NUMBER = `REGR-${Date.now()}`;
const CUSTOMER_NAME = `Regression Bot ${ORDER_NUMBER}`;

function log(...args) {
  console.log(`[regression]`, ...args);
}

async function signInAdmin() {
  const { data, error } = await userClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Admin sign-in failed: ${error?.message ?? "no session"}`);
  }
  return data.session;
}

async function insertOrder() {
  const { data, error } = await admin
    .from("orders")
    .insert({
      order_number: ORDER_NUMBER,
      customer_name: CUSTOMER_NAME,
      customer_email: "regression@example.com",
      customer_phone: "+27000000000",
      status: "pending",
      total_zar: 123.45,
      subtotal_zar: 123.45,
      delivery_zar: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Insert order failed: ${error.message}`);
  return data.id;
}

async function cleanup(orderId) {
  if (!orderId) return;
  await admin.from("order_items").delete().eq("order_id", orderId);
  await admin.from("orders").delete().eq("id", orderId);
}

async function run() {
  log(`Signing in as ${ADMIN_EMAIL}…`);
  const session = await signInAdmin();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  let orderId;
  try {
    // Seed the session in localStorage before any app code runs.
    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(session)],
    );

    log("Opening /admin/orders…");
    await page.goto(`${APP_URL}/admin/orders`, { waitUntil: "networkidle" });

    // Wait for the orders table (or empty state) to render — proves the
    // page is mounted and the realtime hook has subscribed.
    await page.waitForSelector("table, :text('No orders yet')", { timeout: 15_000 });
    await page.screenshot({ path: join(ARTIFACTS, "1_before.png") });

    const beforeCount = await page.locator("table tbody tr").count().catch(() => 0);
    log(`Initial visible rows: ${beforeCount}`);

    log(`Inserting test order ${ORDER_NUMBER} via service role…`);
    orderId = await insertOrder();

    log("Polling DOM for the new order without refreshing…");
    const navigationsBefore = page.url();
    const appeared = await page
      .locator(`table tbody tr:has-text("${ORDER_NUMBER}")`)
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    await page.screenshot({ path: join(ARTIFACTS, "2_after.png") });

    if (page.url() !== navigationsBefore) {
      throw new Error(`Page navigated during the test (was ${navigationsBefore}, now ${page.url()})`);
    }
    if (!appeared) {
      throw new Error(
        `Order ${ORDER_NUMBER} did not appear in the admin table within 20s — realtime regression!`,
      );
    }

    log(`✅ PASS — ${ORDER_NUMBER} appeared without a refresh.`);
  } catch (err) {
    await page.screenshot({ path: join(ARTIFACTS, "fail.png") }).catch(() => {});
    console.error(`[regression] ❌ FAIL`, err);
    process.exitCode = 1;
  } finally {
    await cleanup(orderId).catch((e) => console.error("[regression] cleanup error", e));
    await browser.close();
  }
}

run();