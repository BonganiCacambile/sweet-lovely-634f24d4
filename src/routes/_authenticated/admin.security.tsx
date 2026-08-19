import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, AlertTriangle, Users, KeyRound, Ban, LogOut, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, ErrorPanel, LoadingRows, EmptyState } from "@/components/admin/data-shell";
import { formatRelative } from "@/lib/admin/format";
import { securityOverview } from "@/lib/admin/security.functions";
import {
  securityCenter,
  setEmployeeDisabled,
  revokeEmployeeSessions,
  setEmployeeMfaExempt,
  acknowledgeAlert,
} from "@/lib/admin/employee-security.functions";

export const Route = createFileRoute("/_authenticated/admin/security")({
  beforeLoad: requireMainAdminGuard,
  component: () => (
    <MainAdminGuard>
      <SecurityPage />
    </MainAdminGuard>
  ),
});

type Tab = "overview" | "employees" | "alerts" | "exports";

function SecurityPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const overviewFn = useServerFn(securityOverview);
  const centerFn = useServerFn(securityCenter);
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "security", "overview"], queryFn: () => overviewFn(), refetchOnWindowFocus: true,
  });
  const center = useQuery({
    queryKey: ["admin", "security", "center"], queryFn: () => centerFn(), refetchInterval: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "security"] });
  const onError = (e: unknown) =>
    toast.error("Action failed", { description: e instanceof Error ? e.message : "Unknown error" });

  const disableFn = useServerFn(setEmployeeDisabled);
  const revokeFn = useServerFn(revokeEmployeeSessions);
  const exemptFn = useServerFn(setEmployeeMfaExempt);
  const ackFn = useServerFn(acknowledgeAlert);

  const disableM = useMutation({
    mutationFn: (v: { userId: string; disabled: boolean }) => disableFn({ data: v }),
    onSuccess: () => { toast.success("Employee access updated"); invalidate(); }, onError,
  });
  const revokeM = useMutation({
    mutationFn: (userId: string) => revokeFn({ data: { userId } }),
    onSuccess: () => { toast.success("Sessions revoked"); invalidate(); }, onError,
  });
  const exemptM = useMutation({
    mutationFn: (v: { userId: string; exempt: boolean }) => exemptFn({ data: v }),
    onSuccess: () => { toast.success("MFA policy updated"); invalidate(); }, onError,
  });
  const ackM = useMutation({
    mutationFn: (id: string) => ackFn({ data: { id } }),
    onSuccess: () => { invalidate(); }, onError,
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Security Center" description="Employee access, zone isolation, alerts and data-export oversight." />
      {error ? <ErrorPanel error={error} onRetry={() => refetch()} /> : null}

      <div className="flex flex-wrap gap-2">
        {(["overview", "employees", "alerts", "exports"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`security-tab-${t}`}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${tab === t ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        isLoading || !data ? <LoadingRows rows={4} height={80} /> : (
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
                  <Rec ok={(center.data?.config.enforceMfa ?? false)} label="MFA enforced for admin accounts" />
                  <Rec ok={(center.data?.employees ?? []).every((e) => !e.mfaExempt)} label="No standing MFA exemptions" />
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
        )
      ) : null}

      {tab === "employees" ? (
        center.isLoading || !center.data ? <LoadingRows rows={4} height={64} /> : (
          <Card>
            <div className="border-b border-neutral-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Employees &amp; access</h2>
              <p className="text-xs text-neutral-500">Disable accounts, revoke sessions and manage MFA policy.</p>
            </div>
            {center.data.employees.length === 0 ? <EmptyState title="No employees" /> : (
              <ul className="divide-y divide-neutral-100" data-testid="security-employees">
                {center.data.employees.map((e) => (
                  <li key={`${e.userId}-${e.role}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-neutral-900">{e.name ?? e.userId.slice(0, 8)}</p>
                      <p className="text-neutral-500">
                        {e.role}{e.zoneName ? ` · ${e.zoneName}` : ""} · {e.presence}
                        {e.lastActiveAt ? ` · ${formatRelative(e.lastActiveAt)}` : ""}
                      </p>
                    </div>
                    {e.isDisabled ? <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">Disabled</span> : null}
                    {e.mfaExempt ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">MFA exempt</span> : null}
                    <button type="button" onClick={() => revokeM.mutate(e.userId)} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50">
                      <LogOut className="h-3 w-3" /> Revoke sessions
                    </button>
                    <button type="button" onClick={() => exemptM.mutate({ userId: e.userId, exempt: !e.mfaExempt })} className="rounded-full border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50">
                      {e.mfaExempt ? "Require MFA" : "Exempt MFA"}
                    </button>
                    <button type="button" onClick={() => disableM.mutate({ userId: e.userId, disabled: !e.isDisabled })} className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 font-semibold text-white hover:bg-neutral-800">
                      <Ban className="h-3 w-3" /> {e.isDisabled ? "Enable" : "Disable"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      ) : null}

      {tab === "alerts" ? (
        center.isLoading || !center.data ? <LoadingRows rows={4} height={56} /> : (
          <Card>
            <div className="border-b border-neutral-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Security alerts</h2>
              <p className="text-xs text-neutral-500">Escalation attempts, cross-zone access and bulk data reads.</p>
            </div>
            {center.data.alerts.length === 0 ? <EmptyState title="No alerts in the last 7 days" /> : (
              <ul className="divide-y divide-neutral-100" data-testid="security-alerts">
                {center.data.alerts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${a.severity === "critical" ? "bg-red-100 text-red-700" : a.severity === "high" ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-700"}`}>
                      {a.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-neutral-900">{a.message}</p>
                      <p className="text-neutral-500">{a.type} · {a.actor_email ?? "system"} · {formatRelative(a.created_at)}</p>
                    </div>
                    {a.acknowledged_at ? (
                      <span className="text-neutral-400">Acknowledged</span>
                    ) : (
                      <button type="button" onClick={() => ackM.mutate(a.id)} className="rounded-full border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50">
                        Acknowledge
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      ) : null}

      {tab === "exports" ? (
        center.isLoading || !center.data ? <LoadingRows rows={4} height={56} /> : (
          <Card>
            <div className="border-b border-neutral-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Data exports</h2>
              <p className="text-xs text-neutral-500">Every admin export is logged with actor, zone and row count.</p>
            </div>
            {center.data.exports.length === 0 ? <EmptyState title="No exports recorded" /> : (
              <ul className="divide-y divide-neutral-100" data-testid="security-exports">
                {center.data.exports.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-3 text-xs">
                    <Download className="h-3.5 w-3.5 text-neutral-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-neutral-900">{x.entity} · {x.row_count} rows · {x.format.toUpperCase()}</p>
                      <p className="text-neutral-500">{x.actor_email ?? "system"}</p>
                    </div>
                    <span className="text-neutral-500">{formatRelative(x.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      ) : null}
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
