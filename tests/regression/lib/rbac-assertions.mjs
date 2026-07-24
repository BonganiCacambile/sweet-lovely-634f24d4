/**
 * Post-role-assign RBAC assertions.
 *
 * Uses signed-in publishable-key clients (RLS applies as the caller) to
 * verify that the role stored via role-provider actually grants the
 * expected permissions against the live database:
 *
 *   • Main Admin      — can read & update every delivery zone.
 *   • Employee Admin  — can read/update ONLY the assigned zone; other
 *                       zones return zero rows (RLS silently filters).
 *   • Customer        — cannot perform admin-protected actions
 *                       (writing zones, reading audit_logs, granting
 *                       themselves an admin role).
 *
 * These are RLS-level checks; they don't need the app UI to be up.
 */

import { createClient } from "@supabase/supabase-js";

function newClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`sign-in failed for ${email}: ${error?.message ?? "no session"}`);
  }
  return data.session;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`[rbac] ${msg}`);
}

/**
 * @param {object} params
 * @param {string} params.url                    Supabase URL
 * @param {string} params.publishableKey         Publishable/anon key
 * @param {{email:string,password:string,userId:string}} params.mainAdmin
 * @param {{email:string,password:string,userId:string,zoneId:string}} params.employeeAdmin
 * @param {{email:string,password:string,userId:string}} params.customer
 */
export async function assertRbacPermissions({
  url,
  publishableKey,
  mainAdmin,
  employeeAdmin,
  customer,
}) {
  console.log("[rbac] Verifying role permissions post-assign…");

  // -------- Main Admin: sees & updates every zone --------
  {
    const c = newClient(url, publishableKey);
    await signIn(c, mainAdmin.email, mainAdmin.password);
    const { data: allZones, error: readErr } = await c
      .from("delivery_zones")
      .select("id, name");
    if (readErr) throw new Error(`[rbac] main admin read zones: ${readErr.message}`);
    assert(
      (allZones?.length ?? 0) >= 2,
      `main admin should see all zones (got ${allZones?.length ?? 0})`,
    );

    // No-op update across every zone — RLS on UPDATE (ALL policy) permits it.
    const { data: updated, error: updErr } = await c
      .from("delivery_zones")
      .update({ updated_at: new Date().toISOString() })
      .in("id", allZones.map((z) => z.id))
      .select("id");
    if (updErr) throw new Error(`[rbac] main admin update zones: ${updErr.message}`);
    assert(
      (updated?.length ?? 0) === allZones.length,
      `main admin should update every zone (${updated?.length}/${allZones.length})`,
    );
    await c.auth.signOut();
    console.log(`  ✓ main admin: reads & updates ${allZones.length} zones`);
  }

  // -------- Employee Admin: only assigned zone --------
  {
    const c = newClient(url, publishableKey);
    await signIn(c, employeeAdmin.email, employeeAdmin.password);

    // SELECT is a union of public (is_active) + zone-admin-own. Public
    // active zones are still visible; the RLS invariant is that
    // UPDATE only targets the assigned zone.
    const { data: assignedRead } = await c
      .from("delivery_zones")
      .select("id")
      .eq("id", employeeAdmin.zoneId)
      .maybeSingle();
    assert(
      assignedRead?.id === employeeAdmin.zoneId,
      "employee admin must read their assigned zone",
    );

    // Update to assigned zone succeeds (returns the row).
    const { data: okUpd, error: okErr } = await c
      .from("delivery_zones")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", employeeAdmin.zoneId)
      .select("id");
    if (okErr) throw new Error(`[rbac] employee update assigned: ${okErr.message}`);
    assert(
      (okUpd?.length ?? 0) === 1,
      `employee admin must update assigned zone (got ${okUpd?.length ?? 0} rows)`,
    );

    // Update to a different zone must be filtered by RLS → 0 rows.
    const svc = arguments; // silence lints; not used
    void svc;
    // Find any other active zone id (public SELECT is enough here).
    const { data: others } = await c
      .from("delivery_zones")
      .select("id")
      .neq("id", employeeAdmin.zoneId)
      .limit(1);
    if (others && others.length) {
      const otherId = others[0].id;
      const { data: badUpd, error: badErr } = await c
        .from("delivery_zones")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", otherId)
        .select("id");
      if (badErr) throw new Error(`[rbac] employee update other zone errored: ${badErr.message}`);
      assert(
        (badUpd?.length ?? 0) === 0,
        `employee admin must NOT update zone ${otherId} (got ${badUpd?.length ?? 0} rows)`,
      );
      console.log(`  ✓ employee admin: updates only assigned zone (blocked on ${otherId})`);
    } else {
      console.log("  ⚠ employee admin: only one zone exists, cross-zone denial skipped");
    }
    await c.auth.signOut();
  }

  // -------- Customer: denied protected actions --------
  {
    const c = newClient(url, publishableKey);
    await signIn(c, customer.email, customer.password);

    // 1. Cannot write delivery zones.
    const { data: custUpd, error: custUpdErr } = await c
      .from("delivery_zones")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", employeeAdmin.zoneId)
      .select("id");
    if (custUpdErr && !/row-level security|permission/i.test(custUpdErr.message)) {
      throw new Error(`[rbac] customer zone update unexpected error: ${custUpdErr.message}`);
    }
    assert(
      (custUpd?.length ?? 0) === 0,
      `customer must NOT update delivery zones (got ${custUpd?.length ?? 0} rows)`,
    );

    // 2. Cannot read admin-only audit_logs.
    const { data: logs, error: logsErr } = await c
      .from("audit_logs")
      .select("id")
      .limit(1);
    if (logsErr && !/row-level security|permission/i.test(logsErr.message)) {
      throw new Error(`[rbac] customer audit_logs unexpected error: ${logsErr.message}`);
    }
    assert(
      (logs?.length ?? 0) === 0,
      `customer must NOT read audit_logs (got ${logs?.length ?? 0})`,
    );

    // 3. Cannot self-elevate by writing user_roles.
    const { error: elevErr } = await c
      .from("user_roles")
      .insert({ user_id: customer.userId, role: "admin" });
    assert(
      Boolean(elevErr),
      "customer must NOT be able to insert into user_roles (self-elevation)",
    );
    await c.auth.signOut();
    console.log("  ✓ customer: denied zone writes, audit_logs reads, and self-elevation");
  }

  console.log("[rbac] ✅ all role permission assertions passed.");
}