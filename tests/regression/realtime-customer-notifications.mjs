#!/usr/bin/env node
/**
 * Regression: when an order is created for a signed-in customer, that
 * customer must — without any page refresh — see:
 *   1. A sonner toast announcing the notification.
 *   2. The notification bell unread badge increment by 1.
 *   3. A persisted row in public.notifications for their user_id.
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
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
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
need("CUSTOMER_EMAIL", CUSTOMER_EMAIL);
need("CUSTOMER_PASSWORD", CUSTOMER_PASSWORD);

const projectRef =
  SUPABASE_PROJECT_ID || new URL(SUPABASE_URL).hostname.split(".")[0];
const STORAGE_KEY = `sb-${projectRef}-auth-token`;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORDER_NUMBER = `REGR-NOTIF-${Date.now()}`;

function log(...args) {
  console.log(`[regression:notif]`, ...args);
}

async function signInCustomer() {
  const { data, error } = await userClient.auth.signInWithPassword({
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD,
  });
  if (error || !data.session || !data.user) {
    throw new Error(`Customer sign-in failed: ${error?.message ?? "no session"}`);
  }
  return { session: data.session, userId: data.user.id };
}

async function insertOrderForCustomer(userId) {
  const { data, error } = await admin
    .from("orders")
    .insert({
      order_number: ORDER_NUMBER,
      user_id: userId,
      customer_name: "Regression Notif Bot",
      customer_email: CUSTOMER_EMAIL,
      customer_phone: "+27000000000",
      status: "pending",
      total_zar: 99.0,
      subtotal_zar: 99.0,
      delivery_zar: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Insert order failed: ${error.message}`);
  return data.id;
}

async function cleanup(orderId, userId) {
  if (orderId) {
    await admin.from("order_items").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
  }
  if (userId) {
    // Trigger-generated notification(s) referencing this order_number.
    await admin
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .ilike("title", "%Order received%")
      .like("body", `%${ORDER_NUMBER}%`);
  }
}

async function readBadgeCount(page) {
  const attr = await page
    .locator('[data-testid="notification-bell"]')
    .first()
    .getAttribute("data-unread-count");
  return attr ? Number(attr) : 0;
}

async function run() {
  log(`Signing in as customer ${CUSTOMER_EMAIL}…`);
  const { session, userId } = await signInCustomer();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  let orderId;
  try {
    // Seed the customer session before the app boots.
    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(session)],
    );

    log("Reloading as signed-in customer…");
    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });

    // The bell only renders for signed-in users.
    const bell = page.locator('[data-testid="notification-bell"]').first();
    await bell.waitFor({ state: "visible", timeout: 20_000 });

    // Wait until the realtime channel has fully SUBSCRIBED, otherwise inserts
    // performed before the join completes will be missed and the test flakes.
    log("Waiting for realtime channel to SUBSCRIBE…");
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="notification-bell"]');
        return el?.getAttribute("data-rt-status") === "SUBSCRIBED";
      },
      undefined,
      { timeout: 20_000 },
    );

    // Sonner toaster region must be mounted before the toast can render.
    await page.waitForSelector('section[aria-label*="Notifications"]', {
      timeout: 10_000,
    });
    await page.screenshot({ path: join(ARTIFACTS, "notif_1_before.png") });

    const beforeCount = await readBadgeCount(page);
    log(`Initial unread badge: ${beforeCount}`);

    const urlBefore = page.url();

    log(`Inserting order ${ORDER_NUMBER} for user ${userId}…`);
    orderId = await insertOrderForCustomer(userId);

    // 1) Toast appears (sonner emits li[data-sonner-toast]).
    log("Waiting for sonner toast…");
    const toast = page.locator('li[data-sonner-toast]:has-text("Order received")').first();
    await toast.waitFor({ state: "visible", timeout: 20_000 });

    // 2) Badge updates without a refresh.
    log("Waiting for unread badge to increment…");
    await page.waitForFunction(
      (prev) => {
        const el = document.querySelector('[data-testid="notification-bell"]');
        if (!el) return false;
        const current = Number(el.getAttribute("data-unread-count") || "0");
        return current > prev;
      },
      beforeCount,
      { timeout: 20_000 },
    );
    const afterCount = await readBadgeCount(page);
    await page.screenshot({ path: join(ARTIFACTS, "notif_2_after.png") });

    if (page.url() !== urlBefore) {
      throw new Error(`Page navigated during the test (was ${urlBefore}, now ${page.url()})`);
    }
    if (afterCount !== beforeCount + 1) {
      throw new Error(
        `Unread badge did not increment by 1 (before=${beforeCount}, after=${afterCount}).`,
      );
    }

    // 3) Notification is actually persisted in Supabase.
    log("Verifying persisted notification row…");
    const { data: rows, error } = await admin
      .from("notifications")
      .select("id, user_id, title, body, category, read")
      .eq("user_id", userId)
      .like("body", `%${ORDER_NUMBER}%`)
      .limit(1);
    if (error) throw new Error(`Notification lookup failed: ${error.message}`);
    if (!rows || rows.length === 0) {
      throw new Error(`No notification row found in Supabase for ${ORDER_NUMBER}.`);
    }
    const row = rows[0];
    if (row.user_id !== userId) {
      throw new Error(`Notification user_id mismatch: ${row.user_id} !== ${userId}`);
    }
    if (row.read !== false) {
      throw new Error(`Notification should be unread on creation, got read=${row.read}.`);
    }

    log(
      `✅ PASS — toast shown, badge ${beforeCount}→${afterCount}, notification ${row.id} persisted.`,
    );
  } catch (err) {
    await page.screenshot({ path: join(ARTIFACTS, "notif_fail.png") }).catch(() => {});
    console.error(`[regression:notif] ❌ FAIL`, err);
    process.exitCode = 1;
  } finally {
    await cleanup(orderId, userId).catch((e) =>
      console.error("[regression:notif] cleanup error", e),
    );
    await browser.close();
  }
}

run();