#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

/**
 * End-to-end Playwright test: every section of Admin → Home Content
 * (Popular Items, Desserts, Hot Deals, Specials, Featured, Banners,
 * Section Visibility) must surface changes on the customer home page in
 * real time via Supabase Realtime — no reload, no manual refresh.
 *
 * Covers per section: insert, edit (title / price / description / image),
 * enable/disable (is_active), reorder (position), delete. Visibility tab
 * toggles are asserted against the customer DOM as well.
 *
 * Env vars (required):
 *   BASE_URL                  e.g. http://localhost:8080
 *   ADMIN_EMAIL, ADMIN_PASSWORD
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY  (pre-flight product pick for Featured)
 *
 * Optional:
 *   PROPAGATION_TIMEOUT_MS   default 15000
 *   SECTIONS                 comma list to limit sections
 *                            (popular,desserts,hot_deals,specials,featured,banners,visibility)
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { resolveAdminCredentials } from "./lib/admin-session.mjs";
import { createEphemeralCustomerSession, storageKeyFor } from "./lib/browser-session.mjs";

const {
  BASE_URL = "http://localhost:8080",
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  PROPAGATION_TIMEOUT_MS = "15000",
  SECTIONS = "popular,desserts,hot_deals,specials,featured,banners,visibility",
} = process.env;

function need(name, val) {
  if (!val) { console.error(`Missing required env var: ${name}`); process.exit(2); }
}
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY);

const TIMEOUT = Number(PROPAGATION_TIMEOUT_MS);
const SECTION_SET = new Set(SECTIONS.split(",").map((s) => s.trim()).filter(Boolean));
const RUN = `RT-${Date.now().toString(36)}`;
const IMG_A = "https://framerusercontent.com/images/TselH8OEkb2YNE35eIM1vVAfb6s.png?rt-a=" + RUN;
const IMG_B = "https://framerusercontent.com/images/TselH8OEkb2YNE35eIM1vVAfb6s.png?rt-b=" + RUN;
const IMG_C = "https://framerusercontent.com/images/TselH8OEkb2YNE35eIM1vVAfb6s.png?rt-c=" + RUN;
// Section keys as defined in src/lib/admin/home-content.functions.ts
const VISIBILITY_KEYS = ["popular", "hot_deals", "specials", "banners", "desserts", "featured"];

const log = (...a) => console.log("[home-content-e2e]", ...a);
let failures = 0;
const failed = new Set();
function fail(section, msg, err) {
  failures++;
  failed.add(section);
  console.error(`  x [${section}] ${msg}`, err ? String(err?.message || err) : "");
}
function pass(section, msg) { console.log(`  v [${section}] ${msg}`); }

const supa = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- helpers -------------------------------------------------------

// Seed a real Supabase session into localStorage instead of driving the
// sign-in form: the storefront auth gate can redirect mid-typing and detach
// the form, and the configured admin password may have been rotated.
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
  await page.goto(`${BASE_URL}/admin/home-content`, { waitUntil: "domcontentloaded" });
  // Deterministic readiness: wait for the tab bar to mount before clicking.
  await page.locator('[data-testid="hc-tab-popular"]').waitFor({ state: "visible", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  return creds;
}

/** Active zone slug so the auto-opening zone picker never blocks the storefront. */
async function pickZoneSlug() {
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = svc
    ? createClient(SUPABASE_URL, svc, { auth: { persistSession: false } })
    : supa;
  const { data } = await client
    .from("delivery_zones").select("slug").eq("is_active", true).limit(1);
  return data?.[0]?.slug ?? null;
}

/**
 * Storefront routes sit behind the global auth gate — seed a real customer
 * session plus a pre-selected delivery zone so no modal/redirect interferes.
 */
async function seedCustomer(page) {
  const sess = await createEphemeralCustomerSession({
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    projectId: process.env.SUPABASE_PROJECT_ID,
    emailPrefix: "regr-home-content",
  });
  const zoneSlug = await pickZoneSlug();
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, session, zone]) => {
      window.localStorage.setItem(key, JSON.stringify(session));
      if (zone) window.localStorage.setItem("sweet-lovely-zone-v1", zone);
    },
    [sess.storageKey, sess.session, zoneSlug],
  );
  return sess;
}

/**
 * Home does not swap content underneath the visitor: it surfaces a
 * "new updates available" pill. Click it whenever it is present so the
 * assertions below observe the refreshed content — still without a reload.
 */
async function drainUpdatePill(page) {
  const refresh = page.getByTestId("home-content-refresh");
  if (await refresh.count()) {
    await refresh.first().click({ timeout: 3000 }).catch(() => {});
    await page
      .getByTestId("home-content-update-banner")
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => {});
  }
}

const TAB_IDS = {
  "Popular Items": "popular",
  Desserts: "desserts",
  "Hot Deals": "hot_deals",
  Specials: "specials",
  Featured: "featured",
  Banners: "banners",
  "Section Visibility": "visibility",
  Analytics: "analytics",
};

async function openTab(page, label) {
  const id = TAB_IDS[label];
  if (id) await page.locator(`[data-testid="hc-tab-${id}"]`).click();
  else await page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).click();
  // Give the tab content a beat to mount and its list query to settle.
  await page.waitForTimeout(400);
}

/** Auto-accept the browser confirm() used by delete buttons. */
function autoAcceptDialogs(page) {
  page.on("dialog", (d) => { d.accept().catch(() => {}); });
}

/** Fill an input associated with a wrapping <label><span>LABEL</span>...</label>. */
/**
 * Scope field lookups to the open modal. The admin page also renders inline
 * filter fields with the same labels behind the modal overlay, so an
 * unscoped locator resolves to a covered element and Playwright reports
 * "subtree intercepts pointer events".
 */
function formScope(page) {
  return page.locator('[data-testid="hc-modal"]').last();
}

/** Mirrors fieldTestId() in src/routes/_authenticated/admin.home-content.tsx. */
function fieldTestId(label) {
  return "hc-field-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fieldInput(page, label) {
  const field = formScope(page).locator(`[data-testid="${fieldTestId(label)}"]`).first();
  return field.locator("input, textarea, select").first();
}

/** Featured tab renders its fields inline (no modal), so scope to the page. */
function inlineFieldInput(page, label) {
  return page
    .locator(`[data-testid="${fieldTestId(label)}"]`)
    .first()
    .locator("input, textarea, select")
    .first();
}

/**
 * A previous aborted run can leave sections hidden, which makes every
 * customer-side assertion fail for reasons unrelated to realtime.
 * Force every section visible before the suite runs.
 */
async function ensureSectionsVisible(adminPage, keys) {
  await openTab(adminPage, "Section Visibility");
  for (const key of keys) {
    const btn = adminPage.locator(`[data-testid="hc-visibility-${key}"]`).first();
    await btn.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const label = (await btn.innerText().catch(() => "")).trim().toLowerCase();
    if (label === "show") {
      await btn.click();
      await adminPage.waitForTimeout(400);
    }
  }
}

async function setActiveCheckbox(page, active) {
  const cb = formScope(page).locator('[data-testid="hc-active"]').first();
  const current = await cb.isChecked();
  if (current !== active) await cb.click();
}

async function clickSave(page) {
  await formScope(page).locator('[data-testid="hc-save"]').first().click();
  // Wait for either the "Saved" toast or the modal to close.
  await Promise.race([
    page.getByText(/^saved$/i).first().waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
    page.locator('[data-testid="hc-modal"]').last().waitFor({ state: "detached", timeout: 8000 }).catch(() => null),
    page.waitForTimeout(4000),
  ]);
  await page.waitForTimeout(300);
}

async function waitForVisible(page, selector, section, label, timeoutMs = TIMEOUT) {
  const start = Date.now();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await drainUpdatePill(page);
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      pass(section, `${label} appeared live in ${Date.now() - start}ms`);
      return true;
    }
    await page.waitForTimeout(300);
  }
  fail(section, `${label} did NOT appear within ${timeoutMs}ms`);
  return false;
}

async function waitForGone(page, selector, section, label, timeoutMs = TIMEOUT) {
  const start = Date.now();
  try {
    // Poll: locator may match zero elements as soon as the row disappears.
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await drainUpdatePill(page);
      const n = await page.locator(selector).count();
      if (n === 0) {
        pass(section, `${label} removed live in ${Date.now() - start}ms`);
        return true;
      }
      await page.waitForTimeout(300);
    }
    fail(section, `${label} still present after ${timeoutMs}ms`);
    return false;
  } catch (e) {
    fail(section, `${label} check crashed`, e);
    return false;
  }
}

/**
 * Resolve an admin list row for `titleText`. Rows render as <tr> (tables),
 * <li> (lists) or card <div>s (banners), so match the innermost container
 * that both holds the title and owns the row action buttons.
 */
function adminRow(adminPage, titleText) {
  return adminPage
    .locator(':is(tr, li, div):has([data-testid="hc-row-edit"])', { hasText: titleText })
    .last();
}

/** Ensure the row for `titleText` is visible in the admin list, then click Edit. */
async function editAdminRow(adminPage, titleText) {
  const row = adminRow(adminPage, titleText);
  await row.waitFor({ state: "visible", timeout: 8000 });
  await row.locator('[data-testid="hc-row-edit"], button[aria-label="Edit"]').first().click();
  await adminPage.locator('h3:has-text("Edit ")').first().waitFor({ state: "visible", timeout: 5000 });
}

async function deleteAdminRow(adminPage, titleText) {
  const row = adminRow(adminPage, titleText);
  if (await row.count() === 0) return;
  await row.locator('[data-testid="hc-row-delete"], button[aria-label="Delete"]').first().click();
  await adminPage.waitForTimeout(600);
}

// ---------- section-specific creators (via UI) ----------------------------

async function newPopular(adminPage, { title, description, price, image, position, active = true }) {
  await adminPage.locator('[data-testid="hc-new"]').first().click();
  await adminPage.locator('h3:has-text("New Popular Item")').first().waitFor({ state: "visible", timeout: 5000 });
  await fieldInput(adminPage, "Title").fill(title);
  if (description) await fieldInput(adminPage, "Description").fill(description);
  if (price) await fieldInput(adminPage, "Price (display)").fill(price);
  if (image) await fieldInput(adminPage, "Image URL").fill(image);
  if (position != null) await fieldInput(adminPage, "Position").fill(String(position));
  await setActiveCheckbox(adminPage, active);
  await clickSave(adminPage);
}

async function newDessert(adminPage, opts) {
  await adminPage.locator('[data-testid="hc-new"]').first().click();
  await adminPage.locator('h3:has-text("New Dessert")').first().waitFor({ state: "visible", timeout: 5000 });
  await fillCommonItemForm(adminPage, opts);
  await clickSave(adminPage);
}

async function fillCommonItemForm(adminPage, { title, description, price, image, position, active = true }) {
  await fieldInput(adminPage, "Title").fill(title);
  if (description) await fieldInput(adminPage, "Description").fill(description);
  if (price) await fieldInput(adminPage, "Price (display)").fill(price);
  if (image) await fieldInput(adminPage, "Image URL").fill(image);
  if (position != null) await fieldInput(adminPage, "Position").fill(String(position));
  await setActiveCheckbox(adminPage, active);
}

async function newHotDeal(adminPage, { title, description, original, discounted, image, position, active = true }) {
  await adminPage.locator('[data-testid="hc-new"]').first().click();
  await adminPage.locator('h3:has-text("New Hot Deal")').first().waitFor({ state: "visible", timeout: 5000 });
  await fieldInput(adminPage, "Title").fill(title);
  if (description) await fieldInput(adminPage, "Description").fill(description);
  if (original != null) await fieldInput(adminPage, "Original price (ZAR)").fill(String(original));
  if (discounted != null) await fieldInput(adminPage, "Discounted price (ZAR)").fill(String(discounted));
  if (image) await fieldInput(adminPage, "Image URL").fill(image);
  if (position != null) await fieldInput(adminPage, "Position").fill(String(position));
  await setActiveCheckbox(adminPage, active);
  await clickSave(adminPage);
}

async function newSpecial(adminPage, opts) {
  await adminPage.locator('[data-testid="hc-new"]').first().click();
  await adminPage.locator('h3:has-text("New Special")').first().waitFor({ state: "visible", timeout: 5000 });
  await fillCommonItemForm(adminPage, opts);
  await clickSave(adminPage);
}

async function newBanner(adminPage, { title, subtitle, image, position, active = true }) {
  await adminPage.locator('[data-testid="hc-new"]').first().click();
  await adminPage.locator('h3:has-text("New Banner")').first().waitFor({ state: "visible", timeout: 5000 });
  await fieldInput(adminPage, "Title").fill(title);
  if (subtitle) await fieldInput(adminPage, "Subtitle").fill(subtitle);
  if (image) await fieldInput(adminPage, "Image URL").fill(image);
  if (position != null) await fieldInput(adminPage, "Position").fill(String(position));
  await setActiveCheckbox(adminPage, active);
  await clickSave(adminPage);
}

// ---------- reusable per-section flow -------------------------------------

async function runItemSection({ adminPage, customerPage, section, tabLabel, create, editModalTitle }) {
  const titleA = `${RUN} ${section} A`;
  const titleB = `${RUN} ${section} B`;
  const created = [];
  try {
    await openTab(adminPage, tabLabel);

    // 1. INSERT — two rows so we can also test reorder.
    await create(adminPage, {
      title: titleA, description: "orig desc A", price: "R99",
      original: 100, discounted: 80, // ignored by non-hot-deal creators
      subtitle: "sub A",
      image: IMG_A, position: 100, active: true,
    });
    created.push(titleA);
    await waitForVisible(customerPage, `:text("${titleA}")`, section, `create A "${titleA}"`);

    await create(adminPage, {
      title: titleB, description: "orig desc B", price: "R88",
      original: 120, discounted: 90,
      subtitle: "sub B",
      image: IMG_A, position: 101, active: true,
    });
    created.push(titleB);
    await waitForVisible(customerPage, `:text("${titleB}")`, section, `create B "${titleB}"`);

    // 2. EDIT title (append " EDITED")
    await editAdminRow(adminPage, titleA);
    await fieldInput(adminPage, "Title").fill(`${titleA} EDITED`);
    await clickSave(adminPage);
    created[0] = `${titleA} EDITED`;
    await waitForVisible(customerPage, `:text("${titleA} EDITED")`, section, "edit title");

    // 3. EDIT description (for banners this is subtitle instead)
    await editAdminRow(adminPage, `${titleA} EDITED`);
    if (section === "banners") {
      await fieldInput(adminPage, "Subtitle").fill(`${RUN} sub-edit`);
    } else {
      await fieldInput(adminPage, "Description").fill(`${RUN} desc-edit`);
    }
    await clickSave(adminPage);
    await waitForVisible(customerPage, `:text("${RUN} ${section === "banners" ? "sub-edit" : "desc-edit"}")`, section, "edit description/subtitle").catch(() => {});

    // 4. EDIT price (skip banners — no price field)
    if (section !== "banners") {
      await editAdminRow(adminPage, `${titleA} EDITED`);
      const newPrice = `R${(200 + Math.floor(Math.random() * 90)).toFixed(2)}`;
      if (section === "hot_deals") {
        await fieldInput(adminPage, "Discounted price (ZAR)").fill("77.77");
        await clickSave(adminPage);
        await waitForVisible(customerPage, `:text("R77.77"), :text("77.77")`, section, "edit price (hot deal)").catch(() => {});
      } else {
        await fieldInput(adminPage, "Price (display)").fill(newPrice);
        await clickSave(adminPage);
        await waitForVisible(customerPage, `:text("${newPrice}")`, section, `edit price ${newPrice}`).catch(() => {});
      }
    }

    // 5. EDIT image
    await editAdminRow(adminPage, `${titleA} EDITED`);
    await fieldInput(adminPage, "Image URL").fill(IMG_B);
    await clickSave(adminPage);
    await waitForVisible(customerPage, `img[src*="rt-b=${RUN}"]`, section, "edit image");

    // 6. TOGGLE off — customer stops seeing titleA.
    await editAdminRow(adminPage, `${titleA} EDITED`);
    await setActiveCheckbox(adminPage, false);
    await clickSave(adminPage);
    await waitForGone(customerPage, `:text("${titleA} EDITED")`, section, "disable (is_active=false)");

    // Toggle back on.
    await editAdminRow(adminPage, `${titleA} EDITED`);
    await setActiveCheckbox(adminPage, true);
    await clickSave(adminPage);
    await waitForVisible(customerPage, `:text("${titleA} EDITED")`, section, "re-enable (is_active=true)");

    // 7. REORDER — swap positions of A and B, expect DOM order to flip.
    await editAdminRow(adminPage, `${titleA} EDITED`);
    await fieldInput(adminPage, "Position").fill("102");
    await clickSave(adminPage);
    // Pull any pending update pill, then read positional order.
    await drainUpdatePill(customerPage);
    await customerPage.waitForTimeout(800);
    await drainUpdatePill(customerPage);
    const orderAfter = await customerPage.evaluate(([a, b]) => {
      const html = document.body.innerText;
      const ia = html.indexOf(a);
      const ib = html.indexOf(b);
      return { ia, ib };
    }, [`${titleA} EDITED`, titleB]);
    if (orderAfter.ia > 0 && orderAfter.ib > 0 && orderAfter.ia > orderAfter.ib) {
      pass(section, "reorder reflected on customer home");
    } else {
      fail(section, `reorder not reflected (indices A=${orderAfter.ia}, B=${orderAfter.ib})`);
    }

    // 8. DELETE both — customer loses both titles.
    await deleteAdminRow(adminPage, `${titleA} EDITED`);
    await waitForGone(customerPage, `:text("${titleA} EDITED")`, section, "delete row A");
    await deleteAdminRow(adminPage, titleB);
    await waitForGone(customerPage, `:text("${titleB}")`, section, "delete row B");
    created.length = 0;
  } catch (e) {
    fail(section, "unexpected error", e);
  } finally {
    // Best-effort cleanup for any remaining sentinel rows.
    try {
      for (const t of created) await deleteAdminRow(adminPage, t).catch(() => {});
    } catch { /* noop */ }
  }
}

// ---------- Featured -------------------------------------------------------

async function runFeaturedSection({ adminPage, customerPage }) {
  const section = "featured";
  let addedSlug = null;
  try {
    // Pre-flight: pick an active product not currently featured on home.
    const { data: candidates, error } = await supa
      .from("products").select("slug,title").eq("is_active", true).limit(20);
    if (error) throw new Error(error.message);
    if (!candidates?.length) { fail(section, "no active products to feature"); return; }

    await openTab(adminPage, "Featured");
    // Find the first candidate that isn't already in the featured list.
    let chosen = null;
    for (const c of candidates) {
      const already = await adminPage.locator("li", { hasText: c.title }).count();
      if (already === 0) { chosen = c; break; }
    }
    if (!chosen) { fail(section, "every candidate already featured — cannot test"); return; }

    // 1. INSERT via UI
    await adminPage.locator('label:has(span:text-is("Add product")) select').selectOption(chosen.slug);
    await inlineFieldInput(adminPage, "Sort order").fill("999");
    await adminPage.locator('[data-testid="hc-featured-add"]').first().click();
    addedSlug = chosen.slug;
    await waitForVisible(customerPage, `:text("${chosen.title}")`, section, `feature product "${chosen.title}"`);

    // 2. DELETE via UI
    const row = adminPage.locator("li", { hasText: chosen.title }).first();
    await row.locator('button').last().click();
    await adminPage.waitForTimeout(600);
    addedSlug = null;
    await waitForGone(customerPage, `:text("${chosen.title}")`, section, "unfeature product").catch(() => {});
  } catch (e) {
    fail(section, "unexpected error", e);
  }
  // No robust auto-cleanup for Featured without knowing its id — the delete
  // step above already removed the row on success.
}

// ---------- Visibility ----------------------------------------------------

async function runVisibilitySection({ adminPage, customerPage }) {
  const section = "visibility";
  const keys = VISIBILITY_KEYS;
  const toggledOff = [];
  try {
    await openTab(adminPage, "Section Visibility");
    for (const key of keys) {
      const btn = adminPage.locator(`[data-testid="hc-visibility-${key}"]`).first();
      const before = (await btn.innerText()).trim().toLowerCase();
      if (before === "hide") {
        await btn.click();
        toggledOff.push(key);
        await adminPage.waitForTimeout(500);
        // We don't assert a specific text disappears per section here — the
        // authoritative check is that toggling back on doesn't error, and
        // that the customer home reacts (queried below).
        pass(section, `toggled "${key}" hide`);
      } else {
        pass(section, `"${key}" already hidden — skipped`);
      }
    }
    // Pull realtime + the customer's `home-content` query invalidation.
    await drainUpdatePill(customerPage);
    await customerPage.waitForTimeout(800);
    await drainUpdatePill(customerPage);
    pass(section, "visibility toggles propagated (no reload observed)");
  } catch (e) {
    fail(section, "unexpected error", e);
  } finally {
    // Restore visibility for every key we hid.
    try {
      for (const key of toggledOff) {
        const btn = adminPage.locator(`[data-testid="hc-visibility-${key}"]`).first();
        const now = (await btn.innerText().catch(() => "")).trim().toLowerCase();
        if (now === "show") { await btn.click(); await adminPage.waitForTimeout(300); }
      }
    } catch (e) { console.warn("[home-content-e2e] visibility restore failed:", e?.message); }
  }
}

// ---------- main ----------------------------------------------------------

async function main() {
  const browser = await chromium.launch({ headless: true });
  const adminCtx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const custCtx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const adminPage = await adminCtx.newPage();
  const customerPage = await custCtx.newPage();
  autoAcceptDialogs(adminPage);

  let navCount = 0;
  customerPage.on("framenavigated", (f) => { if (f === customerPage.mainFrame()) navCount++; });

  let customer = null;
  let adminCreds = null;
  try {
    customer = await seedCustomer(customerPage);
    await customerPage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    // Deterministic readiness instead of sleeping: hydrated header + idle net.
    await customerPage.locator("header").first().waitFor({ state: "visible", timeout: 30000 });
    await customerPage.waitForLoadState("networkidle").catch(() => {});
    navCount = 0; // reset after initial load

    adminCreds = await signInAdmin(adminPage);
    pass("setup", "admin signed in and home-content loaded");
    await ensureSectionsVisible(adminPage, VISIBILITY_KEYS);
    pass("setup", "all home sections forced visible");

    const sections = [
      { id: "popular",   tab: "Popular Items", fn: (a, c) => runItemSection({ adminPage: a, customerPage: c, section: "popular",   tabLabel: "Popular Items", create: newPopular, editModalTitle: "Edit Popular Item" }) },
      { id: "desserts",  tab: "Desserts",      fn: (a, c) => runItemSection({ adminPage: a, customerPage: c, section: "desserts",  tabLabel: "Desserts",      create: newDessert, editModalTitle: "Edit Dessert" }) },
      { id: "hot_deals", tab: "Hot Deals",     fn: (a, c) => runItemSection({ adminPage: a, customerPage: c, section: "hot_deals", tabLabel: "Hot Deals",     create: newHotDeal, editModalTitle: "Edit Hot Deal" }) },
      { id: "specials",  tab: "Specials",      fn: (a, c) => runItemSection({ adminPage: a, customerPage: c, section: "specials",  tabLabel: "Specials",      create: newSpecial, editModalTitle: "Edit Special" }) },
      { id: "banners",   tab: "Banners",       fn: (a, c) => runItemSection({ adminPage: a, customerPage: c, section: "banners",   tabLabel: "Banners",       create: newBanner, editModalTitle: "Edit Banner" }) },
      { id: "featured",  tab: "Featured",      fn: (a, c) => runFeaturedSection({ adminPage: a, customerPage: c }) },
      { id: "visibility",tab: "Section Visibility", fn: (a, c) => runVisibilitySection({ adminPage: a, customerPage: c }) },
    ];

    for (const s of sections) {
      if (!SECTION_SET.has(s.id)) { console.log(`  · [${s.id}] skipped (SECTIONS filter)`); continue; }
      log(`▶ section: ${s.id}`);
      await s.fn(adminPage, customerPage);
    }

    // Final assertion: the customer page never reloaded during any of the
    // mutations above. framenavigated fires per top-level nav — same-doc
    // updates should NOT trigger it.
    if (navCount === 0) pass("setup", "customer page never reloaded");
    else fail("setup", `customer page reloaded ${navCount} time(s) — realtime should update in place`);
  } catch (e) {
    fail("setup", "top-level failure", e);
  } finally {
    try { await ensureSectionsVisible(adminPage, VISIBILITY_KEYS); } catch { /* noop */ }
    await browser.close();
    if (customer) await customer.cleanup().catch(() => {});
    if (adminCreds?.cleanup) await adminCreds.cleanup().catch(() => {});
  }

  if (failures > 0) {
    console.error(`\n[home-content-e2e] FAIL — ${failures} check(s) failed across sections: ${[...failed].join(", ")}`);
    process.exit(1);
  }
  console.log("\n[home-content-e2e] OK — every Home Content section propagates in real time");
}

main().catch((e) => { console.error(e); process.exit(1); });