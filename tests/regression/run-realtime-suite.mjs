#!/usr/bin/env node
/**
 * Runs the full existing realtime regression suite:
 *   - realtime-orders
 *   - realtime-customer-notifications
 *   - admin-presence-perf
 *
 * The suite creates temporary admin + customer accounts, runs each test,
 * then deletes the accounts and any leftover test data.
 */
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(HERE));
const ARTIFACTS = join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });

const {
  APP_URL = "http://localhost:8080",
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_PROJECT_ID,
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
need("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TAG = `suite-${Date.now()}`;
const ADMIN_EMAIL = `regression-admin-${TAG}@example.com`;
const ADMIN_PASSWORD = `Regress1!${crypto.randomBytes(4).toString("hex")}`;
const CUSTOMER_EMAIL = `regression-customer-${TAG}@example.com`;
const CUSTOMER_PASSWORD = `Regress1!${crypto.randomBytes(4).toString("hex")}`;

async function createUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create ${email}: ${error?.message ?? "unknown"}`);
  }
  return data.user.id;
}

async function runScript(name, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn("bun", ["run", name], {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
      cwd: ROOT,
    });
    child.on("exit", (code) => resolve(code));
    child.on("error", (err) => {
      console.error(`Failed to start ${name}:`, err);
      resolve(1);
    });
  });
}

async function cleanup(adminId, customerId) {
  console.log("[realtime-suite] Cleaning up test accounts…");

  // Delete any leftover test orders by user_id or REGR- order_number.
  const { data: userOrders } = await admin
    .from("orders")
    .select("id")
    .in("user_id", [adminId, customerId].filter(Boolean))
    .like("order_number", "REGR-%");
  const { data: anonOrders } = await admin
    .from("orders")
    .select("id")
    .is("user_id", null)
    .like("order_number", "REGR-%");
  const orderIds = [
    ...(userOrders ?? []),
    ...(anonOrders ?? []),
  ].map((o) => o.id);

  for (const orderId of new Set(orderIds)) {
    await admin.from("order_items").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
  }

  // Delete notifications and audit logs created by the tests.
  await admin.from("notifications").delete().in("user_id", [adminId, customerId].filter(Boolean));
  await admin
    .from("audit_logs")
    .delete()
    .eq("actor_id", adminId)
    .like("metadata->>run", "REGR-PERF-%");

  // Finally delete the auth users (cascades to profiles and user_roles).
  for (const id of [adminId, customerId]) {
    if (!id) continue;
    await admin.auth.admin.deleteUser(id).catch((e) => {
      console.error(`[realtime-suite] delete user ${id} error:`, e.message);
    });
  }

  console.log("[realtime-suite] Cleanup complete.");
}

async function main() {
  console.log("[realtime-suite] Creating temporary test accounts…");
  const adminId = await createUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: adminId, role: "admin" });
  if (roleErr) throw new Error(`Failed to assign admin role: ${roleErr.message}`);

  const customerId = await createUser(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

  // Verify sign-in works before launching the browsers.
  const adminSignIn = await userClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (adminSignIn.error || !adminSignIn.data.session) {
    throw new Error(`Admin sign-in verification failed: ${adminSignIn.error?.message ?? "no session"}`);
  }
  const customerSignIn = await userClient.auth.signInWithPassword({
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD,
  });
  if (customerSignIn.error || !customerSignIn.data.session) {
    throw new Error(`Customer sign-in verification failed: ${customerSignIn.error?.message ?? "no session"}`);
  }

  const env = {
    APP_URL,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    CUSTOMER_EMAIL,
    CUSTOMER_PASSWORD,
    // Generous budgets for the sandbox/dev server environment.
    PAGE_BUDGET_MS: "12000",
    SERVER_FN_BUDGET_MS: "8000",
    REALTIME_BUDGET_MS: "15000",
  };

  const scripts = [
    "test:regression:orders",
    "test:regression:notifications",
    "test:regression:presence-perf",
  ];

  const failures = [];
  for (const script of scripts) {
    console.log(`\n[realtime-suite] Running ${script}…`);
    const code = await runScript(script, env);
    if (code !== 0) failures.push(script);
  }

  await cleanup(adminId, customerId);

  if (failures.length) {
    console.error(`\n[realtime-suite] ❌ FAIL — ${failures.join(", ")}`);
    process.exit(1);
  }

  console.log("\n[realtime-suite] ✅ PASS — all realtime regression tests passed.");
}

main().catch(async (err) => {
  console.error("[realtime-suite] Fatal error:", err);
  process.exit(1);
});
