#!/usr/bin/env node
/**
 * Regression: BULK mixed insert+update payloads for public.product_sizes.
 *
 * Companion to product-sizes-mixed-upsert.mjs, but exercises the realistic
 * admin flow where many rows are saved at once — several new rows (no id)
 * mixed with several existing rows (with id). Verifies:
 *
 *   1. A single .upsert() on the mixed bulk payload still fails with the
 *      NOT NULL / 23502 error (bug remains reproducible).
 *   2. The split strategy used by saveProductSizes (bulk .insert() for new
 *      rows + bulk .upsert() for existing rows) succeeds and EVERY newly
 *      inserted row comes back with a distinct, DB-generated UUID id.
 *   3. Existing rows keep their original ids and receive the new values.
 *   4. Final ordering + count match the intended payload.
 *
 * Env vars: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
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

const log = (...a) => console.log("[product-sizes-bulk-mixed-upsert]", ...a);
let failures = 0;
const fail = (msg, extra) => {
  failures++;
  console.error("  ✗", msg, extra ?? "");
};
const pass = (msg) => console.log("  ✓", msg);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PRODUCT_SLUG = `regr-bulk-sizes-${SUFFIX}`;

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(client) {
  const { data, error } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error || !data.session) throw new Error(`admin sign-in failed: ${error?.message ?? "no session"}`);
}

async function run() {
  const admin = makeClient();
  await signIn(admin);

  log(`creating fixture product ${PRODUCT_SLUG}`);
  {
    const { error } = await admin.from("products").insert({
      slug: PRODUCT_SLUG,
      title: `Regression bulk sizes ${SUFFIX}`,
      category_slug: "bbq",
      price_zar: 100,
      stock: 100,
      is_active: true,
      size_selection_enabled: true,
    });
    if (error) throw new Error(`fixture product insert failed: ${error.message}`);
  }

  const existingIds = [];
  try {
    // Seed 3 existing rows we'll later update in the same bulk operation.
    {
      const seed = [0, 1, 2].map((i) => ({
        product_slug: PRODUCT_SLUG,
        name: `Seed ${i}`,
        price_zar: 10 + i,
        sort_order: i,
        is_available: true,
      }));
      const { data, error } = await admin
        .from("product_sizes")
        .insert(seed)
        .select("id, sort_order")
        .order("sort_order", { ascending: true });
      if (error || !data || data.length !== 3) {
        throw new Error(`seed insert failed: ${error?.message ?? "wrong row count"}`);
      }
      for (const r of data) existingIds.push(r.id);
      pass(`seeded 3 existing sizes`);
    }

    // Bulk mixed payload: 3 updates (with id) + 4 new rows (no id).
    const updates = existingIds.map((id, i) => ({
      id,
      product_slug: PRODUCT_SLUG,
      name: `Updated ${i}`,
      price_zar: 100 + i,
      sort_order: i,
      is_available: true,
    }));
    const inserts = [0, 1, 2, 3].map((i) => ({
      product_slug: PRODUCT_SLUG,
      name: `New ${i}`,
      price_zar: 200 + i,
      sort_order: 3 + i,
      is_available: true,
    }));
    const mixedBulk = [...updates, ...inserts];

    // (A) Reproduce: single .upsert() over the whole mixed payload fails
    // because supabase-js pads new rows with `id: null`.
    log("reproducing bug: single bulk upsert with 3 updates + 4 new rows");
    {
      const { error } = await admin
        .from("product_sizes")
        .upsert(mixedBulk, { onConflict: "id" });
      if (!error) {
        fail("bulk mixed upsert unexpectedly succeeded — bug no longer reproducible; update test");
      } else if (/null value in column "id"/i.test(error.message) || error.code === "23502") {
        pass(`bulk mixed upsert rejected as expected (${error.code || "error"})`);
      } else {
        fail("bulk mixed upsert failed but not with the expected NOT NULL error", error);
      }
    }

    // State must be untouched — still exactly the 3 seed rows.
    {
      const { data: rows } = await admin
        .from("product_sizes")
        .select("id, name, price_zar")
        .eq("product_slug", PRODUCT_SLUG);
      const seedIntact =
        (rows?.length ?? 0) === 3 &&
        rows.every((r) => existingIds.includes(r.id) && r.name.startsWith("Seed "));
      if (!seedIntact) fail("failed bulk upsert left the table in an unexpected state", rows);
      else pass("failed bulk upsert did not mutate seed rows");
    }

    // (B) Apply fix: bulk .insert() for new rows + bulk .upsert() for updates.
    log("applying fix: bulk insert (4 new) + bulk upsert (3 updates)");
    let insertedIds = [];
    {
      const { data: insRows, error: insErr } = await admin
        .from("product_sizes")
        .insert(inserts)
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });
      if (insErr) fail(`bulk insert failed: ${insErr.message}`);
      else if (!insRows || insRows.length !== inserts.length) {
        fail(`bulk insert returned ${insRows?.length ?? 0} rows, expected ${inserts.length}`, insRows);
      } else {
        insertedIds = insRows.map((r) => r.id);
        // Every inserted row must have a well-formed UUID.
        const badId = insRows.find((r) => !UUID_RE.test(r.id));
        if (badId) fail("bulk-inserted row is missing a generated uuid", badId);
        else pass(`all ${insRows.length} bulk-inserted rows received a generated uuid`);

        // Ids must be distinct across the batch and disjoint from existingIds.
        const dupInBatch = new Set(insertedIds).size !== insertedIds.length;
        if (dupInBatch) fail("bulk insert returned duplicate ids", insertedIds);
        else pass("bulk-inserted ids are all distinct");

        const overlaps = insertedIds.filter((id) => existingIds.includes(id));
        if (overlaps.length) fail("bulk-inserted ids collide with existing ids", overlaps);
        else pass("bulk-inserted ids do not collide with pre-existing ids");
      }

      const { error: upErr } = await admin
        .from("product_sizes")
        .upsert(updates, { onConflict: "id" });
      if (upErr) fail(`bulk upsert of 3 updates failed: ${upErr.message}`);
      else pass("bulk upsert of 3 updates succeeded");
    }

    // Final assertions: 7 rows, updates on the original ids, new rows persisted.
    {
      const { data: rows, error } = await admin
        .from("product_sizes")
        .select("id, name, price_zar, sort_order")
        .eq("product_slug", PRODUCT_SLUG)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(`final read failed: ${error.message}`);
      if ((rows?.length ?? 0) !== 7) {
        fail(`expected 7 sizes after fix, got ${rows?.length ?? 0}`, rows);
      } else {
        const updated = rows.slice(0, 3);
        const created = rows.slice(3);
        const updatesOk = updated.every(
          (r, i) =>
            r.id === existingIds[i] &&
            r.name === `Updated ${i}` &&
            Number(r.price_zar) === 100 + i,
        );
        if (!updatesOk) fail("existing rows were not updated in place", updated);
        else pass("all 3 existing rows updated in place with original ids");

        const createdOk = created.every(
          (r, i) =>
            UUID_RE.test(r.id) &&
            !existingIds.includes(r.id) &&
            r.name === `New ${i}` &&
            Number(r.price_zar) === 200 + i,
        );
        if (!createdOk) fail("new rows did not persist with generated ids", created);
        else pass("all 4 new rows persisted with distinct generated uuids");
      }
    }
  } finally {
    await admin.from("products").delete().eq("slug", PRODUCT_SLUG).catch(() => {});
    await admin.auth.signOut().catch(() => {});
  }

  if (failures > 0) {
    console.error(`\n[product-sizes-bulk-mixed-upsert] FAILED with ${failures} check(s)`);
    process.exit(1);
  }
  console.log("\n[product-sizes-bulk-mixed-upsert] ✓ all checks passed");
}

run().catch((e) => {
  console.error("[product-sizes-bulk-mixed-upsert] fatal:", e);
  process.exit(1);
});