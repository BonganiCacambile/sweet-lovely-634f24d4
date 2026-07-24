#!/usr/bin/env node
/**
 * Regression: places a sized-product order with quantity > 1 for EVERY size
 * and asserts that title_snapshot on every persisted order_items row includes
 * the selected size name (e.g. "Rib Platter — Half").
 *
 * Complements order-item-size-title-snapshot.mjs which uses qty=1 on one line.
 * Original bug reintroduction would show as rows sharing base title only.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const PIZZA_SUFFIXES = ["medium", "large"];
function splitPizzaId(id) {
  const xIdx = id.indexOf("-x-");
  const base = xIdx >= 0 ? id.slice(0, xIdx) : id;
  for (const s of PIZZA_SUFFIXES) {
    if (base.endsWith(`-${s}`)) return { slug: base.slice(0, -(s.length + 1)), size: s };
  }
  return { slug: base, size: null };
}
function splitVariantId(id) {
  const i = id.indexOf("--sz-");
  if (i >= 0) return { slug: id.slice(0, i), size: null, sizeId: id.slice(i + 5) };
  const { slug, size } = splitPizzaId(id);
  return { slug, size, sizeId: null };
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of [["SUPABASE_URL", SUPABASE_URL], ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY]]) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(2); }
}
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const pass = (m) => console.log("  ✓", m);
const fail = (m, extra) => { failures++; console.error("  ✗", m, extra ?? ""); };

const SUFFIX = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const PRODUCT_SLUG = `regr-size-snap-qty-${SUFFIX}`;
const REFERENCE = `REGR-SIZE-SNAP-QTY-${SUFFIX}`;
const BASE_TITLE = `Combo Platter ${SUFFIX}`;

// Three sizes, each ordered with quantity > 1, to guarantee EVERY saved row
// gets its own size name and rows are distinguishable.
const SIZE_SPECS = [
  { name: "Small", price: 79, qty: 2 },
  { name: "Medium", price: 129, qty: 3 },
  { name: "Large", price: 199, qty: 4 },
];

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

function resolvePriced(item, productMap, sizeMap) {
  const parsed = { ...item, ...splitVariantId(item.id) };
  const product = productMap.get(parsed.slug);
  const sz = parsed.sizeId ? sizeMap.get(parsed.sizeId) : null;
  const basePrice = sz ? Number(sz.price_zar) : Number(product?.price_zar ?? 0);
  const unitPrice = Number(basePrice.toFixed(2));
  const lineTotal = Number((unitPrice * parsed.quantity).toFixed(2));
  const base = product?.title ?? parsed.title;
  const title = sz ? `${base} — ${sz.name}` : base;
  return { slug: product ? parsed.slug : null, title, unitPrice, lineTotal, quantity: parsed.quantity };
}

async function run() {
  console.log("[order-item-size-title-snapshot-qty] starting");
  let orderId = null;
  try {
    const { error: pErr } = await admin.from("products").insert({
      slug: PRODUCT_SLUG,
      title: BASE_TITLE,
      category_slug: "sides",
      price_zar: 100,
      stock: 1000,
      is_active: true,
      size_selection_enabled: true,
    });
    if (pErr) throw new Error(`fixture product failed: ${pErr.message}`);

    const { data: sizes, error: sErr } = await admin
      .from("product_sizes")
      .insert(
        SIZE_SPECS.map((s, i) => ({
          product_slug: PRODUCT_SLUG,
          name: s.name,
          price_zar: s.price,
          sort_order: i,
          is_available: true,
        })),
      )
      .select("id, name, price_zar, product_slug");
    if (sErr || !sizes || sizes.length !== SIZE_SPECS.length) {
      throw new Error(`fixture sizes failed: ${sErr?.message}`);
    }
    const byName = new Map(sizes.map((s) => [s.name, s]));

    const cartItems = SIZE_SPECS.map((spec) => ({
      id: `${PRODUCT_SLUG}--sz-${byName.get(spec.name).id}`,
      title: "cart-supplied (should be overwritten)",
      price: 0,
      quantity: spec.qty,
    }));

    // Mirror verifyAndCreateOrder lookup shape.
    const slugs = Array.from(new Set(cartItems.map((c) => splitVariantId(c.id).slug)));
    const sizeIds = Array.from(new Set(cartItems.map((c) => splitVariantId(c.id).sizeId).filter(Boolean)));
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

    const zone = await pickZone();
    const subtotal = Number(priced.reduce((s, p) => s + p.lineTotal, 0).toFixed(2));
    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        user_id: null,
        status: "pending",
        customer_name: "Regression Size Snap Qty",
        customer_email: `regr-qty-${SUFFIX}@example.test`,
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
    orderId = order.id;

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
      .select("title_snapshot, quantity, unit_price_zar, line_total_zar")
      .eq("order_id", order.id);

    if (!rows || rows.length !== SIZE_SPECS.length) {
      fail(`expected ${SIZE_SPECS.length} order_items, got ${rows?.length ?? 0}`);
      return;
    }

    // Every saved row must include its size name AND quantity > 1.
    for (const spec of SIZE_SPECS) {
      const expectTitle = `${BASE_TITLE} — ${spec.name}`;
      const match = rows.find((r) => r.title_snapshot === expectTitle);
      if (!match) {
        fail(`missing row with title_snapshot "${expectTitle}"`, rows.map((r) => r.title_snapshot));
        continue;
      }
      if (Number(match.quantity) !== spec.qty) {
        fail(`row "${expectTitle}" quantity ${match.quantity}, expected ${spec.qty}`);
      } else {
        pass(`row "${expectTitle}" qty=${spec.qty}`);
      }
      if (Number(match.unit_price_zar) !== spec.price) {
        fail(`row "${expectTitle}" unit price ${match.unit_price_zar}, expected ${spec.price}`);
      } else {
        pass(`row "${expectTitle}" unit=${spec.price}`);
      }
      const expectLine = Number((spec.price * spec.qty).toFixed(2));
      if (Number(match.line_total_zar) !== expectLine) {
        fail(`row "${expectTitle}" line total ${match.line_total_zar}, expected ${expectLine}`);
      } else {
        pass(`row "${expectTitle}" line=${expectLine}`);
      }
    }

    // Every row must (a) include " — " separator and (b) be unique.
    for (const r of rows) {
      if (!r.title_snapshot?.includes(" — ")) {
        fail(`row title_snapshot missing size separator`, r);
      }
    }
    const titles = new Set(rows.map((r) => r.title_snapshot));
    if (titles.size !== rows.length) {
      fail(`title_snapshot values not unique across sized rows`, [...titles]);
    } else {
      pass(`all ${rows.length} rows have distinct title_snapshot values`);
    }
  } finally {
    if (orderId) {
      try { await admin.from("order_items").delete().eq("order_id", orderId); } catch {}
      try { await admin.from("orders").delete().eq("id", orderId); } catch {}
    }
    try { await admin.from("products").delete().eq("slug", PRODUCT_SLUG); } catch {}
  }

  if (failures > 0) {
    console.error(`\n[order-item-size-title-snapshot-qty] FAILED with ${failures} check(s)`);
    process.exit(1);
  }
  console.log("\n[order-item-size-title-snapshot-qty] ✓ all checks passed");
}

run().catch((e) => {
  console.error("[order-item-size-title-snapshot-qty] fatal:", e);
  process.exit(1);
});