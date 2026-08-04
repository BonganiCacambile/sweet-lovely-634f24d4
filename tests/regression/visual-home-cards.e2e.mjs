#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

/**
 * Lightweight visual regression snapshots for the two most style-sensitive
 * surfaces on the home page: the Featured product card and a Hot Deal card.
 *
 * Deterministic by construction:
 *  - fixture rows are seeded with the service-role key (fixed title, prices,
 *    description) and removed afterwards, so live content cannot shift a pixel;
 *  - the card image is an inline SVG data URI, so no network image can flake;
 *  - the browser runs with `prefers-reduced-motion: reduce` (Reveal renders in
 *    its final state) and Playwright's own animation freezing;
 *  - only the card element is captured, never the full page.
 *
 * Baselines live in tests/regression/__screenshots__/. First run (or
 * UPDATE_SNAPSHOTS=1) writes them; later runs diff with pixelmatch and write
 * actual/diff PNGs to tests/regression/artifacts/visual/ on failure.
 *
 * Env: BASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Optional: UPDATE_SNAPSHOTS=1, VISUAL_TOLERANCE (max % differing pixels, default 0.5)
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { createEphemeralCustomerSession } from "./lib/browser-session.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(HERE, "__screenshots__");
const ARTIFACT_DIR = join(HERE, "artifacts", "visual");

const {
  BASE_URL = "http://localhost:8080",
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  UPDATE_SNAPSHOTS,
  VISUAL_TOLERANCE = "0.5",
} = process.env;

for (const [name, val] of [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
]) {
  if (!val) { console.error(`Missing required env var: ${name}`); process.exit(2); }
}

const TOLERANCE_PCT = Number(VISUAL_TOLERANCE);
const UPDATE = UPDATE_SNAPSHOTS === "1" || UPDATE_SNAPSHOTS === "true";

const PRODUCT_SLUG = "vr-snapshot-pizza";
const PRODUCT_TITLE = "VR Snapshot Pizza";
const DEAL_TITLE = "VR Snapshot Deal";
// Inline image — no network, byte-identical on every run.
const IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#ffcc00"/><circle cx="256" cy="256" r="180" fill="#ff003c"/><circle cx="200" cy="210" r="28" fill="#ffffff"/><circle cx="310" cy="290" r="28" fill="#ffffff"/></svg>`,
)}`;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const pass = (m) => console.log(`  v ${m}`);
const fail = (m, e) => { failures++; console.error(`  x ${m}`, e ? String(e?.message ?? e) : ""); };

// ---------- fixtures ------------------------------------------------------

async function seedFixtures() {
  const { data: cat } = await admin.from("categories").select("slug").limit(1).single();
  if (!cat?.slug) throw new Error("no category available to attach the fixture product to");

  await admin.from("products").upsert(
    {
      slug: PRODUCT_SLUG,
      title: PRODUCT_TITLE,
      description: "Snapshot fixture product.",
      category_slug: cat.slug,
      price_zar: 149,
      image: IMAGE,
      is_active: true,
      sort_order: 9999,
    },
    { onConflict: "slug" },
  );

  const { data: feat } = await admin
    .from("featured_items")
    .insert({ product_slug: PRODUCT_SLUG, placement: "home", sort_order: 0, is_active: true })
    .select("id")
    .single();

  const { data: deal } = await admin
    .from("home_hot_deals")
    .insert({
      title: DEAL_TITLE,
      description: "Two large pizzas, garlic bread, 2L drink",
      image_url: IMAGE,
      original_price: 299,
      discounted_price: 199,
      // Hot-deal cards cycle through a colour palette by index, so pin the
      // fixture to the first slot for a deterministic background colour.
      position: -1,
      is_active: true,
    })
    .select("id")
    .single();

  // Make sure both sections are visible, remembering what to restore.
  const { data: vis } = await admin
    .from("home_section_visibility")
    .select("section, is_visible, zone_id")
    .in("section", ["featured", "hot_deals"])
    .is("zone_id", null);
  const previous = vis ?? [];
  for (const row of previous) {
    if (row.is_visible === false) {
      await admin
        .from("home_section_visibility")
        .update({ is_visible: true })
        .eq("section", row.section)
        .is("zone_id", null);
    }
  }

  return {
    featuredId: feat?.id ?? null,
    dealId: deal?.id ?? null,
    async cleanup() {
      if (feat?.id) await admin.from("featured_items").delete().eq("id", feat.id);
      if (deal?.id) await admin.from("home_hot_deals").delete().eq("id", deal.id);
      await admin.from("products").delete().eq("slug", PRODUCT_SLUG);
      for (const row of previous) {
        if (row.is_visible === false) {
          await admin
            .from("home_section_visibility")
            .update({ is_visible: false })
            .eq("section", row.section)
            .is("zone_id", null);
        }
      }
    },
  };
}

// ---------- snapshot compare ---------------------------------------------

function compare(name, actualBuf) {
  mkdirSync(BASELINE_DIR, { recursive: true });
  const baselinePath = join(BASELINE_DIR, `${name}.png`);

  if (UPDATE || !existsSync(baselinePath)) {
    writeFileSync(baselinePath, actualBuf);
    pass(`${name}: baseline ${UPDATE ? "updated" : "created"} (${baselinePath.replace(HERE + "/", "")})`);
    return;
  }

  const baseline = PNG.sync.read(readFileSync(baselinePath));
  const actual = PNG.sync.read(actualBuf);

  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    writeArtifacts(name, actualBuf, null);
    fail(
      `${name}: size changed ${baseline.width}x${baseline.height} → ${actual.width}x${actual.height} (layout regression)`,
    );
    return;
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const changed = pixelmatch(baseline.data, actual.data, diff.data, baseline.width, baseline.height, {
    threshold: 0.15,
  });
  const pct = (changed / (baseline.width * baseline.height)) * 100;

  if (pct > TOLERANCE_PCT) {
    writeArtifacts(name, actualBuf, PNG.sync.write(diff));
    fail(`${name}: ${pct.toFixed(3)}% pixels differ (tolerance ${TOLERANCE_PCT}%) — see artifacts/visual/`);
  } else {
    pass(`${name}: matches baseline (${pct.toFixed(3)}% diff)`);
  }
}

function writeArtifacts(name, actualBuf, diffBuf) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(join(ARTIFACT_DIR, `${name}.actual.png`), actualBuf);
  if (diffBuf) writeFileSync(join(ARTIFACT_DIR, `${name}.diff.png`), diffBuf);
}

// ---------- main ----------------------------------------------------------

async function main() {
  let fixtures = null;
  let customer = null;
  let browser = null;
  try {
    fixtures = await seedFixtures();
    if (!fixtures.featuredId) fail("could not seed featured fixture");
    if (!fixtures.dealId) fail("could not seed hot-deal fixture");

    customer = await createEphemeralCustomerSession({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      publishableKey: SUPABASE_PUBLISHABLE_KEY,
      projectId: process.env.SUPABASE_PROJECT_ID,
      emailPrefix: "regr-visual",
    });
    const { data: zones } = await admin
      .from("delivery_zones").select("slug").eq("is_active", true).limit(1);
    const zoneSlug = zones?.[0]?.slug ?? null;

    browser = await chromium.launch(headlessArgs());
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce", // Reveal renders in its final state immediately
      colorScheme: "light",
      locale: "en-ZA",
      timezoneId: "Africa/Johannesburg",
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([key, session, zone]) => {
        window.localStorage.setItem(key, JSON.stringify(session));
        if (zone) window.localStorage.setItem("sweet-lovely-zone-v1", zone);
      },
      [customer.storageKey, customer.session, zoneSlug],
    );

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.locator("header").first().waitFor({ state: "visible", timeout: 30000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    // Freeze anything time-based that could bleed into a pixel (caret, spinners).
    await page.addStyleTag({
      content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`,
    });

    const featuredCard = page
      .locator('[data-testid="home-featured"] div.group')
      .filter({ hasText: PRODUCT_TITLE })
      .first();
    const dealCard = page.locator("article").filter({ hasText: DEAL_TITLE }).first();

    for (const [name, locator] of [
      ["home-featured-card", featuredCard],
      ["home-hot-deal-card", dealCard],
    ]) {
      try {
        await locator.waitFor({ state: "visible", timeout: 20000 });
        await locator.scrollIntoViewIfNeeded();
        await page.waitForFunction(
          () => Array.from(document.images).every((img) => img.complete),
          undefined,
          { timeout: 10000 },
        ).catch(() => {});
        await page.evaluate(() => document.fonts?.ready).catch(() => {});
        const buf = await locator.screenshot({ animations: "disabled", caret: "hide" });
        compare(name, buf);
      } catch (e) {
        fail(`${name}: could not capture card`, e);
      }
    }
  } catch (e) {
    fail("top-level failure", e);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (customer) await customer.cleanup().catch(() => {});
    if (fixtures) await fixtures.cleanup().catch(() => {});
  }

  if (failures > 0) {
    console.error(`\n[visual-home-cards] FAIL — ${failures} snapshot check(s) failed`);
    process.exit(1);
  }
  console.log("\n[visual-home-cards] OK — featured and hot-deal cards match their baselines");
}

function headlessArgs() {
  // Disable GPU-dependent rasterisation differences between runs.
  return { headless: true, args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text"] };
}

main().catch((e) => { console.error(e); process.exit(1); });