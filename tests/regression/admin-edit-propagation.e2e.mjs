#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

/**
 * End-to-end Playwright test: admin edits a product and both the home page
 * and the full menu update in real time in a separate customer session,
 * without a page reload.
 *
 * Env vars (required):
 *   BASE_URL             e.g. http://localhost:8080
 *   ADMIN_EMAIL, ADMIN_PASSWORD (optional — an ephemeral admin is provisioned
 *                                 automatically with the service-role key)
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY  (used to pick a product)
 *
 * Optional:
 *   PRODUCT_SLUG            pin a specific product slug
 *   PROPAGATION_TIMEOUT_MS  default 15000
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { resolveAdminCredentials } from "./lib/admin-session.mjs";
import { createEphemeralCustomerSession, storageKeyFor } from "./lib/browser-session.mjs";

const {
  BASE_URL = "http://localhost:8080",
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  PRODUCT_SLUG,
  PROPAGATION_TIMEOUT_MS = "15000",
} = process.env;

function need(name, val) {
  if (!val) { console.error(`Missing required env var: ${name}`); process.exit(2); }
}
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY);

const TIMEOUT = Number(PROPAGATION_TIMEOUT_MS);
const SUFFIX = `RT-${Date.now().toString(36)}`;
const log = (...a) => console.log("[admin-edit-e2e]", ...a);
let failures = 0;
const fail = (m, e) => { failures++; console.error("  x", m, e ?? ""); };
const pass = (m) => console.log("  v", m);

const supa = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function pickProduct() {
  if (PRODUCT_SLUG) {
    const { data, error } = await supa
      .from("products").select("slug,title").eq("slug", PRODUCT_SLUG).single();
    if (error || !data) throw new Error(`PRODUCT_SLUG not found: ${error?.message}`);
    return data;
  }
  const { data, error } = await supa
    .from("products").select("slug,title,is_active,sort_order")
    .eq("is_active", true).order("sort_order", { ascending: true }).limit(1);
  if (error || !data?.length) throw new Error(`No active products: ${error?.message}`);
  return data[0];
}

// Seed a real Supabase session into localStorage rather than driving the
// sign-in form: the global auth gate can redirect mid-typing and detach the
// form, and the configured admin password may have been rotated.
async function signInAdmin(page) {
  const creds = await resolveAdminCredentials();
  const { data, error } = await supa.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error || !data?.session) {
    throw new Error(`admin sign-in failed: ${error?.message ?? "no session"}`);
  }
  const storageKey = storageKeyFor(SUPABASE_URL, process.env.SUPABASE_PROJECT_ID);
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, session]) => window.localStorage.setItem(key, JSON.stringify(session)),
    [storageKey, data.session],
  );
  await page.goto(`${BASE_URL}/admin/products`, { waitUntil: "domcontentloaded" });
  // Wait for the auth gate to resolve the seeded session and the admin shell
  // to mount before any interaction — otherwise the first fill() races the
  // gate's loading screen.
  await page.getByPlaceholder(/search by name or slug/i).waitFor({ state: "visible", timeout: 30000 });
  await supa.auth.signOut().catch(() => {});
  return creds;
}

/** Active zone slug so the auto-opening zone picker never blocks clicks. */
async function pickZoneSlug() {
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = svc
    ? createClient(SUPABASE_URL, svc, { auth: { persistSession: false } })
    : supa;
  const { data } = await client
    .from("delivery_zones").select("slug").eq("is_active", true).limit(1);
  return data?.[0]?.slug ?? null;
}

/** Customer routes are behind the global auth gate too — seed a session. */
async function seedCustomer(pages) {
  const sess = await createEphemeralCustomerSession({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    projectId: process.env.SUPABASE_PROJECT_ID,
    emailPrefix: "regr-propagation",
  });
  const zoneSlug = await pickZoneSlug();
  const first = pages[0];
  await first.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
  await first.evaluate(
    ([key, session, zone]) => {
      window.localStorage.setItem(key, JSON.stringify(session));
      // Pre-select a delivery zone: otherwise the modal zone picker auto-opens
      // on customer routes and its backdrop intercepts every click.
      if (zone) window.localStorage.setItem("sweet-lovely-zone-v1", zone);
    },
    [sess.storageKey, sess.session, zoneSlug],
  );
  return sess;
}

async function editProductTitle(adminPage, slug, newTitle) {
  // Avoid a hard reload when we are already on the products page: a fresh
  // navigation re-runs the auth gate, which unmounts the admin shell while the
  // session is re-validated and detaches locators mid-interaction.
  if (!new URL(adminPage.url()).pathname.startsWith("/admin/products")) {
    await adminPage.goto(`${BASE_URL}/admin/products`, { waitUntil: "domcontentloaded" });
  }
  const searchBox = adminPage.getByPlaceholder(/search by name or slug/i);
  await searchBox.waitFor({ state: "visible", timeout: 30000 });
  await searchBox.fill(slug);
  const row = adminPage.locator("tr", { hasText: slug }).first();
  await row.waitFor({ state: "visible", timeout: 10000 });
  await row.getByRole("button", { name: /edit/i }).click();
  // Drawer form: Slug is disabled, Title is the next text input.
  const titleInput = adminPage.locator('aside form input[type="text"], aside form input:not([type])').nth(1);
  await titleInput.waitFor({ state: "visible", timeout: 5000 });
  await titleInput.fill(newTitle);
  await adminPage.locator('aside form button[type="submit"]').first().click();
  await adminPage.getByText(/product updated/i).waitFor({ timeout: 10000 });
}

async function waitForTextNoReload(page, text, label) {
  const start = Date.now();
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: TIMEOUT });
    pass(`${label} updated live in ${Date.now() - start}ms`);
    return true;
  } catch {
    fail(`${label} did NOT surface "${text}" within ${TIMEOUT}ms`);
    return false;
  }
}

async function main() {
  const product = await pickProduct();
  const original = product.title;
  const updated = `${original} ${SUFFIX}`;
  log(`Target product: ${product.slug} — "${original}" -> "${updated}"`);

  const browser = await chromium.launch({ headless: true });
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const custCtx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adminPage = await adminCtx.newPage();
  const homePage  = await custCtx.newPage();
  const menuPage  = await custCtx.newPage();

  let editApplied = false;
  let customer = null;
  let adminCreds = null;
  try {
    customer = await seedCustomer([homePage, menuPage]);
    // Prime customer pages first so realtime subscriptions are live.
    await homePage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await menuPage.goto(`${BASE_URL}/menu/full-menu`, { waitUntil: "domcontentloaded" });
    // Deterministic readiness: wait for hydrated content instead of sleeping.
    await homePage.locator("header").first().waitFor({ state: "visible", timeout: 30000 });
    await menuPage.locator("header").first().waitFor({ state: "visible", timeout: 30000 });
    await homePage.waitForLoadState("networkidle");
    await menuPage.waitForLoadState("networkidle");

    let homeNavs = 0, menuNavs = 0;
    homePage.on("framenavigated", (f) => { if (f === homePage.mainFrame()) homeNavs++; });
    menuPage.on("framenavigated", (f) => { if (f === menuPage.mainFrame()) menuNavs++; });

    adminCreds = await signInAdmin(adminPage);
    pass("admin signed in");
    await editProductTitle(adminPage, product.slug, updated);
    editApplied = true;
    pass("admin saved product title change");

    // Home no longer silently swaps content underneath the visitor: it shows a
    // non-intrusive "new updates available" pill (see content-update-banner).
    // Assert the pill appears from the realtime/fingerprint signal, then that
    // clicking Refresh surfaces the new title — all without a page reload.
    let homeOk = false;
    try {
      const banner = homePage.getByTestId("home-content-update-banner");
      await banner.waitFor({ state: "visible", timeout: TIMEOUT });
      pass("Home / surfaced the content-update pill");
      // Home renders home_popular_items/home_desserts rows, which carry their
      // own title copy — a products.title edit is intentionally NOT mirrored
      // there (that surface is covered by home-content-realtime.e2e.mjs).
      // What must hold here: the pill appears from the realtime/fingerprint
      // signal, Refresh re-fetches only the home query, and the pill clears —
      // all without a page reload.
      await homePage.getByTestId("home-content-refresh").click({ timeout: TIMEOUT });
      await banner.waitFor({ state: "hidden", timeout: TIMEOUT });
      pass("Home / Refresh re-fetched home content and cleared the pill");
      homeOk = true;
    } catch (e) {
      fail(`Home / content-update pill flow failed: ${(e && e.message) || e}`);
    }
    const menuOk = await waitForTextNoReload(menuPage, SUFFIX, "Full menu /menu/full-menu");

    if (homeOk) (homeNavs === 0 ? pass("Home did not reload") : fail(`Home reloaded (${homeNavs})`));
    if (menuOk) (menuNavs === 0 ? pass("Menu did not reload") : fail(`Menu reloaded (${menuNavs})`));
  } catch (e) {
    fail(`unexpected error: ${(e && e.message) || e}`);
  } finally {
    if (editApplied) {
      try {
        await editProductTitle(adminPage, product.slug, original);
        pass("restored original product title");
      } catch (e) { console.warn("[admin-edit-e2e] cleanup failed:", e?.message); }
    }
    await browser.close();
    if (customer) await customer.cleanup().catch(() => {});
    if (adminCreds) await adminCreds.cleanup().catch(() => {});
  }

  if (failures > 0) { console.error(`\n[admin-edit-e2e] FAIL — ${failures} check(s) failed`); process.exit(1); }
  console.log("\n[admin-edit-e2e] OK — admin -> customer realtime propagation verified");
}

main().catch((e) => { console.error(e); process.exit(1); });
