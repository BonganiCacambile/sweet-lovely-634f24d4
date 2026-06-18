import { createFileRoute } from "@tanstack/react-router";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, AlertTriangle, Users, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Card, ErrorPanel, LoadingRows, EmptyState } from "@/components/admin/data-shell";
import { formatRelative } from "@/lib/admin/format";
import { securityOverview } from "@/lib/admin/security.functions";

export const Route = createFileRoute("/_authenticated/admin/security")({
  beforeLoad: requireMainAdminGuard,
  component: () => (
    <MainAdminGuard>
      <SecurityPage />
    </MainAdminGuard>
  ),
});

function SecurityPage() {
  const fn = useServerFn(securityOverview);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "security", "overview"], queryFn: () => fn(), refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Security Center" description="Monitor authentication, roles and access activity across the workspace." />
      {error ? <ErrorPanel error={error} onRetry={() => refetch()} /> : null}
      {isLoading || !data ? <LoadingRows rows={4} height={80} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<Users className="h-4 w-4" />} label="Total users" value={data.users.toLocaleString()} />
            <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Admins" value={data.admins.toLocaleString()} />
            <Stat icon={<KeyRound className="h-4 w-4" />} label="Permission entries" value={data.permissionEntries.toLocaleString()} />
            <Stat icon={<AlertTriangle className="h-4 w-4" />} label="Failed logins (7d)" value={data.failedLogins7d.toLocaleString()} tone={data.failedLogins7d > 0 ? "warn" : "ok"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-neutral-900">Security recommendations</h2>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <Rec ok={data.admins > 0} label="At least one admin assigned" />
                <Rec ok={data.admins <= 3} label="Admin count is contained (≤ 3 recommended)" />
                <Rec ok={data.failedLogins7d < 20} label="Failed logins under threshold this week" />
                <Rec ok={data.permissionEntries > 0} label="Role permissions configured" />
              </ul>
            </Card>

            <Card>
              <div className="border-b border-neutral-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-neutral-900">Recent security events</h2>
                <p className="text-xs text-neutral-500">Last 7 days · 20 most recent</p>
              </div>
              {data.recent.length === 0 ? <EmptyState title="No security events" /> : (
                <ul className="divide-y divide-neutral-100">
                  {data.recent.map((r, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-3 text-xs">
                      <div>
                        <p className="font-medium text-neutral-900">{r.action}</p>
                        <p className="text-neutral-500">{r.actor_email ?? "system"}</p>
                      </div>
                      <span className="text-neutral-500">{formatRelative(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone = "ok" }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_10px_40px_-24px_rgba(15,15,15,0.18)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <span className={tone === "warn" ? "text-amber-600" : "text-emerald-600"}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function Rec({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      {label}
    </li>
  );
}
