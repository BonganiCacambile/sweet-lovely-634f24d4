#!/usr/bin/env node
/**
 * Regression: saved order_items must preserve the selected product size in
 * `title_snapshot` so kitchen/fulfilment staff can distinguish sized variants
 * (e.g. "Rib Platter — Half" vs "Rib Platter — Full").
 *
 * Original bug: verifyAndCreateOrder wrote `title_snapshot: product.title`
 * (base title only) — two different sizes of the same product produced
 * identical order_items rows.
 *
 * Coverage:
 *   1. Source-level guard — `src/lib/paystack.functions.ts` still composes
 *      `${base} — ${sizeName}` when a sizeId resolves. Catches accidental
 *      removal of the concatenation.
 *   2. DB integration — replays the server-side price/title resolution
 *      against fixture rows (products + product_sizes) using the same
 *      `splitVariantId` parser and the same lookup shape as
 *      verifyAndCreateOrder, then writes an order + order_items via the
 *      service role and asserts each row's `title_snapshot` includes the
 *      selected size name and each unit price matches the size price.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

// Inlined from src/lib/cart-id.ts to keep this test runnable under plain node
// (no TS loader). Must stay in sync with splitVariantId there.
const PIZZA_SUFFIXES = ["medium", "large"];
function splitPizzaId(id) {
  const xIdx = id.indexOf("-x-");
  const base = xIdx >= 0 ? id.slice(0, xIdx) : id;
  for (const suffix of PIZZA_SUFFIXES) {
    if (base.endsWith(`-${suffix}`)) {
      return { slug: base.slice(0, -(suffix.length + 1)), size: suffix };
    }
  }
  return { slug: base, size: null };
}
function splitVariantId(id) {
  const szIdx = id.indexOf("--sz-");
  if (szIdx >= 0) {
    return { slug: id.slice(0, szIdx), size: null, sizeId: id.slice(szIdx + 5) };
  }
  const { slug, size } = splitPizzaId(id);
  return { slug, size, sizeId: null };
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
function need(name, val) {
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
}
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const pass = (m) => console.log("  ✓", m);
const fail = (m, extra) => {
  failures++;
  console.error("  ✗", m, extra ?? "");
};

const SUFFIX = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const PRODUCT_SLUG = `regr-size-snap-${SUFFIX}`;
const REFERENCE = `REGR-SIZE-SNAP-${SUFFIX}`;

async function checkSource() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = await readFile(
    path.resolve(here, "../../src/lib/paystack.functions.ts"),
    "utf8",
  );
  // Look for the "${base} — ${sizeName}" composition that persists the size
  // name into title_snapshot. If someone deletes/renames this we want to know.
  const hasComposition =
    /sizeName\s*\?\s*`\$\{base\}\s*—\s*\$\{sizeName\}`/.test(src);
  if (!hasComposition) {
    fail(
      "src/lib/paystack.functions.ts no longer composes `${base} — ${sizeName}` for title_snapshot",
    );
  } else {
    pass("source still concatenates size name into title_snapshot");
  }
}

async function pickZone() {
  const { data, error } = await admin
    .from("delivery_zones")
    .select("id, name, fee_zar")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error(`No active delivery zone: ${error?.message ?? "none"}`);
  return data;
}

/**
 * Mirror of verifyAndCreateOrder's title/price resolution for a single item.
 * If this diverges from the server function, tests must be updated together.
 */
function resolvePriced(item, productMap, sizeMap) {
  const parsed = { ...item, ...splitVariantId(item.id) };
  const product = productMap.get(parsed.slug);
  let basePrice;
  if (parsed.sizeId) {
    const sz = sizeMap.get(parsed.sizeId);
    basePrice = sz ? Number(sz.price_zar) : Math.max(0, Number(parsed.price) || 0);
  } else if (product) {
    basePrice = Number(product.price_zar);
  } else {
    basePrice = Math.max(0, Number(parsed.price) || 0);
  }
  const unitPrice = Number(basePrice.toFixed(2));
  const lineTotal = Number((unitPrice * parsed.quantity).toFixed(2));
  const base = product?.title ?? parsed.title;
  const sizeName = parsed.sizeId ? sizeMap.get(parsed.sizeId)?.name : null;
  const title = sizeName ? `${base} — ${sizeName}` : base;
  return { slug: product ? parsed.slug : null, title, unitPrice, lineTotal, quantity: parsed.quantity };
}

async function checkPersistence() {
  // Fixture: product with size selection enabled + two sizes.
  const { error: pErr } = await admin.from("products").insert({
    slug: PRODUCT_SLUG,
    title: `Rib Platter ${SUFFIX}`,
    category_slug: "bbq",
    price_zar: 100,
    stock: 100,
    is_active: true,
    size_selection_enabled: true,
  });
  if (pErr) throw new Error(`fixture product failed: ${pErr.message}`);

  const { data: sizes, error: sErr } = await admin
    .from("product_sizes")
    .insert([
      { product_slug: PRODUCT_SLUG, name: "Half", price_zar: 149, sort_order: 0, is_available: true },
      { product_slug: PRODUCT_SLUG, name: "Full", price_zar: 249, sort_order: 1, is_available: true },
    ])
    .select("id, name, price_zar, product_slug");
  if (sErr || !sizes || sizes.length !== 2) throw new Error(`fixture sizes failed: ${sErr?.message}`);
  const halfId = sizes.find((s) => s.name === "Half").id;
  const fullId = sizes.find((s) => s.name === "Full").id;

  // Simulate cart with the same id format the client uses: `${slug}--sz-${sizeId}`.
  const cartItems = [
    { id: `${PRODUCT_SLUG}--sz-${halfId}`, title: "cart-supplied (should be overwritten)", price: 0, quantity: 1 },
    { id: `${PRODUCT_SLUG}--sz-${fullId}`, title: "cart-supplied (should be overwritten)", price: 0, quantity: 2 },
  ];

  // Reproduce the exact lookup shape verifyAndCreateOrder performs.
  const slugs = Array.from(new Set(cartItems.map((c) => splitVariantId(c.id).slug)));
  const sizeIds = Array.from(
    new Set(cartItems.map((c) => splitVariantId(c.id).sizeId).filter(Boolean)),
  );
  const { data: products } = await admin
    .from("products")
    .select("slug, price_zar, price_medium_zar, price_large_zar, title, is_active")
    .in("slug", slugs);
  const { data: dbSizes } = await admin
    .from("product_sizes")
    .select("id, name, price_zar, product_slug")
    .in("id", sizeIds);
  const productMap = new Map((products ?? []).map((p) => [p.slug, p]));
  const sizeMap = new Map((dbSizes ?? []).map((s) => [s.id, s]));

  const priced = cartItems.map((c) => resolvePriced(c, productMap, sizeMap));

  // Persist order + order_items exactly as verifyAndCreateOrder does.
  const zone = await pickZone();
  const subtotal = Number(priced.reduce((s, p) => s + p.lineTotal, 0).toFixed(2));
  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      user_id: null,
      status: "pending",
      customer_name: "Regression Size Snap",
      customer_email: `regr-${SUFFIX}@example.test`,
      customer_phone: "0000000000",
      address: "Test",
      subtotal_zar: subtotal,
      delivery_zar: Number(zone.fee_zar),
      total_zar: Number((subtotal + Number(zone.fee_zar)).toFixed(2)),
      paystack_reference: REFERENCE,
      delivery_zone_id: zone.id,
      delivery_zone_name: zone.name,
      fulfillment_method: "delivery",
      estimated_minutes: 30,
    })
    .select("id")
    .single();
  if (oErr || !order) throw new Error(`order insert failed: ${oErr?.message}`);

  const { error: iErr } = await admin.from("order_items").insert(
    priced.map((p) => ({
      order_id: order.id,
      product_slug: p.slug,
      title_snapshot: p.title,
      quantity: p.quantity,
      unit_price_zar: p.unitPrice,
      line_total_zar: p.lineTotal,
      extras: [],
      extras_total_zar: 0,
    })),
  );
  if (iErr) throw new Error(`order_items insert failed: ${iErr.message}`);

  const { data: rows } = await admin
    .from("order_items")
    .select("title_snapshot, quantity, unit_price_zar")
    .eq("order_id", order.id)
    .order("unit_price_zar", { ascending: true });

  if (!rows || rows.length !== 2) {
    fail(`expected 2 order_items, got ${rows?.length ?? 0}`);
    return { orderId: order.id };
  }

  const [half, full] = rows;
  const baseTitle = `Rib Platter ${SUFFIX}`;
  const expectHalf = `${baseTitle} — Half`;
  const expectFull = `${baseTitle} — Full`;

  if (half.title_snapshot === expectHalf) pass(`Half row title_snapshot = "${expectHalf}"`);
  else fail(`Half row title_snapshot missing size`, half);
  if (Number(half.unit_price_zar) === 149) pass("Half row unit price = 149");
  else fail("Half unit price wrong", half);

  if (full.title_snapshot === expectFull) pass(`Full row title_snapshot = "${expectFull}"`);
  else fail(`Full row title_snapshot missing size`, full);
  if (Number(full.unit_price_zar) === 249) pass("Full row unit price = 249");
  else fail("Full unit price wrong", full);

  // Guard against the original bug: the two rows must not be indistinguishable
  // on title alone.
  if (half.title_snapshot === full.title_snapshot) {
    fail("both size rows share the same title_snapshot — original bug reintroduced");
  } else {
    pass("Half and Full rows have distinct title_snapshot values");
  }

  return { orderId: order.id };
}

async function run() {
  console.log("[order-item-size-title-snapshot] starting");
  await checkSource();
  let orderId = null;
  try {
    ({ orderId } = await checkPersistence());
  } finally {
    if (orderId) {
      try { await admin.from("order_items").delete().eq("order_id", orderId); } catch {}
      try { await admin.from("orders").delete().eq("id", orderId); } catch {}
    }
    try { await admin.from("products").delete().eq("slug", PRODUCT_SLUG); } catch {}
  }

  if (failures > 0) {
    console.error(`\n[order-item-size-title-snapshot] FAILED with ${failures} check(s)`);
    process.exit(1);
  }
  console.log("\n[order-item-size-title-snapshot] ✓ all checks passed");
}

run().catch((e) => {
  console.error("[order-item-size-title-snapshot] fatal:", e);
  process.exit(1);
});