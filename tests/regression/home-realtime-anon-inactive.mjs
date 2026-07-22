#!/usr/bin/env node
// Verifies anon Realtime subscribers still receive UPDATE events for every
// home_* table when is_active toggles from true → false. This guards against
// a regression where the RLS SELECT policy filters inactive rows and Realtime
// silently drops the event for anon clients.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SVC) {
  console.error("Missing SUPABASE env (URL, PUBLISHABLE_KEY, SERVICE_ROLE_KEY)");
  process.exit(2);
}

const TABLES = [
  "home_popular_items",
  "home_hot_deals",
  "home_specials",
  "home_banners",
  "home_desserts",
];
const WAIT_MS = 6000;

let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); failed++; }
};

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const admin = createClient(URL, SVC, { auth: { persistSession: false } });

async function subscribe(table, events) {
  const ch = anon
    .channel(`test:${table}:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, (p) => events.push(p));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`subscribe timeout on ${table}`)), 8000);
    ch.subscribe((s) => { if (s === "SUBSCRIBED") { clearTimeout(t); res(); } });
  });
  return ch;
}

async function ensureActiveRow(table) {
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

for (const table of TABLES) {
  console.log(`\n${table}: anon receives UPDATE when is_active → false`);
  const events = [];
  let ch, seed;
  try {
    ch = await subscribe(table, events);
    seed = await ensureActiveRow(table);
    const before = events.length;
    const { error } = await admin.from(table).update({ is_active: false }).eq("id", seed.id);
    check(`admin toggle succeeded`, !error, error?.message);
    await new Promise((r) => setTimeout(r, WAIT_MS));
    const received = events.slice(before).filter((e) => e.eventType === "UPDATE" || e.type === "UPDATE");
    check(`anon received UPDATE broadcast`, received.length > 0, `events=${events.length - before}`);
    // Restore
    await admin.from(table).update({ is_active: true }).eq("id", seed.id);
  } catch (e) {
    check(`no error`, false, e.message);
  } finally {
    if (ch) await anon.removeChannel(ch);
    if (seed) await seed.cleanup();
  }
}

console.log(failed === 0 ? "\nPASS" : `\nFAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);