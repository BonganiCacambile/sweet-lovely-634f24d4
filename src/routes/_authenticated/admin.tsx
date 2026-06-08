import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Users, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin dashboard — Sweet & Lovely" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth/admin" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/account" });
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string | null; created_at: string }>>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data, count }) => {
        setProfiles((data as Array<{ id: string; full_name: string | null; created_at: string }>) ?? []);
        setCount(count ?? null);
      });
  }, []);

  return (
    <AccountShell title="Admin dashboard">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Total members</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900 tabular-nums">{count ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Signed in as</p>
          <p className="mt-2 truncate text-sm font-medium text-neutral-900">{user?.email}</p>
          <p className="text-xs text-neutral-500">Administrator</p>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">No active alerts</p>
              <p className="text-xs text-neutral-500">All systems normal</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-500" />
            <p className="text-sm font-semibold text-neutral-900">Recent sign-ups</p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {profiles.length === 0 && (
              <li className="py-6 text-center text-sm text-neutral-500">No members yet.</li>
            )}
            {profiles.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-neutral-900">{p.full_name || "Anonymous member"}</span>
                <span className="text-xs text-neutral-500">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AccountShell>
  );
}