#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

// Verifies the SECURE storefront-refresh contract for home content.
//
// When an admin flips a home_* row from is_active true → false, the anon RLS
// SELECT policy stops matching the row, so Postgres correctly withholds the
// UPDATE from anonymous Realtime subscribers. That is expected behaviour and
// must NOT be "fixed" by relaxing RLS. Instead the storefront detects the
// change via a cheap anon-visible fingerprint and offers a manual refresh.
//
// Per table this asserts:
//   1. anon can see the row while it is active,
//   2. anon does NOT receive the hidden UPDATE broadcast (RLS enforced),
//   3. the anon-visible fingerprint changes → "new content available",
//   4. re-reading (Refresh) returns only active rows; the inactive row is gone.
//
// Runs against every configured environment so RLS/publication drift between
// preview and production is caught. Targets are picked from env vars:
//
//   Preview  (default fallback: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY):
//     PREVIEW_SUPABASE_URL, PREVIEW_SUPABASE_PUBLISHABLE_KEY, PREVIEW_SUPABASE_SERVICE_ROLE_KEY
//   Production:
//     PROD_SUPABASE_URL,    PROD_SUPABASE_PUBLISHABLE_KEY,    PROD_SUPABASE_SERVICE_ROLE_KEY
//
// An environment is skipped if its URL/keys are absent. At least one must be
// configured or the test exits with code 2.
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "home_popular_items",
  "home_hot_deals",
  "home_specials",
  "home_banners",
  "home_desserts",
];
const WAIT_MS = 6000;

function resolveTargets() {
  const targets = [];
  const preview = {
    name: "preview",
    url: process.env.PREVIEW_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    anon: process.env.PREVIEW_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
    svc: process.env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const prod = {
    name: "production",
    url: process.env.PROD_SUPABASE_URL,
    anon: process.env.PROD_SUPABASE_PUBLISHABLE_KEY,
    svc: process.env.PROD_SUPABASE_SERVICE_ROLE_KEY,
  };
  for (const t of [preview, prod]) {
    if (t.url && t.anon && t.svc) targets.push(t);
    else console.log(`⚠ skipping ${t.name} — missing URL/PUBLISHABLE_KEY/SERVICE_ROLE_KEY`);
  }
  if (targets.length === 0) {
    console.error("No Supabase targets configured. Set PREVIEW_* and/or PROD_* env vars.");
    process.exit(2);
  }
  // Warn if preview and prod resolve to the same project — likely a misconfig.
  if (targets.length > 1 && targets[0].url === targets[1].url) {
    console.log(`⚠ preview and production URLs are identical — check env vars`);
  }
  return targets;
}

let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); failed++; }
};

async function subscribe(anon, table, events) {
  const ch = anon
    .channel(`test:${table}:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, (p) => events.push(p));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`subscribe timeout on ${table}`)), 8000);
    ch.subscribe((s) => { if (s === "SUBSCRIBED") { clearTimeout(t); res(); } });
  });
  return ch;
}

async function ensureActiveRow(admin, table) {
  const { data } = await admin.from(table).select("id,is_active").eq("is_active", true).limit(1).maybeSingle();
  if (data) return { id: data.id, cleanup: async () => {} };
  // Seed a minimal row; use only guaranteed columns (id, is_active). Others use defaults.
  const payload = { is_active: true, title: `RT-seed-${Date.now()}` };
  const { data: ins, error } = await admin
    .from(table)
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(`seed ${table}: ${error.message}`);
  return { id: ins.id, cleanup: async () => { await admin.from(table).delete().eq("id", ins.id); } };
}

async function fingerprint(anon, table) {
  const { data } = await anon.from(table).select("id").order("id");
  return (data ?? []).map((r) => r.id).join(",");
}

async function runTarget(target) {
  console.log(`\n=== ${target.name.toUpperCase()} (${new URL(target.url).host}) ===`);
  const anon = createClient(target.url, target.anon, { auth: { persistSession: false } });
  const admin = createClient(target.url, target.svc, { auth: { persistSession: false } });
  for (const table of TABLES) {
    console.log(`\n[${target.name}] ${table}: RLS hides deactivated row; refresh signal fires`);
    const events = [];
    let ch, seed;
    try {
      ch = await subscribe(anon, table, events);
      seed = await ensureActiveRow(admin, table);
      const fpBefore = await fingerprint(anon, table);
      check(
        `[${target.name}] anon sees the row while active`,
        fpBefore.split(",").includes(seed.id),
      );
      const before = events.length;
      const { error } = await admin.from(table).update({ is_active: false }).eq("id", seed.id);
      check(`[${target.name}] admin toggle succeeded`, !error, error?.message);
      await new Promise((r) => setTimeout(r, WAIT_MS));
      const received = events.slice(before).filter((e) => e.eventType === "UPDATE" || e.type === "UPDATE");
      check(
        `[${target.name}] anon did NOT receive the hidden UPDATE (RLS enforced)`,
        received.length === 0,
        `unexpected events=${received.length}`,
      );

      // Storefront signal: the anon-visible fingerprint must change so the
      // "New menu updates are available" banner can appear.
      const fpAfter = await fingerprint(anon, table);
      check(`[${target.name}] anon fingerprint changed → refresh prompt`, fpAfter !== fpBefore);

      // Refresh: re-reading returns only active rows, without the hidden one.
      const { data: rows } = await anon.from(table).select("id, is_active");
      check(
        `[${target.name}] inactive row hidden after refresh`,
        !(rows ?? []).some((r) => r.id === seed.id),
      );
      check(
        `[${target.name}] only active rows visible to anon`,
        (rows ?? []).every((r) => r.is_active !== false),
      );
      await admin.from(table).update({ is_active: true }).eq("id", seed.id);
    } catch (e) {
      check(`[${target.name}] no error`, false, e.message);
    } finally {
      if (ch) await anon.removeChannel(ch);
      if (seed) await seed.cleanup();
    }
  }
}

for (const target of resolveTargets()) {
  await runTarget(target);
}

console.log(failed === 0 ? "\nPASS" : `\nFAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);