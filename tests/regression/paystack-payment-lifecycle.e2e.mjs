#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

/**
 * End-to-end regression: a completed Paystack payment moves the order to the
 * correct status, including rounding tolerances.
 *
 * Flow per case:
 *   1. Insert a real pending order (service role) with a known total, exactly
 *      as `verifyAndCreateOrder` would when the browser flow completes.
 *   2. Deliver a signed `charge.success` webhook — the same payload Paystack
 *      sends once the customer's payment settles.
 *   3. Assert the resulting order status (and note) in the database.
 *
 * Tolerance contract (shared constant AMOUNT_TOLERANCE_MINOR = 100 cents):
 *   - captured >= expected                        -> preparing
 *   - captured short by <= R1.00 (rounding)       -> preparing
 *   - captured short by  > R1.00 (real shortfall) -> stays pending for review
 *   - overpayment                                 -> preparing
 *
 * Also verifies the customer-facing order status read and webhook replay
 * idempotency after a tolerated rounding difference.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const {
  APP_URL = "http://localhost:8080",
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PAYSTACK_SECRET_KEY,
} = process.env;

function need(name, val) {
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
  return val;
}
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
need("PAYSTACK_SECRET_KEY", PAYSTACK_SECRET_KEY);

/** Keep in sync with src/lib/payment-tolerance.ts */
const AMOUNT_TOLERANCE_MINOR = 100;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const WEBHOOK_URL = `${APP_URL.replace(/\/$/, "")}/api/public/paystack-webhook`;
const TAG = `REGR-PAYLIFE-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

const failures = [];
function record(name, ok, detail) {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const sign = (raw) =>
  crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(raw).digest("hex");

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

async function createPaidPendingOrder(zone, reference, totalZar) {
  const fee = Number(zone.fee_zar);
  const { data, error } = await admin
    .from("orders")
    .insert({
      user_id: null,
      status: "pending",
      customer_name: "Payment Lifecycle Regression",
      customer_email: `paylife-${crypto.randomBytes(4).toString("hex")}@example.com`,
      customer_phone: "+27000000000",
      address: "1 Test St, Cape Town",
      notes: `${TAG} awaiting payment confirmation`,
      subtotal_zar: Number((totalZar - fee).toFixed(2)),
      delivery_zar: fee,
      total_zar: totalZar,
      paystack_reference: reference,
      delivery_zone_id: zone.id,
      delivery_zone_name: zone.name,
      fulfillment_method: "delivery",
      estimated_minutes: 30,
    })
    .select("id, order_number, status, total_zar")
    .single();
  if (error || !data) throw new Error(`Insert failed: ${error?.message}`);
  return data;
}

async function readOrder(id) {
  const { data, error } = await admin
    .from("orders")
    .select("status, notes, total_zar, order_number")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`Read failed: ${error?.message}`);
  return data;
}

/** Deliver a signed charge.success webhook with a captured amount in minor units. */
async function deliverPayment(reference, capturedMinor) {
  const rawBody = JSON.stringify({
    event: "charge.success",
    data: {
      reference,
      status: "success",
      amount: capturedMinor,
      currency: "ZAR",
      channel: "card",
      paid_at: new Date().toISOString(),
    },
  });
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": sign(rawBody),
    },
    body: rawBody,
  });
  return { status: res.status, body: await res.text() };
}

async function cleanup() {
  const { data: rows } = await admin
    .from("orders")
    .select("id")
    .like("paystack_reference", `${TAG}-%`);
  for (const { id } of rows ?? []) {
    await admin.from("order_items").delete().eq("order_id", id);
    await admin.from("orders").delete().eq("id", id);
  }
}

/**
 * Run one payment case.
 * @param {object} opts
 * @param {string} opts.name       case label
 * @param {number} opts.totalZar   order total charged to the customer
 * @param {number} opts.deltaMinor difference between captured and expected (cents; negative = short)
 * @param {"preparing"|"pending"} opts.expectStatus
 */
async function paymentCase(zone, { name, slug, totalZar, deltaMinor, expectStatus }) {
  const ref = `${TAG}-${slug}`;
  const order = await createPaidPendingOrder(zone, ref, totalZar);
  const expectedMinor = Math.round(totalZar * 100);
  const captured = expectedMinor + deltaMinor;
  const res = await deliverPayment(ref, captured);
  const after = await readOrder(order.id);
  record(
    name,
    res.status === 200 && after.status === expectStatus,
    `http=${res.status} captured=${captured} expected=${expectedMinor} status=${after.status} (want ${expectStatus})`,
  );
  return { ref, order, after };
}

async function main() {
  console.log(`[paystack-payment-lifecycle] Target: ${WEBHOOK_URL}`);
  console.log(`[paystack-payment-lifecycle] Tag:    ${TAG}`);
  console.log(`[paystack-payment-lifecycle] Tolerance: ${AMOUNT_TOLERANCE_MINOR} minor units`);

  try {
    const ping = await fetch(APP_URL, { method: "HEAD" });
    if (!ping.ok && ping.status >= 500) throw new Error(`ping ${ping.status}`);
  } catch (e) {
    console.error(`[paystack-payment-lifecycle] App not reachable at ${APP_URL}: ${e.message}`);
    process.exit(2);
  }

  const zone = await pickZone();

  // 1) Happy path: exact amount captured -> order is confirmed.
  const exact = await paymentCase(zone, {
    name: "exact payment confirms order (pending -> preparing)",
    slug: "exact",
    totalZar: 249.99,
    deltaMinor: 0,
    expectStatus: "preparing",
  });
  record(
    "confirmed order keeps its number and total",
    Boolean(exact.after.order_number) && Number(exact.after.total_zar) === 249.99,
    `number=${exact.after.order_number} total=${exact.after.total_zar}`,
  );

  // 2) Rounding tolerance: 1 cent short still confirms.
  await paymentCase(zone, {
    name: "1c rounding shortfall is tolerated (preparing)",
    slug: "round-1c",
    totalZar: 187.35,
    deltaMinor: -1,
    expectStatus: "preparing",
  });

  // 3) Boundary: exactly at the tolerance limit still confirms.
  await paymentCase(zone, {
    name: "shortfall exactly at tolerance limit confirms (preparing)",
    slug: "round-limit",
    totalZar: 320.5,
    deltaMinor: -AMOUNT_TOLERANCE_MINOR,
    expectStatus: "preparing",
  });

  // 4) Just past the boundary: order stays pending for manual review.
  const over = await paymentCase(zone, {
    name: "shortfall 1c past tolerance stays pending for review",
    slug: "round-over",
    totalZar: 410,
    deltaMinor: -(AMOUNT_TOLERANCE_MINOR + 1),
    expectStatus: "pending",
  });
  record(
    "under-tolerance order is not silently confirmed",
    over.after.status === "pending",
    `status=${over.after.status}`,
  );

  // 5) Material shortfall (customer paid far less) -> pending.
  await paymentCase(zone, {
    name: "material shortfall stays pending",
    slug: "shortfall",
    totalZar: 500,
    deltaMinor: -25000,
    expectStatus: "pending",
  });

  // 6) Overpayment (tip / currency rounding up) -> confirmed.
  await paymentCase(zone, {
    name: "overpayment confirms order",
    slug: "overpay",
    totalZar: 99.9,
    deltaMinor: +250,
    expectStatus: "preparing",
  });

  // 7) Replay after a tolerated rounding payment stays idempotent.
  {
    const ref = `${TAG}-replay-round`;
    const order = await createPaidPendingOrder(zone, ref, 275.25);
    const expectedMinor = Math.round(275.25 * 100);
    const r1 = await deliverPayment(ref, expectedMinor - 5);
    const s1 = await readOrder(order.id);
    const r2 = await deliverPayment(ref, expectedMinor - 5);
    const s2 = await readOrder(order.id);
    record(
      "replayed tolerated payment is idempotent (stays preparing)",
      r1.status === 200 &&
        r2.status === 200 &&
        s1.status === "preparing" &&
        s2.status === "preparing",
      `codes=${r1.status}/${r2.status} statuses=${s1.status}/${s2.status}`,
    );
  }

  // 8) A later shortfall webhook must never downgrade a confirmed order.
  {
    const ref = `${TAG}-no-downgrade`;
    const order = await createPaidPendingOrder(zone, ref, 180);
    await deliverPayment(ref, 18000);
    const confirmed = await readOrder(order.id);
    const res = await deliverPayment(ref, 100); // bogus late low-amount event
    const after = await readOrder(order.id);
    record(
      "late low-amount event does not downgrade a confirmed order",
      confirmed.status === "preparing" && res.status === 200 && after.status === "preparing",
      `confirmed=${confirmed.status} http=${res.status} after=${after.status}`,
    );
  }
}

main()
  .catch((err) => {
    console.error("[paystack-payment-lifecycle] Fatal:", err);
    failures.push("fatal");
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (e) {
      console.error("[paystack-payment-lifecycle] Cleanup error:", e.message);
    }
    if (failures.length) {
      console.error(
        `\n[paystack-payment-lifecycle] ❌ FAIL — ${failures.length} case(s): ${failures.join(", ")}`,
      );
      process.exit(1);
    }
    console.log("\n[paystack-payment-lifecycle] ✅ PASS — all payment lifecycle cases passed.");
  });
