#!/usr/bin/env node
/**
 * Regression: TWO overlapping mixed bulk upserts against the same
 * product_sizes rows, run concurrently.
 *
 * Companion to product-sizes-mixed-upsert.mjs and
 * product-sizes-bulk-mixed-upsert.mjs. Verifies that the split strategy
 * used by saveProductSizes (bulk .insert() for new rows + bulk .upsert()
 * for existing rows) is safe under concurrent admin edits against the
 * same product, and specifically that:
 *
 *   1. Neither worker throws the NOT NULL / 23502 error on `id`.
 *   2. Every newly inserted row (from either worker) receives a distinct,
 *      DB-generated UUID — no collisions across workers, no `null` ids.
 *   3. No pre-existing id is dropped or duplicated by the concurrent
 *      updates — every seed row survives with its original id.
 *   4. The final row set contains exactly the union of (seed rows
 *      updated in place) + (new inserts from worker A) + (new inserts
 *      from worker B).
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

const log = (...a) => console.log("[product-sizes-concurrent-mixed-upsert]", ...a);
let failures = 0;
const fail = (msg, extra) => {
  failures++;
  console.error("  ✗", msg, extra ?? "");
};
const pass = (msg) => console.log("  ✓", msg);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PRODUCT_SLUG = `regr-concurrent-sizes-${SUFFIX}`;

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
  if (error || !data.session) {
    throw new Error(`admin sign-in failed: ${error?.message ?? "no session"}`);
  }
}

/**
 * Mirrors the split strategy in src/lib/admin/product-sizes.functions.ts:
 *   - rows without an id → bulk .insert()
 *   - rows with an id    → bulk .upsert() onConflict "id"
 * Returns { insertedIds, error? } for assertions.
 */
async function saveSizesSplit(client, rows) {
  const toInsert = rows.filter((r) => !r.id);
  const toUpdate = rows.filter((r) => !!r.id);
  let insertedIds = [];

  if (toInsert.length > 0) {
    const { data, error } = await client
      .from("product_sizes")
      .insert(toInsert)
      .select("id, name");
    if (error) return { insertedIds, error };
    insertedIds = (data ?? []).map((r) => r.id);
  }
  if (toUpdate.length > 0) {
    const { error } = await client
      .from("product_sizes")
      .upsert(toUpdate, { onConflict: "id" });
    if (error) return { insertedIds, error };
  }
  return { insertedIds };
}

async function run() {
  const admin = makeClient();
  await signIn(admin);

  log(`creating fixture product ${PRODUCT_SLUG}`);
  {
    const { error } = await admin.from("products").insert({
      slug: PRODUCT_SLUG,
      title: `Regression concurrent sizes ${SUFFIX}`,
      category_slug: "bbq",
      price_zar: 100,
      stock: 100,
      is_active: true,
      size_selection_enabled: true,
    });
    if (error) throw new Error(`fixture product insert failed: ${error.message}`);
  }

  const seedIds = [];
  try {
    // Seed 4 existing rows both workers will target.
    {
      const seed = [0, 1, 2, 3].map((i) => ({
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
      if (error || !data || data.length !== 4) {
        throw new Error(`seed insert failed: ${error?.message ?? "wrong row count"}`);
      }
      for (const r of data) seedIds.push(r.id);
      pass(`seeded 4 existing sizes`);
    }

    // Second admin session (separate client) so the two workers use
    // independent supabase-js instances and PostgREST connections.
    const admin2 = makeClient();
    await signIn(admin2);

    // Worker A: update seeds 0 & 1, insert 3 new rows.
    const workerA = [
      {
        id: seedIds[0],
        product_slug: PRODUCT_SLUG,
        name: `A-updated 0`,
        price_zar: 500,
        sort_order: 0,
        is_available: true,
      },
      {
        id: seedIds[1],
        product_slug: PRODUCT_SLUG,
        name: `A-updated 1`,
        price_zar: 501,
        sort_order: 1,
        is_available: true,
      },
      ...[0, 1, 2].map((i) => ({
        product_slug: PRODUCT_SLUG,
        name: `A-new ${i}`,
        price_zar: 600 + i,
        sort_order: 10 + i,
        is_available: true,
      })),
    ];

    // Worker B: update seeds 2 & 3 (disjoint from A) + also update seed 0
    // (overlap w/ A to force real contention), insert 3 new rows.
    const workerB = [
      {
        id: seedIds[2],
        product_slug: PRODUCT_SLUG,
        name: `B-updated 2`,
        price_zar: 700,
        sort_order: 2,
        is_available: true,
      },
      {
        id: seedIds[3],
        product_slug: PRODUCT_SLUG,
        name: `B-updated 3`,
        price_zar: 701,
        sort_order: 3,
        is_available: true,
      },
      {
        id: seedIds[0],
        product_slug: PRODUCT_SLUG,
        name: `B-updated 0`,
        price_zar: 999,
        sort_order: 0,
        is_available: true,
      },
      ...[0, 1, 2].map((i) => ({
        product_slug: PRODUCT_SLUG,
        name: `B-new ${i}`,
        price_zar: 800 + i,
        sort_order: 20 + i,
        is_available: true,
      })),
    ];

    log("running two overlapping mixed bulk upserts concurrently");
    const [resA, resB] = await Promise.all([
      saveSizesSplit(admin, workerA),
      saveSizesSplit(admin2, workerB),
    ]);

    // (1) Neither worker hit the NOT NULL / 23502 bug (nor any other error).
    for (const [label, res] of [
      ["worker A", resA],
      ["worker B", resB],
    ]) {
      if (res.error) {
        if (
          /null value in column "id"/i.test(res.error.message) ||
          res.error.code === "23502"
        ) {
          fail(`${label} regressed to the NOT NULL id bug`, res.error);
        } else {
          fail(`${label} failed with unexpected error`, res.error);
        }
      } else {
        pass(`${label} completed without NOT NULL / other errors`);
      }
    }

    // (2) Every inserted id is a distinct, well-formed UUID across BOTH workers.
    const allInserted = [...resA.insertedIds, ...resB.insertedIds];
    const badId = allInserted.find((id) => !UUID_RE.test(id));
    if (badId !== undefined) {
      fail("some concurrently-inserted row has a malformed / null id", { badId, allInserted });
    } else {
      pass(`all ${allInserted.length} concurrently-inserted ids are well-formed uuids`);
    }
    const insertedSet = new Set(allInserted);
    if (insertedSet.size !== allInserted.length) {
      fail("concurrently-inserted ids collided across workers", allInserted);
    } else {
      pass("concurrently-inserted ids are pairwise distinct across workers");
    }
    const collideWithSeed = allInserted.filter((id) => seedIds.includes(id));
    if (collideWithSeed.length) {
      fail("concurrently-inserted ids collided with pre-existing seed ids", collideWithSeed);
    } else {
      pass("concurrently-inserted ids do not collide with seed ids");
    }

    // (3) & (4) Final state: seeds preserved 1:1, plus 6 new rows.
    const { data: finalRows, error: readErr } = await admin
      .from("product_sizes")
      .select("id, name, price_zar, sort_order")
      .eq("product_slug", PRODUCT_SLUG)
      .order("sort_order", { ascending: true });
    if (readErr) throw new Error(`final read failed: ${readErr.message}`);

    const finalIds = (finalRows ?? []).map((r) => r.id);
    // No duplicates in the final set at all.
    if (new Set(finalIds).size !== finalIds.length) {
      fail("final row set contains duplicate ids", finalIds);
    } else {
      pass("final row set has no duplicate ids");
    }
    // Every seed id must still exist exactly once.
    const missingSeeds = seedIds.filter((id) => !finalIds.includes(id));
    if (missingSeeds.length) {
      fail("some seed rows disappeared after concurrent upserts", missingSeeds);
    } else {
      pass("all 4 seed ids survived concurrent upserts");
    }
    // Every inserted id must be present in the final set.
    const missingInserts = allInserted.filter((id) => !finalIds.includes(id));
    if (missingInserts.length) {
      fail("some concurrently-inserted ids are missing from the final read", missingInserts);
    } else {
      pass("all concurrently-inserted ids are present in the final read");
    }
    // Row-count sanity: 4 seeds + 3 A-new + 3 B-new = 10 rows.
    const expectedCount = seedIds.length + resA.insertedIds.length + resB.insertedIds.length;
    if ((finalRows?.length ?? 0) !== expectedCount) {
      fail(`expected ${expectedCount} rows after concurrent upserts, got ${finalRows?.length ?? 0}`, finalRows);
    } else {
      pass(`final row count matches expected total (${expectedCount})`);
    }

    // The overlap-updated seed (seedIds[0]) must land on one of the two
    // writers' values — never a partial merge or the original seed value.
    const overlapRow = (finalRows ?? []).find((r) => r.id === seedIds[0]);
    if (!overlapRow) {
      fail("overlap seed row is missing entirely", seedIds[0]);
    } else {
      const priceOk = Number(overlapRow.price_zar) === 500 || Number(overlapRow.price_zar) === 999;
      const nameOk = overlapRow.name === "A-updated 0" || overlapRow.name === "B-updated 0";
      if (!priceOk || !nameOk) {
        fail("overlap seed row was not cleanly overwritten by one of the workers", overlapRow);
      } else {
        pass(`overlap seed row cleanly overwritten by ${overlapRow.name}`);
      }
    }

    await admin2.auth.signOut().catch(() => {});
  } finally {
    await admin.from("products").delete().eq("slug", PRODUCT_SLUG).catch(() => {});
    await admin.auth.signOut().catch(() => {});
  }

  if (failures > 0) {
    console.error(`\n[product-sizes-concurrent-mixed-upsert] FAILED with ${failures} check(s)`);
    process.exit(1);
  }
  console.log("\n[product-sizes-concurrent-mixed-upsert] ✓ all checks passed");
}

run().catch((e) => {
  console.error("[product-sizes-concurrent-mixed-upsert] fatal:", e);
  process.exit(1);
});