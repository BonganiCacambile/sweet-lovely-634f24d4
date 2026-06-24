import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Users, WifiOff, MapPin } from "lucide-react";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { KpiCard } from "@/components/admin/kpi-card";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { listAdminPresence, type AdminPresenceRow } from "@/lib/admin/presence.functions";

export const Route = createFileRoute("/_authenticated/admin/employee-activity")({
  beforeLoad: requireMainAdminGuard,
  head: () => ({ meta: [{ title: "Employee Activity — Admin" }] }),
  component: () => (
    <MainAdminGuard>
      <EmployeeActivityPage />
    </MainAdminGuard>
  ),
});

const STATUS_STYLES: Record<
  AdminPresenceRow["status"],
  { dot: string; label: string; pill: string }
> = {
  active:  { dot: "bg-emerald-500", label: "Active",  pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  online:  { dot: "bg-emerald-500", label: "Online",  pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  idle:    { dot: "bg-amber-500",   label: "Idle",    pill: "bg-amber-50 text-amber-700 ring-amber-200" },
  away:    { dot: "bg-sky-500",     label: "Away",    pill: "bg-sky-50 text-sky-700 ring-sky-200" },
  offline: { dot: "bg-rose-500",    label: "Offline", pill: "bg-rose-50 text-rose-700 ring-rose-200" },
};

function StatusPill({ status }: { status: AdminPresenceRow["status"] }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android phone" : "Android tablet";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

function sessionDuration(loginAt: string | null, lastHeartbeat: string): string {
  if (!loginAt) return "—";
  const ms = new Date(lastHeartbeat).getTime() - new Date(loginAt).getTime();
  if (ms <= 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function EmployeeActivityPage() {
  const listFn = useServerFn(listAdminPresence);
  const query = useQuery({
    queryKey: ["admin-presence"],
    queryFn: () => listFn({}),
    refetchInterval: 30_000,
  });

  // Realtime: refetch whenever any presence row changes.
  useRealtimeInvalidate(["admin_presence"], [["admin-presence"]]);

  const rows = query.data ?? [];
  const kpis = useMemo(() => {
    const total = rows.length;
    const online = rows.filter((r) => r.status === "online" || r.status === "active").length;
    const idleAway = rows.filter((r) => r.status === "idle" || r.status === "away").length;
    const offline = rows.filter((r) => r.status === "offline").length;
    const staffedZones = new Set(
      rows
        .filter((r) => r.assigned_zone_id && r.status !== "offline")
        .map((r) => r.assigned_zone_id),
    ).size;
    return { total, online, idleAway, offline, staffedZones };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Activity"
        description="Live presence, sessions, and zone coverage across all admin users."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Online" value={kpis.online} icon={<Activity className="h-4 w-4" />} />
        <KpiCard label="Idle / Away" value={kpis.idleAway} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Offline" value={kpis.offline} icon={<WifiOff className="h-4 w-4" />} />
        <KpiCard label="Zones staffed" value={kpis.staffedZones} icon={<MapPin className="h-4 w-4" />} />
      </div>

      <Card>
        {query.isLoading ? (
          <LoadingRows rows={6} cols={6} />
        ) : query.isError ? (
          <ErrorPanel message={(query.error as Error).message} onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No admin users yet"
            description="Invite team members from the Users module to start tracking presence."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr className="border-b border-neutral-200/70">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Zone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last active</th>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Device</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .sort((a, b) => {
                    const order: Record<AdminPresenceRow["status"], number> = {
                      active: 0, online: 1, idle: 2, away: 3, offline: 4,
                    };
                    return order[a.status] - order[b.status];
                  })
                  .map((r) => (
                    <tr key={r.user_id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{r.full_name || r.email || "—"}</div>
                        {r.email && r.full_name && (
                          <div className="text-xs text-neutral-500">{r.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{r.role}</td>
                      <td className="px-4 py-3 text-neutral-700">{r.assigned_zone_name ?? "—"}</td>
                      <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-3 text-neutral-700">
                        <div>{formatRelative(r.last_active_at)}</div>
                        <div className="text-xs text-neutral-400">{formatDateTime(r.last_active_at)}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        <div>{sessionDuration(r.login_at, r.last_heartbeat_at)}</div>
                        {r.login_at && (
                          <div className="text-xs text-neutral-400">since {formatDateTime(r.login_at)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{deviceLabel(r.user_agent)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}