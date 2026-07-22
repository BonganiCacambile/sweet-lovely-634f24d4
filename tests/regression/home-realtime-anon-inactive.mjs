#!/usr/bin/env node
// Verifies anon Realtime subscribers still receive UPDATE events for every
// home_* table when is_active toggles from true → false. This guards against
// a regression where the RLS SELECT policy filters inactive rows and Realtime
// silently drops the event for anon clients.
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

async function runTarget(target) {
  console.log(`\n=== ${target.name.toUpperCase()} (${new URL(target.url).host}) ===`);
  const anon = createClient(target.url, target.anon, { auth: { persistSession: false } });
  const admin = createClient(target.url, target.svc, { auth: { persistSession: false } });
  for (const table of TABLES) {
    console.log(`\n[${target.name}] ${table}: anon receives UPDATE when is_active → false`);
    const events = [];
    let ch, seed;
    try {
      ch = await subscribe(anon, table, events);
      seed = await ensureActiveRow(admin, table);
      const before = events.length;
      const { error } = await admin.from(table).update({ is_active: false }).eq("id", seed.id);
      check(`[${target.name}] admin toggle succeeded`, !error, error?.message);
      await new Promise((r) => setTimeout(r, WAIT_MS));
      const received = events.slice(before).filter((e) => e.eventType === "UPDATE" || e.type === "UPDATE");
      check(`[${target.name}] anon received UPDATE broadcast`, received.length > 0, `events=${events.length - before}`);
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