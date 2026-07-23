#!/usr/bin/env node
/**
 * Regression: mixed insert+update payloads for public.product_sizes.
 *
 * Reproduces the "null value in column \"id\" of relation product_sizes
 * violates not-null constraint" bug and verifies the fix strategy used by
 * src/lib/admin/product-sizes.functions.ts (`saveProductSizes`): rows
 * without an id go through .insert(), rows with an id go through .upsert()
 * — never mixed in a single upsert call.
 *
 * Why: supabase-js pads a mixed upsert payload with the union of keys, so
 * new rows are sent with `id: null` and the DB rejects them even though
 * the column defaults to gen_random_uuid().
 *
 * Env vars: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
 * Uses only the publishable key — RLS runs on every request.
 */
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
function need(name, val) {
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
}
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY);
need("ADMIN_EMAIL", ADMIN_EMAIL);
need("ADMIN_PASSWORD", ADMIN_PASSWORD);

const log = (...a) => console.log("[product-sizes-mixed-upsert]", ...a);
let failures = 0;
const fail = (msg, extra) => {
  failures++;
  console.error("  ✗", msg, extra ?? "");
};
const pass = (msg) => console.log("  ✓", msg);

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PRODUCT_SLUG = `regr-sizes-${SUFFIX}`;

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`${label} sign-in failed: ${error?.message ?? "no session"}`);
}

async function run() {
  const admin = makeClient();
  await signIn(admin, ADMIN_EMAIL, ADMIN_PASSWORD, "admin");

  // Fixture: temp product with size selection enabled.
  log(`creating fixture product ${PRODUCT_SLUG}`);
  {
    const { error } = await admin.from("products").insert({
      slug: PRODUCT_SLUG,
      title: `Regression sizes ${SUFFIX}`,
      category_slug: "bbq",
      price_zar: 100,
      stock: 100,
      is_active: true,
      size_selection_enabled: true,
    });
    if (error) throw new Error(`fixture product insert failed: ${error.message}`);
  }

  let existingId = null;
  try {
    // Seed one row so we have an existing id to mix with a new-row payload.
    const { data: seeded, error: seedErr } = await admin
      .from("product_sizes")
      .insert({
        product_slug: PRODUCT_SLUG,
        name: "Small",
        price_zar: 50,
        sort_order: 0,
        is_available: true,
      })
      .select("id")
      .single();
    if (seedErr || !seeded) throw new Error(`seed size insert failed: ${seedErr?.message}`);
    existingId = seeded.id;
    pass(`seeded existing size ${existingId}`);

    // (A) Reproduce the bug: single upsert with a mixed payload where the
    // new row has no id. supabase-js pads it with `id: null` → NOT NULL error.
    log("reproducing bug: mixed upsert with one row missing id");
    {
      const mixed = [
        {
          id: existingId,
          product_slug: PRODUCT_SLUG,
          name: "Small (updated)",
          price_zar: 55,
          sort_order: 0,
          is_available: true,
        },
        {
          product_slug: PRODUCT_SLUG,
          name: "Large",
          price_zar: 120,
          sort_order: 1,
          is_available: true,
        },
      ];
      const { error } = await admin
        .from("product_sizes")
        .upsert(mixed, { onConflict: "id" });
      if (!error) {
        fail("mixed upsert unexpectedly succeeded — bug is no longer reproducible; update the test");
      } else if (/null value in column "id"/i.test(error.message) || error.code === "23502") {
        pass(`mixed upsert rejected as expected (${error.code || "error"})`);
      } else {
        fail("mixed upsert failed but not with the expected NOT NULL error", error);
      }
    }

    // Verify state was not partially mutated by the failed upsert.
    {
      const { data: rows } = await admin
        .from("product_sizes")
        .select("id, name, price_zar")
        .eq("product_slug", PRODUCT_SLUG);
      if ((rows?.length ?? 0) !== 1 || rows[0].id !== existingId || Number(rows[0].price_zar) !== 50) {
        fail("failed upsert left the table in an unexpected state", rows);
      } else {
        pass("failed upsert did not mutate existing rows");
      }
    }

    // (B) Apply the fix: split into .insert() (no id) + .upsert() (with id).
    log("applying fix: separate insert + upsert");
    let insertedId = null;
    {
      const toInsert = [
        {
          product_slug: PRODUCT_SLUG,
          name: "Large",
          price_zar: 120,
          sort_order: 1,
          is_available: true,
        },
      ];
      const toUpdate = [
        {
          id: existingId,
          product_slug: PRODUCT_SLUG,
          name: "Small (updated)",
          price_zar: 55,
          sort_order: 0,
          is_available: true,
        },
      ];
      const { data: insRows, error: insErr } = await admin
        .from("product_sizes")
        .insert(toInsert)
        .select("id, name");
      if (insErr) fail(`insert of new size failed: ${insErr.message}`);
      else if (!insRows || insRows.length !== 1) fail("insert did not return exactly one row", insRows);
      else if (!UUID_RE.test(insRows[0].id)) fail("inserted row missing generated uuid", insRows[0]);
      else {
        insertedId = insRows[0].id;
        pass(`insert generated id ${insertedId}`);
      }

      const { error: upErr } = await admin
        .from("product_sizes")
        .upsert(toUpdate, { onConflict: "id" });
      if (upErr) fail(`upsert of existing size failed: ${upErr.message}`);
      else pass("upsert of existing size succeeded");
    }

    // Final state: two rows, both readable, new row has a real uuid and the
    // update landed on the existing row.
    {
      const { data: rows, error } = await admin
        .from("product_sizes")
        .select("id, name, price_zar, sort_order")
        .eq("product_slug", PRODUCT_SLUG)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(`final read failed: ${error.message}`);
      if ((rows?.length ?? 0) !== 2) fail("expected exactly 2 sizes after fix", rows);
      else {
        const [small, large] = rows;
        if (small.id !== existingId) fail("existing row id changed unexpectedly", small);
        else if (small.name !== "Small (updated)" || Number(small.price_zar) !== 55) {
          fail("existing row was not updated", small);
        } else pass("existing row updated in place");

        if (!UUID_RE.test(large.id)) fail("new row missing generated uuid", large);
        else if (large.id === existingId) fail("new row reused existing id", large);
        else if (large.name !== "Large" || Number(large.price_zar) !== 120) {
          fail("new row values did not persist", large);
        } else pass(`new row persisted with generated id ${large.id}`);
      }
    }
  } finally {
    // Cleanup — ON DELETE CASCADE on product_sizes removes children.
    await admin.from("products").delete().eq("slug", PRODUCT_SLUG).catch(() => {});
    await admin.auth.signOut().catch(() => {});
  }

  if (failures > 0) {
    console.error(`\n[product-sizes-mixed-upsert] FAILED with ${failures} check(s)`);
    process.exit(1);
  }
  console.log("\n[product-sizes-mixed-upsert] ✓ all checks passed");
}

run().catch((e) => {
  console.error("[product-sizes-mixed-upsert] fatal:", e);
  process.exit(1);
});