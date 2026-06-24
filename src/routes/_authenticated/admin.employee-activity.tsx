import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Users,
  WifiOff,
  MapPin,
  LogIn,
  LogOut,
  Moon,
  Coffee,
  Package,
  ShoppingBag,
  History,
} from "lucide-react";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { listAdminPresence, type AdminPresenceRow } from "@/lib/admin/presence.functions";
import {
  listActivityFeed,
  type ActivityFeedRow,
} from "@/lib/admin/activity-feed.functions";

export const Route = createFileRoute("/_authenticated/admin/employee-activity")({
  beforeLoad: requireMainAdminGuard,
  head: () => ({ meta: [{ title: "Employee Activity — Admin" }] }),
  component: () => (
    <MainAdminGuard>
      <EmployeeActivityPage />
    </MainAdminGuard>
  ),
});

function MiniKpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_10px_40px_-24px_rgba(15,15,15,0.18)] backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

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
        <MiniKpi label="Online" value={kpis.online} icon={<Activity className="h-4 w-4" />} />
        <MiniKpi label="Idle / Away" value={kpis.idleAway} icon={<Users className="h-4 w-4" />} />
        <MiniKpi label="Offline" value={kpis.offline} icon={<WifiOff className="h-4 w-4" />} />
        <MiniKpi label="Zones staffed" value={kpis.staffedZones} icon={<MapPin className="h-4 w-4" />} />
      </div>

      <Card>
        {query.isLoading ? (
          <LoadingRows rows={6} />
        ) : query.isError ? (
          <ErrorPanel error={query.error} onRetry={() => { void query.refetch(); }} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No admin users yet"
            hint="Invite team members from the Users module to start tracking presence."
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

      <ActivityFeedPanel />
    </div>
  );
}

const FEED_CATEGORIES = [
  { id: "all", label: "All activity" },
  { id: "lifecycle", label: "Sign-in / presence" },
  { id: "orders", label: "Orders" },
  { id: "inventory", label: "Inventory" },
] as const;
type FeedCategory = (typeof FEED_CATEGORIES)[number]["id"];

function actionVisual(action: string): { icon: React.ReactNode; pill: string; label: string } {
  if (action === "auth.sign_in")
    return { icon: <LogIn className="h-3.5 w-3.5" />, pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Signed in" };
  if (action === "auth.sign_out")
    return { icon: <LogOut className="h-3.5 w-3.5" />, pill: "bg-rose-50 text-rose-700 ring-rose-200", label: "Signed out" };
  if (action === "presence.active")
    return { icon: <Activity className="h-3.5 w-3.5" />, pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Active" };
  if (action === "presence.idle")
    return { icon: <Coffee className="h-3.5 w-3.5" />, pill: "bg-amber-50 text-amber-700 ring-amber-200", label: "Idle" };
  if (action === "presence.away")
    return { icon: <Moon className="h-3.5 w-3.5" />, pill: "bg-sky-50 text-sky-700 ring-sky-200", label: "Away" };
  if (action.startsWith("order."))
    return { icon: <ShoppingBag className="h-3.5 w-3.5" />, pill: "bg-violet-50 text-violet-700 ring-violet-200", label: action.replace("order.", "Order · ") };
  if (action.startsWith("inventory."))
    return { icon: <Package className="h-3.5 w-3.5" />, pill: "bg-indigo-50 text-indigo-700 ring-indigo-200", label: action.replace("inventory.", "Inventory · ") };
  return { icon: <History className="h-3.5 w-3.5" />, pill: "bg-neutral-100 text-neutral-700 ring-neutral-200", label: action };
}

function formatMetadata(row: ActivityFeedRow): string {
  const md = row.metadata ?? {};
  const parts: string[] = [];
  if (row.entity && row.entity_id && row.entity !== "admin_presence") {
    parts.push(`${row.entity} ${String(row.entity_id).slice(0, 8)}`);
  }
  if (typeof md.status === "string") parts.push(`status → ${md.status}`);
  if (typeof md.delta === "number") parts.push(`Δ ${md.delta}`);
  if (typeof md.type === "string") parts.push(md.type);
  if (typeof md.new_balance === "number") parts.push(`stock ${md.new_balance}`);
  if (typeof md.threshold === "number") parts.push(`threshold ${md.threshold}`);
  if (typeof md.reason === "string") parts.push(`"${md.reason}"`);
  return parts.join(" · ");
}

function ActivityFeedPanel() {
  const [category, setCategory] = useState<FeedCategory>("all");
  const feedFn = useServerFn(listActivityFeed);
  const feed = useQuery({
    queryKey: ["admin-activity-feed", category],
    queryFn: () => feedFn({ data: { limit: 75, category } }),
    refetchInterval: 60_000,
  });

  // Realtime: any new audit row repaints the feed instantly.
  useRealtimeInvalidate(["audit_logs"], [["admin-activity-feed"]]);

  const rows = feed.data ?? [];

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-neutral-200/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Activity Feed</p>
          <p className="text-xs text-neutral-500">
            Live audit stream of admin sign-in, presence transitions, order updates, and inventory moves.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FEED_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                category === c.id
                  ? "bg-neutral-900 text-white ring-neutral-900"
                  : "bg-white text-neutral-600 ring-neutral-200 hover:bg-neutral-50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {feed.isLoading ? (
        <div className="p-4"><LoadingRows rows={5} /></div>
      ) : feed.isError ? (
        <ErrorPanel error={feed.error} onRetry={() => { void feed.refetch(); }} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No activity yet"
          hint="Admin actions will appear here the moment they happen."
        />
      ) : (
        <ol className="divide-y divide-neutral-100">
          {rows.map((row) => {
            const v = actionVisual(row.action);
            const who = row.actor_name || row.actor_email || "Unknown user";
            const detail = formatMetadata(row);
            return (
              <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${v.pill}`}>
                  {v.icon}
                  {v.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-900">
                    <span className="font-medium">{who}</span>
                    {row.zone_name && (
                      <span className="ml-2 text-xs text-neutral-500">· {row.zone_name}</span>
                    )}
                  </p>
                  {detail && <p className="truncate text-xs text-neutral-500">{detail}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-neutral-600">{formatRelative(row.created_at)}</div>
                  <div className="text-[10px] text-neutral-400">{formatDateTime(row.created_at)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}