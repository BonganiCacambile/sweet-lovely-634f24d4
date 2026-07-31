#!/usr/bin/env node
/**
 * End-to-end RLS matrix: signs in as admin, zone_admin and customer with the
 * publishable (anon) key -- exactly like the browser client -- and verifies the
 * reads and writes each role is allowed / denied across the RLS-protected
 * tables.
 *
 * Every assertion runs against the live database with RLS enforced. The
 * service-role key is used ONLY to provision users/fixtures and to clean up.
 *
 * Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Run: bun run test:regression:rls-matrix
 */
import { createClient } from "@supabase/supabase-js";
import { assignRole, clearRoles } from "./lib/role-provider.mjs";
import { requireEnv } from "./lib/load-env.mjs";

// Validated BEFORE any test runs: a missing/malformed service-role key aborts
// immediately with actionable instructions instead of silently skipping the
// authenticated half of the matrix.
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY } = requireEnv(
  ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  { suite: "rls-matrix" },
);

const TAG = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const PASSWORD = `RlsMatrix!${TAG}`;

let failures = 0;
let checks = 0;
/** Categorised failures for the final security report. */
const report = {
  missingPermissions: [],
  unexpectedAccess: [],
  crossZoneLeaks: [],
  escalations: [],
  other: [],
  cleanup: { status: "not run", residual: [] },
};
const DENY_WORDS = /blocked|hidden|not readable|denied|only |filtered/i;
function categorise(msg) {
  const deny = DENY_WORDS.test(msg);
  if (/escalation|role granted/i.test(msg)) return report.escalations;
  if (deny && /zone/i.test(msg)) return report.crossZoneLeaks;
  if (deny) return report.unexpectedAccess;
  return report.missingPermissions;
}
const section = (s) => console.log(`\n> ${s}`);
function pass(msg) {
  checks++;
  console.log("  OK  ", msg);
}
function fail(msg, extra) {
  checks++;
  failures++;
  categorise(msg).push(extra ? `${msg} (${extra})` : msg);
  console.error("  FAIL", msg, extra ? `-- ${extra}` : "");
}
function expect(cond, msg, extra) {
  if (cond) pass(msg);
  else fail(msg, extra);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedInClient(email, password, label) {
  const c = anonClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`${label} sign-in failed: ${error?.message ?? "no session"}`);
  }
  return c;
}

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user.id;
}

const denied = (error, data) => Boolean(error) || (Array.isArray(data) && data.length === 0);
const ok = (error) => !error;

const fixtures = { users: [], zones: [], orders: [], products: [], toppings: [], banners: [] };

async function pickZones() {
  const { data, error } = await admin
    .from("delivery_zones")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order")
    .limit(2);
  if (error) throw new Error(`zone lookup: ${error.message}`);
  if ((data ?? []).length >= 2) return { own: data[0], other: data[1] };

  const rows = ["own", "other"].map((k, i) => ({
    slug: `rls-${k}-${TAG}`,
    name: `RLS ${k} ${TAG}`,
    postal_codes: [`0${i}000`],
    fee_zar: 10,
    min_order_zar: 0,
    eta_minutes: 30,
    is_active: true,
    sort_order: 900 + i,
  }));
  const { data: made, error: insErr } = await admin
    .from("delivery_zones")
    .insert(rows)
    .select("id, slug, name");
  if (insErr) throw new Error(`zone create: ${insErr.message}`);
  fixtures.zones.push(...made.map((z) => z.id));
  return { own: made[0], other: made[1] };
}

async function seedOrder({ zone, userId, number }) {
  const { data, error } = await admin
    .from("orders")
    .insert({
      order_number: number,
      user_id: userId,
      status: "pending",
      customer_name: `RLS ${TAG}`,
      customer_email: `rls-${TAG}@example.com`,
      subtotal_zar: 100,
      delivery_zar: 10,
      total_zar: 110,
      delivery_zone_id: zone?.id ?? null,
      delivery_zone_name: zone?.name ?? null,
      fulfillment_method: "delivery",
    })
    .select("id")
    .single();
  if (error) throw new Error(`seed order ${number}: ${error.message}`);
  fixtures.orders.push(data.id);
  const { error: itemErr } = await admin.from("order_items").insert({
    order_id: data.id,
    title_snapshot: `RLS item ${number}`,
    quantity: 1,
    unit_price_zar: 100,
    line_total_zar: 100,
  });
  if (itemErr) throw new Error(`seed order item ${number}: ${itemErr.message}`);
  return data.id;
}

async function seedInactiveProduct() {
  const { data: cat, error: catErr } = await admin
    .from("categories")
    .select("slug")
    .limit(1)
    .single();
  if (catErr) throw new Error(`category lookup: ${catErr.message}`);
  const slug = `rls-hidden-${TAG}`;
  const { error } = await admin.from("products").insert({
    slug,
    title: `RLS hidden ${TAG}`,
    price_zar: 99,
    category_slug: cat.slug,
    is_active: false,
  });
  if (error) throw new Error(`seed product: ${error.message}`);
  fixtures.products.push(slug);
  return slug;
}

async function adminSuite(c, ctx) {
  section("ADMIN -- protected reads");
  for (const table of [
    "audit_logs",
    "system_settings",
    "integrations",
    "promotions",
    "role_permissions",
    "inventory_movements",
    "reservations",
    "loyalty_accounts",
  ]) {
    const { error } = await c.from(table).select("*").limit(1);
    expect(ok(error), `${table} readable`, error?.message);
  }
  {
    const { data, error } = await c.from("products").select("slug").eq("slug", ctx.hiddenProduct);
    expect(ok(error) && (data ?? []).length === 1, "inactive product visible", error?.message);
  }
  {
    const { data, error } = await c
      .from("orders")
      .select("id")
      .in("id", [ctx.zoneOrderId, ctx.otherOrderId]);
    expect(ok(error) && (data ?? []).length === 2, "orders across all zones visible", error?.message ?? `saw ${data?.length}`);
  }
  {
    const { data, error } = await c
      .from("order_items")
      .select("id")
      .in("order_id", [ctx.zoneOrderId, ctx.otherOrderId]);
    expect(ok(error) && (data ?? []).length === 2, "order_items across all orders visible", error?.message);
  }
  {
    const { data, error } = await c.from("profiles").select("id").limit(5);
    expect(ok(error) && (data ?? []).length > 1, "profiles of other users visible", error?.message);
  }
  {
    const { data, error } = await c.from("user_roles").select("user_id, role").limit(5);
    expect(ok(error) && (data ?? []).length > 1, "user_roles of other users visible", error?.message);
  }
  {
    const { data, error } = await c
      .from("delivery_zones")
      .select("id")
      .in("id", [ctx.ownZone.id, ctx.otherZone.id]);
    expect(ok(error) && (data ?? []).length === 2, "all delivery zones visible", error?.message);
  }

  section("ADMIN -- protected writes");
  {
    const slug = `rls-topping-${TAG}`;
    const { data, error } = await c
      .from("pizza_toppings")
      .insert({ name: `RLS ${TAG}`, slug, price_zar: 5 })
      .select("id")
      .single();
    expect(ok(error) && Boolean(data?.id), "pizza_toppings insert allowed", error?.message);
    if (data?.id) {
      fixtures.toppings.push(data.id);
      const { data: upd, error: uErr } = await c
        .from("pizza_toppings")
        .update({ price_zar: 7 })
        .eq("id", data.id)
        .select("price_zar");
      expect(ok(uErr) && Number(upd?.[0]?.price_zar) === 7, "pizza_toppings update persists", uErr?.message);
      const { error: dErr } = await c.from("pizza_toppings").delete().eq("id", data.id);
      expect(ok(dErr), "pizza_toppings delete allowed", dErr?.message);
      if (ok(dErr)) fixtures.toppings.pop();
    }
  }
  {
    const { data, error } = await c
      .from("products")
      .update({ description: `rls-admin-${TAG}` })
      .eq("slug", ctx.hiddenProduct)
      .select("description");
    expect(ok(error) && data?.length === 1, "products update allowed", error?.message);
  }
  {
    const { data, error } = await c
      .from("product_sizes")
      .insert({ product_slug: ctx.hiddenProduct, name: `RLS ${TAG}`, price_zar: 50 })
      .select("id")
      .single();
    expect(ok(error) && Boolean(data?.id), "product_sizes insert allowed", error?.message);
    if (data?.id) {
      const { error: dErr } = await c.from("product_sizes").delete().eq("id", data.id);
      expect(ok(dErr), "product_sizes delete allowed", dErr?.message);
    }
  }
  {
    const { data, error } = await c
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", ctx.otherOrderId)
      .select("status");
    expect(ok(error) && data?.length === 1, "orders update in any zone allowed", error?.message);
  }
  {
    const { data, error } = await c
      .from("home_banners")
      .insert({ title: `RLS ${TAG}`, position: 999, is_active: false })
      .select("id")
      .single();
    expect(ok(error) && Boolean(data?.id), "home_banners insert allowed", error?.message);
    if (data?.id) {
      fixtures.banners.push(data.id);
      const { error: dErr } = await c.from("home_banners").delete().eq("id", data.id);
      expect(ok(dErr), "home_banners delete allowed", dErr?.message);
      if (ok(dErr)) fixtures.banners.pop();
    }
  }
  {
    const { data, error } = await c
      .from("delivery_zones")
      .update({ eta_minutes: 31 })
      .eq("id", ctx.otherZone.id)
      .select("id");
    expect(ok(error) && data?.length === 1, "delivery_zones update in any zone allowed", error?.message);
  }
}

async function zoneAdminSuite(c, ctx) {
  section("ZONE ADMIN -- scoped reads");
  {
    const { data, error } = await c
      .from("orders")
      .select("id")
      .in("id", [ctx.zoneOrderId, ctx.otherOrderId]);
    const ids = (data ?? []).map((r) => r.id);
    expect(
      ok(error) && ids.includes(ctx.zoneOrderId) && !ids.includes(ctx.otherOrderId),
      "orders: own zone visible, other zone filtered out",
      error?.message ?? `saw ${ids.length}`,
    );
  }
  {
    const { data, error } = await c
      .from("order_items")
      .select("order_id")
      .in("order_id", [ctx.zoneOrderId, ctx.otherOrderId]);
    const ids = (data ?? []).map((r) => r.order_id);
    expect(
      ok(error) && ids.includes(ctx.zoneOrderId) && !ids.includes(ctx.otherOrderId),
      "order_items: own zone only",
      error?.message,
    );
  }
  {
    const { data, error } = await c.from("delivery_zones").select("id").eq("id", ctx.ownZone.id);
    expect(ok(error) && (data ?? []).length === 1, "delivery_zones: own zone readable", error?.message);
  }
  for (const table of ["system_settings", "integrations", "role_permissions"]) {
    const { data, error } = await c.from(table).select("*").limit(1);
    expect(denied(error, data), `${table}: not readable`, error ? "" : `returned ${data?.length} rows`);
  }
  {
    const { data, error } = await c.from("inventory_movements").select("order_id").limit(50);
    const leaked = (data ?? []).some((r) => !r.order_id);
    expect(ok(error) && !leaked, "inventory_movements: only zone-order rows", error?.message ?? "non-order rows leaked");
  }
  {
    const { data, error } = await c.from("products").select("slug").eq("slug", ctx.hiddenProduct);
    expect(denied(error, data), "inactive product hidden", error ? "" : "row leaked");
  }
  {
    const { data, error } = await c.from("profiles").select("id").neq("id", ctx.zoneAdminId).limit(1);
    expect(denied(error, data), "other users' profiles hidden", error ? "" : "row leaked");
  }

  section("ZONE ADMIN -- scoped writes");
  {
    const { data, error } = await c
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", ctx.zoneOrderId)
      .select("id");
    expect(ok(error) && data?.length === 1, "orders: own-zone update allowed", error?.message);
  }
  {
    const { data, error } = await c
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", ctx.otherOrderId)
      .select("id");
    expect(denied(error, data), "orders: other-zone update blocked", error ? "" : "row updated");
  }
  {
    const { data, error } = await c
      .from("delivery_zones")
      .update({ eta_minutes: 33 })
      .eq("id", ctx.ownZone.id)
      .select("id");
    expect(ok(error) && data?.length === 1, "delivery_zones: own zone update allowed", error?.message);
  }
  {
    const { data, error } = await c
      .from("delivery_zones")
      .update({ eta_minutes: 44 })
      .eq("id", ctx.otherZone.id)
      .select("id");
    expect(denied(error, data), "delivery_zones: other zone update blocked", error ? "" : "row updated");
  }
  {
    const { error } = await c
      .from("pizza_toppings")
      .insert({ name: `RLS zone ${TAG}`, slug: `rls-zone-topping-${TAG}`, price_zar: 5 });
    expect(Boolean(error), "pizza_toppings insert blocked", error ? "" : "insert succeeded");
  }
  {
    const { data, error } = await c
      .from("products")
      .update({ description: `zone-${TAG}` })
      .eq("slug", ctx.hiddenProduct)
      .select("slug");
    expect(denied(error, data), "products update blocked", error ? "" : "row updated");
  }
  {
    const { error } = await c.from("audit_logs").insert({ action: `rls.zone.${TAG}` });
    expect(Boolean(error), "audit_logs insert blocked", error ? "" : "insert succeeded");
  }
  {
    const { error } = await c.from("user_roles").insert({ user_id: ctx.zoneAdminId, role: "admin" });
    expect(Boolean(error), "self privilege escalation blocked", error ? "" : "role granted");
  }
}

async function customerSuite(c, ctx) {
  section("CUSTOMER -- baseline");
  {
    const { data, error } = await c
      .from("orders")
      .select("id")
      .in("id", [ctx.zoneOrderId, ctx.otherOrderId]);
    const ids = (data ?? []).map((r) => r.id);
    expect(
      ok(error) && ids.length === 1 && ids[0] === ctx.zoneOrderId,
      "orders: only own order visible",
      error?.message ?? `saw ${ids.length}`,
    );
  }
  for (const table of ["audit_logs", "system_settings", "integrations", "inventory_movements", "role_permissions"]) {
    const { data, error } = await c.from(table).select("*").limit(1);
    expect(denied(error, data), `${table}: not readable`, error ? "" : `returned ${data?.length} rows`);
  }
  {
    const { data, error } = await c
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", ctx.zoneOrderId)
      .select("id");
    expect(denied(error, data), "orders: cannot change own order status", error ? "" : "row updated");
  }
  {
    const { error } = await c.from("user_roles").insert({ user_id: ctx.customerId, role: "admin" });
    expect(Boolean(error), "self privilege escalation blocked", error ? "" : "role granted");
  }
  {
    const { data, error } = await c
      .from("profiles")
      .update({ full_name: `RLS customer ${TAG}` })
      .eq("id", ctx.customerId)
      .select("id");
    expect(ok(error) && data?.length === 1, "own profile update allowed", error?.message);
  }
  {
    const { data, error } = await c
      .from("user_addresses")
      .insert({ user_id: ctx.customerId, label: "home", line1: "1 RLS Road", city: "Cape Town" })
      .select("id")
      .single();
    expect(ok(error) && Boolean(data?.id), "own address insert allowed", error?.message);
    if (data?.id) await c.from("user_addresses").delete().eq("id", data.id);
  }
}

async function anonSuite(ctx) {
  section("ANON -- public surface only");
  const c = anonClient();
  {
    const { data, error } = await c.from("products").select("slug").limit(1);
    expect(ok(error) && (data ?? []).length === 1, "active products readable", error?.message);
  }
  for (const table of ["orders", "audit_logs", "system_settings", "profiles", "user_roles"]) {
    const { data, error } = await c.from(table).select("*").limit(1);
    expect(denied(error, data), `${table}: not readable`, error ? "" : `returned ${data?.length} rows`);
  }
  {
    const { data, error } = await c
      .from("products")
      .update({ description: `anon-${TAG}` })
      .eq("slug", ctx.hiddenProduct)
      .select("slug");
    expect(denied(error, data), "products write blocked", error ? "" : "update succeeded");
  }
}

async function cleanup() {
  section("cleanup");
  if (fixtures.toppings.length) await admin.from("pizza_toppings").delete().in("id", fixtures.toppings);
  if (fixtures.banners.length) await admin.from("home_banners").delete().in("id", fixtures.banners);
  if (fixtures.orders.length) {
    await admin.from("order_items").delete().in("order_id", fixtures.orders);
    await admin.from("inventory_movements").delete().in("order_id", fixtures.orders);
    await admin.from("orders").delete().in("id", fixtures.orders);
  }
  if (fixtures.products.length) {
    await admin.from("product_sizes").delete().in("product_slug", fixtures.products);
    await admin.from("products").delete().in("slug", fixtures.products);
  }
  for (const id of fixtures.users) {
    await clearRoles(admin, id);
    await admin.from("notifications").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
  if (fixtures.zones.length) await admin.from("delivery_zones").delete().in("id", fixtures.zones);
  console.log("  OK   fixtures removed");
}

async function main() {
  console.log(`[rls-matrix] run ${TAG}`);
  const { own: ownZone, other: otherZone } = await pickZones();

  const adminEmail = `rls.admin.${TAG}@example.com`;
  const zoneEmail = `rls.zone.${TAG}@example.com`;
  const custEmail = `rls.user.${TAG}@example.com`;

  const adminId = await createUser(adminEmail);
  const zoneAdminId = await createUser(zoneEmail);
  const customerId = await createUser(custEmail);
  fixtures.users.push(adminId, zoneAdminId, customerId);

  await assignRole(admin, { userId: adminId, role: "mainAdmin" });
  await assignRole(admin, { userId: zoneAdminId, role: "employeeAdmin", zoneId: ownZone.id });
  await assignRole(admin, { userId: customerId, role: "customer" });
  console.log(`  roles assigned (zone admin -> ${ownZone.name})`);

  const hiddenProduct = await seedInactiveProduct();
  const zoneOrderId = await seedOrder({ zone: ownZone, userId: customerId, number: `RLS-${TAG}-A` });
  const otherOrderId = await seedOrder({ zone: otherZone, userId: null, number: `RLS-${TAG}-B` });

  const ctx = { ownZone, otherZone, hiddenProduct, zoneOrderId, otherOrderId, adminId, zoneAdminId, customerId };

  const adminC = await signedInClient(adminEmail, PASSWORD, "admin");
  const zoneC = await signedInClient(zoneEmail, PASSWORD, "zone admin");
  const custC = await signedInClient(custEmail, PASSWORD, "customer");

  await adminSuite(adminC, ctx);
  await zoneAdminSuite(zoneC, ctx);
  await customerSuite(custC, ctx);
  await anonSuite(ctx);
}

main()
  .then(cleanup, async (err) => {
    failures++;
    console.error("\nFATAL:", err.message);
    await cleanup().catch(() => {});
  })
  .finally(() => {
    console.log(`\n[rls-matrix] ${checks - failures}/${checks} checks passed`);
    process.exit(failures ? 1 : 0);
  });
