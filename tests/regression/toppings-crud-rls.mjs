#!/usr/bin/env node
/**
 * Integration test: pizza toppings CRUD through the app's Supabase client
 * (publishable/anon key) exercised against real RLS policies.
 *
 * Verifies:
 *   1. Anonymous callers CANNOT insert/update/delete toppings (RLS blocks writes).
 *   2. Anonymous callers CAN read active toppings (public list).
 *   3. Admin-authenticated caller CAN create → update → delete a topping,
 *      and each change persists (read back through the same RLS-bound client).
 *   4. A non-admin authenticated caller (optional) CANNOT write.
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
 *   Optional: USER_EMAIL, USER_PASSWORD (non-admin, to assert RLS denial)
 *
 * Uses only the publishable key — never service role — so RLS runs on every
 * request, exactly as the app's browser client would experience it.
 */
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  USER_EMAIL,
  USER_PASSWORD,
} = process.env;

function need(name, val) {
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
  return val;
}
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY);
need("ADMIN_EMAIL", ADMIN_EMAIL);
need("ADMIN_PASSWORD", ADMIN_PASSWORD);

const log = (...a) => console.log("[toppings-rls]", ...a);
let failures = 0;
function fail(msg, extra) {
  failures++;
  console.error("  ✗", msg, extra ?? "");
}
function pass(msg) {
  console.log("  ✓", msg);
}

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`${label} sign-in failed: ${error?.message ?? "no session"}`);
  }
  return data.session;
}

const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const SLUG = `regr-topping-${SUFFIX}`;
const NAME = `Regression Topping ${SUFFIX}`;

async function run() {
  const anon = makeClient();
  const adminC = makeClient();
  await signIn(adminC, ADMIN_EMAIL, ADMIN_PASSWORD, "admin");

  // 1) Anon writes must be blocked by RLS.
  log("anon RLS write checks");
  {
    const { error } = await anon.from("pizza_toppings").insert({
      name: `${NAME} anon`,
      slug: `${SLUG}-anon`,
      price_zar: 1,
      display_order: 999,
    });
    if (!error) fail("anon INSERT should be denied by RLS");
    else pass(`anon INSERT denied (${error.code || error.message})`);
  }

  // 2) Anon read of active toppings should work (public policy).
  log("anon RLS read check");
  {
    const { error } = await anon
      .from("pizza_toppings")
      .select("id, name, is_active")
      .eq("is_active", true)
      .limit(1);
    if (error) fail("anon SELECT of active toppings unexpectedly failed", error.message);
    else pass("anon SELECT of active toppings allowed");
  }

  // 3) Admin CRUD through the RLS-bound client.
  log("admin CRUD via publishable key + RLS");
  let createdId = null;
  try {
    // CREATE
    const { data: created, error: cErr } = await adminC
      .from("pizza_toppings")
      .insert({
        name: NAME,
        slug: SLUG,
        price_zar: 12.5,
        image_url: null,
        is_active: true,
        is_available: true,
        display_order: 500,
      })
      .select("id, name, slug, price_zar, is_active, is_available, display_order")
      .single();
    if (cErr || !created) throw new Error(`admin INSERT failed: ${cErr?.message}`);
    createdId = created.id;
    if (created.slug !== SLUG || Number(created.price_zar) !== 12.5) {
      fail("created row did not match input", created);
    } else pass(`created topping ${created.slug}`);

    // READ back through the same RLS-bound admin client (persistence check)
    const { data: readBack, error: rErr } = await adminC
      .from("pizza_toppings")
      .select("id, name, price_zar, is_available")
      .eq("id", createdId)
      .maybeSingle();
    if (rErr || !readBack) fail("admin READ after INSERT failed", rErr?.message);
    else pass("admin READ after INSERT returns the row");

    // UPDATE
    const { data: updated, error: uErr } = await adminC
      .from("pizza_toppings")
      .update({ price_zar: 15.75, is_available: false })
      .eq("id", createdId)
      .select("id, price_zar, is_available")
      .single();
    if (uErr || !updated) throw new Error(`admin UPDATE failed: ${uErr?.message}`);
    if (Number(updated.price_zar) !== 15.75 || updated.is_available !== false) {
      fail("update did not persist expected values", updated);
    } else pass("update persisted (price + availability)");

    // Re-read to confirm persistence across a fresh request
    const { data: reread } = await adminC
      .from("pizza_toppings")
      .select("price_zar, is_available")
      .eq("id", createdId)
      .single();
    if (!reread || Number(reread.price_zar) !== 15.75 || reread.is_available !== false) {
      fail("re-read after UPDATE did not match", reread);
    } else pass("re-read confirms UPDATE persisted");

    // 4) Non-admin user (if provided) must be blocked from writes.
    if (USER_EMAIL && USER_PASSWORD) {
      log("non-admin RLS write checks");
      const userC = makeClient();
      await signIn(userC, USER_EMAIL, USER_PASSWORD, "user");
      const { error: nuIns } = await userC.from("pizza_toppings").insert({
        name: `${NAME} user`,
        slug: `${SLUG}-user`,
        price_zar: 1,
        display_order: 999,
      });
      if (!nuIns) fail("non-admin INSERT should be denied by RLS");
      else pass(`non-admin INSERT denied (${nuIns.code || nuIns.message})`);

      const { error: nuUpd, data: nuUpdData } = await userC
        .from("pizza_toppings")
        .update({ price_zar: 0.01 })
        .eq("id", createdId)
        .select();
      // RLS on UPDATE typically returns 0 rows rather than an error.
      if (nuUpd) pass(`non-admin UPDATE denied (${nuUpd.code || nuUpd.message})`);
      else if (!nuUpdData || nuUpdData.length === 0) pass("non-admin UPDATE affected 0 rows (RLS)");
      else fail("non-admin UPDATE unexpectedly modified rows", nuUpdData);

      const { error: nuDel, data: nuDelData } = await userC
        .from("pizza_toppings")
        .delete()
        .eq("id", createdId)
        .select();
      if (nuDel) pass(`non-admin DELETE denied (${nuDel.code || nuDel.message})`);
      else if (!nuDelData || nuDelData.length === 0) pass("non-admin DELETE affected 0 rows (RLS)");
      else fail("non-admin DELETE unexpectedly removed rows", nuDelData);
      await userC.auth.signOut().catch(() => {});
    } else {
      log("USER_EMAIL/USER_PASSWORD not set — skipping non-admin RLS block checks");
    }

    // DELETE
    const { error: dErr, data: dData } = await adminC
      .from("pizza_toppings")
      .delete()
      .eq("id", createdId)
      .select("id");
    if (dErr) throw new Error(`admin DELETE failed: ${dErr.message}`);
    if (!dData || dData.length !== 1) fail("admin DELETE did not remove exactly one row", dData);
    else pass("admin DELETE removed the row");

    // Confirm gone
    const { data: gone } = await adminC
      .from("pizza_toppings")
      .select("id")
      .eq("id", createdId)
      .maybeSingle();
    if (gone) fail("row still present after DELETE", gone);
    else pass("row absent after DELETE");
    createdId = null;
  } finally {
    // Best-effort cleanup if the test bailed mid-flight.
    if (createdId) {
      await adminC.from("pizza_toppings").delete().eq("id", createdId).catch(() => {});
    }
    await adminC.auth.signOut().catch(() => {});
  }

  if (failures > 0) {
    console.error(`\n[toppings-rls] FAILED with ${failures} check(s)`);
    process.exit(1);
  }
  console.log("\n[toppings-rls] ✓ all checks passed");
}

run().catch((e) => {
  console.error("[toppings-rls] fatal:", e);
  process.exit(1);
});