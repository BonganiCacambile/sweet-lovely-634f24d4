/**
 * Ephemeral signed-in customer session for browser regression tests.
 *
 * The storefront is behind a global auth gate (see AuthGate in
 * src/routes/__root.tsx): unauthenticated visitors are redirected to /auth,
 * which detaches any storefront DOM the test was interacting with. Browser
 * suites that exercise storefront flows (cart, checkout) must therefore boot
 * with a real Supabase session seeded into localStorage — exactly like a
 * logged-in customer.
 */
import { createClient } from "@supabase/supabase-js";
import { signInCompat } from "./admin-session.mjs";

export function storageKeyFor(supabaseUrl, projectId) {
  const ref = projectId || new URL(supabaseUrl).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

/**
 * Create (or reuse) a throwaway customer and return a live session.
 * Returns { session, userId, storageKey, cleanup }.
 */
export async function createEphemeralCustomerSession({
  supabaseUrl,
  serviceRoleKey,
  publishableKey,
  projectId,
  emailPrefix = "regression",
}) {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = `${emailPrefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@regression.sweetnlovely.test`;
  const password = `Rgr-${Math.random().toString(36).slice(2)}-${Date.now()}!A9`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Regression Bot" },
  });
  if (createErr || !created?.user) {
    throw new Error(`Could not create regression customer: ${createErr?.message ?? "unknown"}`);
  }
  const userId = created.user.id;

  const { data: signIn, error: signInErr } = await signInCompat(anon, {
    email,
    password,
  });
  if (signInErr || !signIn?.session) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`Could not sign in regression customer: ${signInErr?.message ?? "no session"}`);
  }

  return {
    email,
    userId,
    session: signIn.session,
    storageKey: storageKeyFor(supabaseUrl, projectId),
    async cleanup() {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    },
  };
}
