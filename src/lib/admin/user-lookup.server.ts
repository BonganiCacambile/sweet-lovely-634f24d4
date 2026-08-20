import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Resolve an auth user id from an email address.
 * The Admin API has no direct "get by email" in the JS client, so we page
 * through users (bounded) instead of only checking the first page.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[user-lookup] listUsers failed", error.message);
      return null;
    }
    const users = data?.users ?? [];
    for (const u of users) {
      if ((u.email ?? "").toLowerCase() === target) return u.id;
    }
    if (users.length < perPage) break;
  }
  return null;
}

/** Resolve emails for a set of auth user ids (bounded paging). */
export async function findEmailsByUserIds(ids: string[]): Promise<Record<string, string>> {
  const wanted = new Set(ids.filter(Boolean));
  const out: Record<string, string> = {};
  if (wanted.size === 0) return out;
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[user-lookup] listUsers failed", error.message);
      break;
    }
    const users = data?.users ?? [];
    for (const u of users) if (wanted.has(u.id) && u.email) out[u.id] = u.email;
    if (users.length < perPage || Object.keys(out).length === wanted.size) break;
  }
  return out;
}
