/**
 * Shared admin credential resolver for the regression suite.
 *
 * Prefers the configured ADMIN_EMAIL / ADMIN_PASSWORD. When those are absent
 * or no longer authenticate (rotated password, deleted user), it provisions a
 * throwaway main-admin with the service-role key and deletes it in teardown.
 * This keeps admin-dependent suites deterministic without touching app code,
 * RLS, or the production admin account.
 *
 * Requires: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { assignRole, clearRoles } from "./role-provider.mjs";

const noop = async () => {};

function withAutoCleanup(creds, autoCleanup) {
  if (!autoCleanup || !creds.ephemeral) return creds;
  let done = false;
  const run = async () => {
    if (done) return;
    done = true;
    await creds.cleanup();
  };
  process.once("beforeExit", () => {
    void run();
  });
  return { ...creds, cleanup: run };
}

export async function resolveAdminCredentials({ prefix = "regr-admin", autoCleanup = true } = {}) {
  const {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("resolveAdminCredentials requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
  }

  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const { data, error } = await anon.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (!error && data?.session && data?.user) {
      await anon.auth.signOut().catch(() => {});
      return {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        userId: data.user.id,
        ephemeral: false,
        cleanup: noop,
      };
    }
    console.warn(
      "[admin-session] Configured ADMIN_EMAIL/ADMIN_PASSWORD did not authenticate — falling back to an ephemeral admin.",
    );
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Admin sign-in failed and SUPABASE_SERVICE_ROLE_KEY is not set, so no ephemeral admin can be provisioned.",
    );
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@regression.sweetnlovely.test`;
  const password = `Regr-${Math.random().toString(36).slice(2)}-${Date.now()}!aZ`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Regression Admin" },
  });
  if (createErr || !created?.user) {
    throw new Error(`Could not create ephemeral admin: ${createErr?.message ?? "unknown"}`);
  }
  const userId = created.user.id;
  await assignRole(admin, { userId, role: "mainAdmin" });

  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn?.session) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`Ephemeral admin sign-in failed: ${signInErr?.message ?? "no session"}`);
  }
  await anon.auth.signOut().catch(() => {});

  return withAutoCleanup(
    {
      email,
      password,
      userId,
      ephemeral: true,
      async cleanup() {
        await clearRoles(admin, userId);
        await admin.auth.admin.deleteUser(userId).catch(() => {});
      },
    },
    autoCleanup,
  );
}

/** Same contract for a plain customer account (no elevated role). */
export async function resolveCustomerCredentials({ prefix = "regr-customer", autoCleanup = true } = {}) {
  const {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    CUSTOMER_EMAIL,
    CUSTOMER_PASSWORD,
  } = process.env;

  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (CUSTOMER_EMAIL && CUSTOMER_PASSWORD) {
    const { data, error } = await anon.auth.signInWithPassword({
      email: CUSTOMER_EMAIL,
      password: CUSTOMER_PASSWORD,
    });
    if (!error && data?.session && data?.user) {
      await anon.auth.signOut().catch(() => {});
      return {
        email: CUSTOMER_EMAIL,
        password: CUSTOMER_PASSWORD,
        userId: data.user.id,
        ephemeral: false,
        cleanup: noop,
      };
    }
    console.warn(
      "[admin-session] Configured CUSTOMER_EMAIL/CUSTOMER_PASSWORD did not authenticate — falling back to an ephemeral customer.",
    );
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Customer sign-in failed and SUPABASE_SERVICE_ROLE_KEY is not set, so no ephemeral customer can be provisioned.",
    );
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@regression.sweetnlovely.test`;
  const password = `Regr-${Math.random().toString(36).slice(2)}-${Date.now()}!aZ`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Regression Customer" },
  });
  if (createErr || !created?.user) {
    throw new Error(`Could not create ephemeral customer: ${createErr?.message ?? "unknown"}`);
  }
  const userId = created.user.id;
  return withAutoCleanup(
    {
      email,
      password,
      userId,
      ephemeral: true,
      async cleanup() {
        await admin.auth.admin.deleteUser(userId).catch(() => {});
      },
    },
    autoCleanup,
  );
}