#!/usr/bin/env node
/**
 * End-to-end Playwright test: admin edits a product and both the home page
 * and the full menu update in real time in a separate customer session,
 * without a page reload.
 *
 * Env vars (required):
 *   BASE_URL             e.g. http://localhost:8080
 *   ADMIN_EMAIL, ADMIN_PASSWORD
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY  (used to pick a product)
 *
 * Optional:
 *   PRODUCT_SLUG            pin a specific product slug
 *   PROPAGATION_TIMEOUT_MS  default 15000
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const {
  BASE_URL = "http://localhost:8080",
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  PRODUCT_SLUG,
  PROPAGATION_TIMEOUT_MS = "15000",
} = process.env;

function need(name, val) {
  if (!val) { console.error(`Missing required env var: ${name}`); process.exit(2); }
}
need("ADMIN_EMAIL", ADMIN_EMAIL);
need("ADMIN_PASSWORD", ADMIN_PASSWORD);
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

async function signInAdmin(page) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 15000 }),
    page.getByRole("button", { name: /^sign in$/i }).click(),
  ]);
}

async function editProductTitle(adminPage, slug, newTitle) {
  await adminPage.goto(`${BASE_URL}/admin/products`, { waitUntil: "domcontentloaded" });
  await adminPage.getByPlaceholder(/search by name or slug/i).fill(slug);
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
  try {
    // Prime customer pages first so realtime subscriptions are live.
    await homePage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await menuPage.goto(`${BASE_URL}/menu/full-menu`, { waitUntil: "domcontentloaded" });
    await homePage.waitForTimeout(1500);
    await menuPage.waitForTimeout(1500);

    let homeNavs = 0, menuNavs = 0;
    homePage.on("framenavigated", (f) => { if (f === homePage.mainFrame()) homeNavs++; });
    menuPage.on("framenavigated", (f) => { if (f === menuPage.mainFrame()) menuNavs++; });

    await signInAdmin(adminPage);
    pass("admin signed in");
    await editProductTitle(adminPage, product.slug, updated);
    editApplied = true;
    pass("admin saved product title change");

    const homeOk = await waitForTextNoReload(homePage, SUFFIX, "Home /");
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
  }

  if (failures > 0) { console.error(`\n[admin-edit-e2e] FAIL — ${failures} check(s) failed`); process.exit(1); }
  console.log("\n[admin-edit-e2e] OK — admin -> customer realtime propagation verified");
}

main().catch((e) => { console.error(e); process.exit(1); });
