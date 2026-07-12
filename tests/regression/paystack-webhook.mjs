#!/usr/bin/env node
/**
 * Regression: /api/public/paystack-webhook
 *
 * Verifies:
 *   1. charge.success with a valid HMAC-SHA512 signature promotes a
 *      matching pending order to "preparing".
 *   2. A replay of the same signed payload is a no-op (idempotent).
 *   3. An invalid signature is rejected with 401 and does not mutate the order.
 *   4. A missing x-paystack-signature header is rejected with 401.
 *   5. A signed payload for an unknown reference returns 200 (safety-net
 *      behaviour) without creating anything.
 *   6. An amount-mismatch charge.success is ignored (status stays pending).
 *   7. A non-charge.success event is ack'd without touching order status.
 *
 * Each test inserts its own order via service role with a unique
 * paystack_reference so cases don't interfere. All test orders are cleaned
 * up at the end (identified by the REGR-WEBHOOK-* prefix on the reference).
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

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const WEBHOOK_URL = `${APP_URL.replace(/\/$/, "")}/api/public/paystack-webhook`;
const TAG = `REGR-WEBHOOK-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

const failures = [];
function record(name, ok, detail) {
  if (ok) {
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

function sign(rawBody) {
  return crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
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

async function createPendingOrder(zone, reference, totalZar) {
  const { data, error } = await admin
    .from("orders")
    .insert({
      user_id: null,
      status: "pending",
      customer_name: "Webhook Regression",
      customer_email: `webhook-${crypto.randomBytes(4).toString("hex")}@example.com`,
      customer_phone: "+27000000000",
      address: "1 Test St, Cape Town",
      notes: `${TAG} initial`,
      subtotal_zar: totalZar - Number(zone.fee_zar),
      delivery_zar: Number(zone.fee_zar),
      total_zar: totalZar,
      paystack_reference: reference,
      delivery_zone_id: zone.id,
      delivery_zone_name: zone.name,
      fulfillment_method: "delivery",
      estimated_minutes: 30,
    })
    .select("id, status")
    .single();
  if (error || !data) throw new Error(`Insert failed: ${error?.message}`);
  return data;
}

async function getOrderStatus(id) {
  const { data, error } = await admin
    .from("orders")
    .select("status, notes")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`Read failed: ${error?.message}`);
  return data;
}

async function postWebhook(payloadObj, { signature, includeSignature = true } = {}) {
  const rawBody = JSON.stringify(payloadObj);
  const headers = { "content-type": "application/json" };
  if (includeSignature) {
    headers["x-paystack-signature"] = signature ?? sign(rawBody);
  }
  const res = await fetch(WEBHOOK_URL, { method: "POST", headers, body: rawBody });
  const text = await res.text();
  return { status: res.status, body: text };
}

function chargeSuccess(reference, amountZar) {
  return {
    event: "charge.success",
    data: {
      reference,
      status: "success",
      amount: Math.round(amountZar * 100),
      currency: "ZAR",
    },
  };
}

async function cleanup() {
  const { data: rows } = await admin
    .from("orders")
    .select("id")
    .like("paystack_reference", `${TAG}-%`);
  const ids = (rows ?? []).map((r) => r.id);
  for (const id of ids) {
    await admin.from("order_items").delete().eq("order_id", id);
    await admin.from("orders").delete().eq("id", id);
  }
}

async function main() {
  console.log(`[paystack-webhook] Target: ${WEBHOOK_URL}`);
  console.log(`[paystack-webhook] Tag:    ${TAG}`);

  // Preflight: dev server reachable?
  try {
    const ping = await fetch(APP_URL, { method: "HEAD" });
    if (!ping.ok && ping.status >= 500) {
      throw new Error(`ping ${ping.status}`);
    }
  } catch (e) {
    console.error(`[paystack-webhook] App not reachable at ${APP_URL}: ${e.message}`);
    process.exit(2);
  }

  const zone = await pickZone();

  // --- Test 1: valid signature promotes pending -> preparing ------------
  {
    const ref = `${TAG}-valid`;
    const order = await createPendingOrder(zone, ref, 250);
    const res = await postWebhook(chargeSuccess(ref, 250));
    const after = await getOrderStatus(order.id);
    record(
      "valid signature promotes pending -> preparing",
      res.status === 200 && after.status === "preparing",
      `http=${res.status} status=${after.status}`,
    );
  }

  // --- Test 2: replay is idempotent -------------------------------------
  {
    const ref = `${TAG}-replay`;
    const order = await createPendingOrder(zone, ref, 300);
    const payload = chargeSuccess(ref, 300);
    const r1 = await postWebhook(payload);
    const s1 = await getOrderStatus(order.id);
    const r2 = await postWebhook(payload);
    const s2 = await getOrderStatus(order.id);
    const r3 = await postWebhook(payload);
    const s3 = await getOrderStatus(order.id);
    record(
      "replay is idempotent (all 200, status remains preparing)",
      r1.status === 200 &&
        r2.status === 200 &&
        r3.status === 200 &&
        s1.status === "preparing" &&
        s2.status === "preparing" &&
        s3.status === "preparing",
      `codes=${r1.status}/${r2.status}/${r3.status} status=${s3.status}`,
    );
  }

  // --- Test 3: invalid signature is rejected ----------------------------
  {
    const ref = `${TAG}-badsig`;
    const order = await createPendingOrder(zone, ref, 150);
    // Same-length hex string, definitely not the real digest.
    const forged = "a".repeat(128);
    const res = await postWebhook(chargeSuccess(ref, 150), { signature: forged });
    const after = await getOrderStatus(order.id);
    record(
      "invalid signature returns 401 and does not mutate order",
      res.status === 401 && after.status === "pending",
      `http=${res.status} status=${after.status}`,
    );
  }

  // --- Test 4: missing signature header is rejected ---------------------
  {
    const ref = `${TAG}-nosig`;
    const order = await createPendingOrder(zone, ref, 175);
    const res = await postWebhook(chargeSuccess(ref, 175), { includeSignature: false });
    const after = await getOrderStatus(order.id);
    record(
      "missing signature returns 401 and does not mutate order",
      res.status === 401 && after.status === "pending",
      `http=${res.status} status=${after.status}`,
    );
  }

  // --- Test 5: unknown reference is safely acked ------------------------
  {
    const ref = `${TAG}-unknown`; // no order inserted for this ref
    const res = await postWebhook(chargeSuccess(ref, 100));
    // Also confirm no ghost order got created.
    const { data: ghost } = await admin
      .from("orders")
      .select("id")
      .eq("paystack_reference", ref);
    record(
      "unknown reference returns 200 without creating an order",
      res.status === 200 && (!ghost || ghost.length === 0),
      `http=${res.status} ghost=${ghost?.length ?? 0}`,
    );
  }

  // --- Test 6: amount mismatch (paid < expected) is ignored -------------
  {
    const ref = `${TAG}-amount`;
    const order = await createPendingOrder(zone, ref, 500); // expects 50000 minor units
    // Paystack reports only R100 was captured.
    const res = await postWebhook(chargeSuccess(ref, 100));
    const after = await getOrderStatus(order.id);
    record(
      "amount mismatch is ack'd (200) but order stays pending",
      res.status === 200 && after.status === "pending",
      `http=${res.status} status=${after.status}`,
    );
  }

  // --- Test 7: non-charge.success event is ack'd, no mutation -----------
  {
    const ref = `${TAG}-otherevent`;
    const order = await createPendingOrder(zone, ref, 220);
    const payload = {
      event: "transfer.success",
      data: { reference: ref, status: "success", amount: 22000, currency: "ZAR" },
    };
    const res = await postWebhook(payload);
    const after = await getOrderStatus(order.id);
    record(
      "non-charge.success event returns 200 without mutating order",
      res.status === 200 && after.status === "pending",
      `http=${res.status} status=${after.status}`,
    );
  }
}

main()
  .catch((err) => {
    console.error("[paystack-webhook] Fatal:", err);
    failures.push("fatal");
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (e) {
      console.error("[paystack-webhook] Cleanup error:", e.message);
    }
    if (failures.length) {
      console.error(`\n[paystack-webhook] ❌ FAIL — ${failures.length} case(s): ${failures.join(", ")}`);
      process.exit(1);
    }
    console.log("\n[paystack-webhook] ✅ PASS — all cases passed.");
  });
