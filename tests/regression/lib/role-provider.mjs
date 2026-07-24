/**
 * Schema-aware role provider for the regression suite.
 *
 * The application's production RBAC lives in `public.user_roles` (enum
 * `public.app_role` with values `admin`, `zone_admin`, `user`) plus an
 * `assigned_zone_id` column for zone admins. This module is the single
 * place the regression suite touches that schema. If the app ever moves
 * role storage (profiles.role, auth metadata, a permissions table, etc.),
 * update ROLE_PROVIDER here and no individual regression test needs to
 * change.
 *
 * Every entry point performs a preflight against the live database and
 * throws a descriptive "Regression Configuration Error" if the expected
 * storage is missing, instead of surfacing a raw Postgres error.
 */

export const ROLE_PROVIDER = {
  kind: "user_roles_table",
  schema: "public",
  table: "user_roles",
  userColumn: "user_id",
  roleColumn: "role",
  zoneColumn: "assigned_zone_id",
  enum: { schema: "public", name: "app_role" },
  roles: {
    mainAdmin: "admin",
    employeeAdmin: "zone_admin",
    customer: "user",
  },
};

function configError(reason) {
  const supported = [
    "public.user_roles (role column, app_role enum) — current",
    "profiles.role",
    "user_profiles.role",
    "Supabase Auth user metadata",
    "custom role provider configured in tests/regression/lib/role-provider.mjs",
  ];
  const err = new Error(
    [
      "Regression Configuration Error",
      "",
      "Unable to locate the application's role storage.",
      "",
      `Reason: ${reason}`,
      "",
      "Expected one of:",
      ...supported.map((s) => `  • ${s}`),
      "",
      "No compatible role storage was found. Update ROLE_PROVIDER in",
      "tests/regression/lib/role-provider.mjs to match the app's schema.",
    ].join("\n"),
  );
  err.code = "REGRESSION_ROLE_STORAGE_MISSING";
  return err;
}

let preflightPromise = null;

export function preflightRoleProvider(admin) {
  if (!preflightPromise) preflightPromise = runPreflight(admin);
  return preflightPromise;
}

/**
 * Return a PostgREST query builder for the configured role table.
 *
 * For the default `public` schema we intentionally OMIT `.schema('public')`
 * so the request does not send an `Accept-Profile: public` header. That
 * header forces PostgREST to resolve the schema through its schema cache,
 * which can transiently miss immediately after a migration reload and
 * surface as: `Could not find the table 'public.user_roles' in the schema
 * cache`. Every application query targets user_roles without `.schema()`
 * and never hits this failure mode, so the regression suite matches.
 */
function roleTable(admin) {
  const { schema, table } = ROLE_PROVIDER;
  return schema === "public" ? admin.from(table) : admin.schema(schema).from(table);
}

async function runPreflight(admin) {
  if (ROLE_PROVIDER.kind !== "user_roles_table") {
    throw configError(`Unsupported ROLE_PROVIDER.kind "${ROLE_PROVIDER.kind}"`);
  }
  const { schema, table, roleColumn, userColumn } = ROLE_PROVIDER;
  // A zero-row select validates the table + required columns exist and are
  // readable with the service role, without leaking any row data. Retry a
  // few times to ride out transient PostgREST schema-cache misses that can
  // occur immediately after a migration reload.
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { error } = await roleTable(admin)
      .select(`${userColumn}, ${roleColumn}`)
      .limit(0);
    if (!error) {
      lastError = null;
      break;
    }
    lastError = error;
    const msg = String(error.message ?? "");
    const transient =
      msg.includes("schema cache") ||
      msg.includes("Could not find the table") ||
      error.code === "PGRST002";
    if (!transient) break;
    console.warn(
      `[role-provider] preflight attempt ${attempt}/5 hit transient schema-cache error: ${msg} — retrying`,
    );
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  if (lastError) {
    throw configError(
      `Cannot read ${schema}.${table} (${userColumn}, ${roleColumn}): ${lastError.message}`,
    );
  }
  console.log(
    `[role-provider] Using ${schema}.${table} (${roleColumn}=${ROLE_PROVIDER.roles.mainAdmin}|${ROLE_PROVIDER.roles.employeeAdmin}|${ROLE_PROVIDER.roles.customer})`,
  );
  return true;
}

/**
 * Assign a role to a user via the configured provider, then verify by
 * reading it back. Throws a descriptive error on failure.
 *
 * @param {ReturnType<typeof import("@supabase/supabase-js").createClient>} admin
 *   Service-role Supabase client.
 * @param {{ userId: string, role: "mainAdmin" | "employeeAdmin" | "customer", zoneId?: string | null }} params
 */
export async function assignRole(admin, { userId, role, zoneId = null }) {
  await preflightRoleProvider(admin);
  const dbRole = ROLE_PROVIDER.roles[role];
  if (!dbRole) throw configError(`Unknown logical role "${role}"`);

  if (role === "customer") {
    // The app's handle_new_user() trigger inserts (user_id, 'user') on
    // signup, so no additional write is required — just verify.
    return verifyRole(admin, userId, dbRole);
  }

  const row = {
    [ROLE_PROVIDER.userColumn]: userId,
    [ROLE_PROVIDER.roleColumn]: dbRole,
  };
  if (role === "employeeAdmin") {
    if (!zoneId) {
      throw new Error("assignRole('employeeAdmin') requires a zoneId");
    }
    row[ROLE_PROVIDER.zoneColumn] = zoneId;
  }

  const { error } = await roleTable(admin).insert(row);
  if (error) {
    throw new Error(
      `Failed to assign role "${dbRole}" via ${ROLE_PROVIDER.schema}.${ROLE_PROVIDER.table}: ${error.message}`,
    );
  }
  return verifyRole(admin, userId, dbRole);
}

async function verifyRole(admin, userId, dbRole) {
  const { data, error } = await roleTable(admin)
    .select(`${ROLE_PROVIDER.roleColumn}, ${ROLE_PROVIDER.zoneColumn}`)
    .eq(ROLE_PROVIDER.userColumn, userId);
  if (error) {
    throw new Error(
      `Failed to verify role for ${userId}: ${error.message}`,
    );
  }
  const hit = (data ?? []).find((r) => r[ROLE_PROVIDER.roleColumn] === dbRole);
  if (!hit) {
    throw new Error(
      `Role verification failed: expected "${dbRole}" for ${userId}, got ${JSON.stringify(data)}`,
    );
  }
  return { role: dbRole, zoneId: hit[ROLE_PROVIDER.zoneColumn] ?? null };
}

/** Remove all role rows for a user. Safe to call even if none exist. */
export async function clearRoles(admin, userId) {
  await preflightRoleProvider(admin);
  const { error } = await roleTable(admin)
    .delete()
    .eq(ROLE_PROVIDER.userColumn, userId);
  if (error) {
    console.error(`[role-provider] clearRoles(${userId}) error:`, error.message);
  }
}