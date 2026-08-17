#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

/**
 * Push notification regression suite.
 *
 * Customer:
 *  1. can register a device token for themselves
 *  2. cannot register a device against another user's id
 *  3. cannot read another customer's device tokens
 *  4. can change their own notification preferences (profiles.notification_prefs)
 *  5. cannot change another customer's preferences
 *  6. receives an order notification with deep-link data on order insert
 *  7. duplicate status updates do not create duplicate notifications (dedupe_key)
 *  8. cannot read another customer's notification or delivery rows
 *  9. push delivery rows are queued for active devices and are read-only to users
 *
 * Admin / RBAC:
 * 10. main admin can insert a global (user_id NULL) announcement
 * 11. zone admin cannot insert a global announcement
 *
 * Only the publishable key is used for customer/admin assertions, so RLS runs
 * exactly as the browser experiences it. The service role is used solely for
 * fixture setup/teardown.
 */
import { createClient } from "@supabase/supabase-js";
import { establishSession, resolveAdminCredentials, resolveCustomerCredentials } from "./lib/admin-session.mjs";
import { assignRole, clearRoles } from "./lib/role-provider.mjs";

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [n, v] of Object.entries({ SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) {
    console.error(`Missing required env var: ${n}`);
    process.exit(2);
  }
}

let failures = 0;
const pass = (m) => console.log("  ✓", m);
const fail = (m, extra) => {
  failures++;
  console.error("  ✗", m, extra ?? "");
};

const makeClient = () =>
  createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(client, creds, label) {
  try {
    const session = await establishSession(client, creds);
    return session.user.id;
  } catch (e) {
    throw new Error(`${label} ${e.message}`);
  }
}

async function waitFor(fn, { tries = 20, delay = 300 } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(delay);
  }
  return null;
}

const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const cleanups = [];

async function run() {
  console.log("[push-rls] provisioning fixtures…");
  const custA = await resolveCustomerCredentials({ prefix: `regr-push-a`, autoCleanup: false });
  const custB = await resolveCustomerCredentials({ prefix: `regr-push-b`, autoCleanup: false });
  const adminCreds = await resolveAdminCredentials({ prefix: "regr-push-admin", autoCleanup: false });
  cleanups.push(custA.cleanup, custB.cleanup, adminCreds.cleanup);

  const a = makeClient();
  const b = makeClient();
  const adminC = makeClient();
  const aId = await signIn(a, custA, "customer A");
  const bId = await signIn(b, custB, "customer B");
  await signIn(adminC, adminCreds, "main admin");

  const tokenA = `web-local:regr-${SUFFIX}-a`;

  // 1) register own device
  console.log("[push-rls] device registration");
  {
    const { error } = await a.from("user_notification_devices").insert({
      user_id: aId,
      token: tokenA,
      platform: "web",
      provider: "web-local",
      device_name: "Regression Web",
      is_active: true,
    });
    if (error) fail("customer A could not register their own device", error.message);
    else pass("customer A registered their own device");
  }

  // 2) cannot register for another user
  {
    const { error } = await a.from("user_notification_devices").insert({
      user_id: bId,
      token: `web-local:regr-${SUFFIX}-spoof`,
      platform: "web",
      provider: "web-local",
    });
    if (error) pass("customer A cannot register a device against customer B");
    else fail("RLS HOLE: customer A registered a device for customer B");
  }

  // 3) cannot read another customer's tokens
  {
    await b.from("user_notification_devices").insert({
      user_id: bId,
      token: `web-local:regr-${SUFFIX}-b`,
      platform: "web",
      provider: "web-local",
    });
    const { data } = await a.from("user_notification_devices").select("id, token").eq("user_id", bId);
    if ((data ?? []).length === 0) pass("customer A cannot read customer B's device tokens");
    else fail("RLS HOLE: customer A read customer B's device tokens");
  }

  // 4/5) preferences
  console.log("[push-rls] notification preferences");
  {
    const prefs = { push: { orders: true, promotions: false, announcements: false } };
    const { error } = await a.from("profiles").update({ notification_prefs: prefs }).eq("id", aId);
    if (error) fail("customer A could not update own preferences", error.message);
    else pass("customer A updated their own notification preferences");

    const { data: readBack } = await a.from("profiles").select("notification_prefs").eq("id", aId).maybeSingle();
    if (readBack?.notification_prefs?.push?.promotions === false) pass("preference change persisted");
    else fail("preference change did not persist", JSON.stringify(readBack));

    await a.from("profiles").update({ notification_prefs: { push: { promotions: true } } }).eq("id", bId);
    const { data: bPrefs } = await admin.from("profiles").select("notification_prefs").eq("id", bId).maybeSingle();
    if (bPrefs?.notification_prefs?.push?.promotions !== true) pass("customer A cannot modify customer B's preferences");
    else fail("RLS HOLE: customer A modified customer B's preferences");
  }

  // 6) order notification
  console.log("[push-rls] order notifications");
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      user_id: aId,
      customer_name: "Regression Push",
      status: "pending",
      subtotal_zar: 100,
      delivery_zar: 0,
      total_zar: 100,
      fulfillment_method: "collection",
    })
    .select("id, order_number")
    .single();
  if (orderErr) throw new Error(`fixture order insert failed: ${orderErr.message}`);
  cleanups.push(async () => {
    await admin.from("notifications").delete().eq("user_id", aId);
    await admin.from("orders").delete().eq("id", order.id);
  });

  const placed = await waitFor(async () => {
    const { data } = await a
      .from("notifications")
      .select("id, title, data, dedupe_key")
      .eq("dedupe_key", `order:${order.id}:placed`)
      .maybeSingle();
    return data;
  });
  if (placed) pass(`order-placed notification delivered to the customer (${placed.title})`);
  else fail("no order-placed notification was created");
  if (placed?.data?.order_id === order.id && typeof placed?.data?.url === "string") {
    pass("notification carries deep-link data (order_id + url)");
  } else {
    fail("notification is missing deep-link data", JSON.stringify(placed?.data));
  }

  // 7) idempotency across repeated status updates
  for (let i = 0; i < 3; i++) {
    await admin.from("orders").update({ status: "preparing" }).eq("id", order.id);
    await admin.from("orders").update({ status: "pending" }).eq("id", order.id);
  }
  await admin.from("orders").update({ status: "preparing" }).eq("id", order.id);
  await sleep(800);
  {
    const { data } = await a
      .from("notifications")
      .select("id")
      .eq("dedupe_key", `order:${order.id}:preparing`);
    if ((data ?? []).length === 1) pass("repeated status updates produced exactly one 'preparing' notification");
    else fail(`duplicate notifications created for the same status (${(data ?? []).length})`);
  }

  // 8) cross-customer notification read
  {
    const { data } = await b.from("notifications").select("id").eq("user_id", aId);
    if ((data ?? []).length === 0) pass("customer B cannot read customer A's notifications");
    else fail("RLS HOLE: customer B read customer A's notifications");
  }

  // 9) deliveries queued + read-only
  console.log("[push-rls] delivery bookkeeping");
  {
    const rows = await waitFor(async () => {
      const { data } = await a
        .from("notification_deliveries")
        .select("id, status, category, order_id")
        .eq("user_id", aId);
      return (data ?? []).length ? data : null;
    });
    if (rows) pass(`delivery rows queued for the customer's active device (${rows.length})`);
    else fail("no delivery rows were queued for the registered device");

    const { data: crossRead } = await b.from("notification_deliveries").select("id").eq("user_id", aId);
    if ((crossRead ?? []).length === 0) pass("customer B cannot read customer A's delivery records");
    else fail("RLS HOLE: customer B read customer A's delivery records");

    if (rows?.[0]) {
      const { error } = await a
        .from("notification_deliveries")
        .update({ status: "sent" })
        .eq("id", rows[0].id)
        .select("id");
      const { data: after } = await admin
        .from("notification_deliveries")
        .select("status")
        .eq("id", rows[0].id)
        .maybeSingle();
      if (error || after?.status !== "sent") pass("customers cannot self-mutate delivery records directly");
      else fail("RLS HOLE: customer updated a delivery record directly");
    }
  }

  // 10/11) admin RBAC on global announcements
  console.log("[push-rls] admin RBAC");
  {
    const { data, error } = await adminC
      .from("notifications")
      .insert({
        user_id: null,
        title: `Regression announcement ${SUFFIX}`,
        body: "Main admin broadcast",
        category: "announcement",
      })
      .select("id")
      .maybeSingle();
    if (!error && data?.id) {
      pass("main admin can create a global announcement");
      cleanups.push(async () => {
        await admin.from("notifications").delete().eq("id", data.id);
      });
    } else {
      fail("main admin could not create a global announcement", error?.message);
    }

    // zone admin
    await assignRole(admin, { userId: bId, role: "employeeAdmin", zoneId: await anyZoneId() });
    const zoneC = makeClient();
    await signIn(zoneC, custB, "zone admin");
    const { data: zoneRow, error: zoneErr } = await zoneC
      .from("notifications")
      .insert({
        user_id: null,
        title: `Zone admin broadcast ${SUFFIX}`,
        body: "should be blocked",
        category: "promotion",
      })
      .select("id")
      .maybeSingle();
    if (zoneErr || !zoneRow) {
      pass("zone admin cannot create a global promotional notification");
    } else {
      fail("RBAC HOLE: zone admin created a global notification");
      await admin.from("notifications").delete().eq("id", zoneRow.id);
    }
    await clearRoles(admin, bId);
  }
}

async function anyZoneId() {
  const { data } = await admin.from("delivery_zones").select("id").limit(1).maybeSingle();
  return data?.id ?? null;
}

run()
  .catch((e) => {
    failures++;
    console.error("[push-rls] fatal:", e.message);
  })
  .finally(async () => {
    for (const c of cleanups.reverse()) await c?.().catch(() => {});
    console.log(failures === 0 ? "[push-rls] PASS" : `[push-rls] FAIL (${failures})`);
    process.exit(failures === 0 ? 0 : 1);
  });
