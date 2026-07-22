#!/usr/bin/env node
// Verifies customer-facing menu surfaces subscribe to products+categories
// realtime, and that those tables are members of supabase_realtime with
// anon SELECT so admin edits reach signed-out visitors.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !ANON) { console.error("Missing SUPABASE env"); process.exit(2); }

let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); failed++; }
};

console.log("Static: subscription wiring");
const home = readFileSync("src/routes/index.tsx", "utf8");
const menu = readFileSync("src/routes/menu.full-menu.tsx", "utf8");
const homeCall = home.match(/useRealtimeInvalidate\(\s*\[([^\]]+)\][\s\S]*?\[\[([^\]]+)\]\]/);
const menuCall = menu.match(/useRealtimeInvalidate\(\s*\[([^\]]+)\][\s\S]*?\[\[([^\]]+)\]\]/);
check("home subscribes to products",   homeCall && /["']products["']/.test(homeCall[1]));
check("home subscribes to categories", homeCall && /["']categories["']/.test(homeCall[1]));
check("home invalidates home-content", homeCall && /home-content/.test(homeCall[2]));
check("menu subscribes to products",   menuCall && /["']products["']/.test(menuCall[1]));
check("menu subscribes to categories", menuCall && /["']categories["']/.test(menuCall[1]));
check("menu invalidates public-menu",  menuCall && /public-menu/.test(menuCall[2]));

console.log("\nRuntime: anon realtime receives product UPDATE");
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const events = [];
const ch = anon.channel("test:products:" + Math.random().toString(36).slice(2, 8))
  .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (p) => events.push(p));
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("subscribe timeout")), 8000);
  ch.subscribe((s) => { if (s === "SUBSCRIBED") { clearTimeout(t); res(); } });
});
check("anon subscription established", true);

// Trigger a no-op UPDATE via service role
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (SVC) {
  const admin = createClient(URL, SVC, { auth: { persistSession: false } });
  const { data: row } = await admin.from("products").select("slug,title").limit(1).maybeSingle();
  if (row) {
    await admin.from("products").update({ title: row.title }).eq("slug", row.slug);
    await new Promise((r) => setTimeout(r, 2500));
    check("anon received products UPDATE broadcast", events.length > 0, `events=${events.length}`);
  } else {
    console.log("  ⚠ skipped broadcast test — no product rows");
  }
} else {
  console.log("  ⚠ skipped broadcast test — no SUPABASE_SERVICE_ROLE_KEY in env");
}
await anon.removeChannel(ch);

console.log(failed === 0 ? "\nPASS" : `\nFAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
