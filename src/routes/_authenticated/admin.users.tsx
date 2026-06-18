import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldCheck, UserX, UserCheck, Trash2, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { formatDateTime, formatRelative, formatZar } from "@/lib/admin/format";
import {
  listUsers,
  userStats,
  getUserDetail,
  setUserBan,
  deleteUser,
  setUserRole,
  assignZoneAdmin,
  revokeZoneAdmin,
  type AdminUserRow,
} from "@/lib/admin/users.functions";
import { listAllZones } from "@/lib/admin/zones.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: requireMainAdminGuard,
  component: () => (
    <MainAdminGuard>
      <UsersPage />
    </MainAdminGuard>
  ),
});

function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listUsers);
  const statsFn = useServerFn(userStats);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "users", "list", { search: debounced, role, page }],
    queryFn: () => listFn({ data: { search: debounced, role, page, pageSize: 25 } }),
    refetchOnWindowFocus: true,
  });
  const { data: stats } = useQuery({ queryKey: ["admin", "users", "stats"], queryFn: () => statsFn() });

  const banFn = useServerFn(setUserBan);
  const deleteFn = useServerFn(deleteUser);
  const ban = useMutation({
    mutationFn: (v: { id: string; suspend: boolean }) => banFn({ data: v }),
    onSuccess: () => { toast.success("Account updated"); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("User deleted"); setActiveId(null); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCols = useMemo(() => ([
    { key: "email", label: "Email" },
    { key: "full_name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "roles", label: "Roles", map: (r: AdminUserRow) => r.roles.join(", ") },
    { key: "created_at", label: "Joined" },
    { key: "last_sign_in_at", label: "Last sign-in" },
  ]), []);

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Users"
        description="Search, filter, and manage every Sweet & Lovely member."
        actions={<ExportMenu rows={rows} columns={exportCols as never} filename="users" title="Users" />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="Total users" value={stats?.total ?? 0} />
        <StatBlock label="New (7d)" value={stats?.newLast7d ?? 0} />
        <StatBlock label="Admins" value={stats?.admins ?? 0} />
        <StatBlock label="On this page" value={rows.length} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search by email, name, phone…"
              className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={role}
            onChange={(e) => { setPage(1); setRole(e.target.value); }}
            className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="">All roles</option>
            <option value="admin">Admins</option>
            <option value="user">Members</option>
          </select>
        </div>

        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <div className="p-4"><ErrorPanel error={error} onRetry={refetch} /></div>
        ) : rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No users found" hint="Try a different search or role filter." /></div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50/70 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium">Roles</th>
                    <th className="px-4 py-2 font-medium">Joined</th>
                    <th className="px-4 py-2 font-medium">Last sign-in</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name ?? u.email ?? "?"} url={u.avatar_url} />
                          <div>
                            <p className="font-medium text-neutral-900">{u.full_name ?? "—"}</p>
                            <p className="text-xs text-neutral-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length ? u.roles.map((r) => (
                            <RoleChip key={r} role={r} />
                          )) : <span className="text-xs text-neutral-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">{formatRelative(u.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-neutral-600">{u.last_sign_in_at ? formatRelative(u.last_sign_in_at) : "Never"}</td>
                      <td className="px-4 py-3">
                        {u.banned_until && new Date(u.banned_until) > new Date() ? (
                          <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">Suspended</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setActiveId(u.id)} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs hover:bg-neutral-50">
                          Open <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-neutral-100 md:hidden">
              {rows.map((u) => (
                <li key={u.id} className="p-3" onClick={() => setActiveId(u.id)}>
                  <div className="flex items-start gap-3">
                    <Avatar name={u.full_name ?? u.email ?? "?"} url={u.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-neutral-900">{u.full_name ?? u.email}</p>
                      <p className="truncate text-xs text-neutral-500">{u.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.roles.map((r) => <RoleChip key={r} role={r} />)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination page={page} pageSize={data?.pageSize ?? 25} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>

      {activeId && (
        <UserDrawer
          id={activeId}
          onClose={() => setActiveId(null)}
          onSuspend={(suspend) => ban.mutate({ id: activeId, suspend })}
          onDelete={() => {
            if (confirm("Delete this user permanently? This cannot be undone.")) remove.mutate(activeId);
          }}
        />
      )}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  return <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff003c]/10 text-xs font-semibold text-[#ff003c]">{initials}</div>;
}

function RoleChip({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isAdmin ? "bg-violet-50 text-violet-700" : "bg-neutral-100 text-neutral-700"}`}>
      {isAdmin && <ShieldCheck className="h-3 w-3" />} {role}
    </span>
  );
}

function UserDrawer({ id, onClose, onSuspend, onDelete }: { id: string; onClose: () => void; onSuspend: (s: boolean) => void; onDelete: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getUserDetail);
  const roleFn = useServerFn(setUserRole);
  const zonesFn = useServerFn(listAllZones);
  const assignFn = useServerFn(assignZoneAdmin);
  const revokeFn = useServerFn(revokeZoneAdmin);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", "detail", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const { data: zones } = useQuery({
    queryKey: ["admin", "zones", "for-assign"],
    queryFn: () => zonesFn(),
  });
  const role = useMutation({
    mutationFn: (v: { role: "admin" | "user"; enabled: boolean }) => roleFn({ data: { userId: id, ...v } }),
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const assign = useMutation({
    mutationFn: (zoneId: string) => assignFn({ data: { userId: id, zoneId } }),
    onSuccess: () => {
      toast.success("Zone admin assigned");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: () => revokeFn({ data: { userId: id } }),
    onSuccess: () => {
      toast.success("Zone admin revoked");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isSuspended = !!(data?.user as { banned_until?: string | null } | undefined)?.banned_until
    && new Date((data!.user as { banned_until?: string }).banned_until!) > new Date();

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h2 className="text-lg font-semibold">User profile</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </header>
        {isLoading || !data ? (
          <div className="p-4"><LoadingRows rows={6} /></div>
        ) : (
          <div className="space-y-5 p-4 text-sm">
            <div className="flex items-center gap-3">
              <Avatar name={data.profile?.full_name ?? data.user?.email ?? "?"} url={data.profile?.avatar_url ?? null} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{data.profile?.full_name ?? "—"}</p>
                <p className="truncate text-xs text-neutral-500">{data.user?.email}</p>
                <p className="text-xs text-neutral-500">{data.profile?.phone ?? "No phone"}</p>
              </div>
            </div>

            <Section title="Account">
              <Row label="Joined" value={data.user?.created_at ? formatDateTime(data.user.created_at) : "—"} />
              <Row label="Last sign-in" value={data.user?.last_sign_in_at ? formatDateTime(data.user.last_sign_in_at) : "Never"} />
              <Row label="Email confirmed" value={data.user?.email_confirmed_at ? "Yes" : "No"} />
              <Row label="Status" value={isSuspended ? "Suspended" : "Active"} />
            </Section>

            <Section title="Roles">
              <div className="flex flex-wrap gap-2">
                {(["admin", "user"] as const).map((r) => {
                  const enabled = data.roles.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => role.mutate({ role: r, enabled: !enabled })}
                      disabled={role.isPending}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${enabled ? "border-violet-200 bg-violet-50 text-violet-700" : "border-neutral-200 bg-white text-neutral-600"}`}
                    >
                      {enabled ? "✓ " : ""}{r}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Zone admin">
              {data.assignedZoneId ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                  <span className="font-medium text-amber-900">
                    Scoped to {data.assignedZoneName ?? "zone"}
                  </span>
                  <button
                    onClick={() => revoke.mutate()}
                    disabled={revoke.isPending}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Revoke
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) assign.mutate(e.target.value); }}
                    disabled={assign.isPending}
                    className="h-8 flex-1 rounded-full border border-neutral-200 bg-white px-3 text-xs"
                  >
                    <option value="" disabled>Assign to a zone…</option>
                    {(zones ?? []).map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-neutral-500">
                Zone admins can only manage orders, inventory, and the zone entry for their assigned area.
              </p>
            </Section>

            <Section title="Recent orders">
              {data.orders.length === 0 ? <p className="text-xs text-neutral-500">No orders yet.</p> : (
                <ul className="space-y-2">
                  {data.orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-3 py-2">
                      <div>
                        <p className="font-medium">{o.order_number}</p>
                        <p className="text-xs text-neutral-500">{formatRelative(o.created_at)} · {o.status}</p>
                      </div>
                      <p className="text-sm font-semibold">{formatZar(Number(o.total_zar))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Recent activity">
              {data.activity.length === 0 ? <p className="text-xs text-neutral-500">No activity logged.</p> : (
                <ul className="space-y-1.5 text-xs">
                  {data.activity.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 text-neutral-600">
                      <span className="truncate">{a.action}{a.entity ? ` · ${a.entity}` : ""}</span>
                      <span className="shrink-0 text-neutral-400">{formatRelative(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
              <button
                onClick={() => onSuspend(!isSuspended)}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
              >
                {isSuspended ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                {isSuspended ? "Activate" : "Suspend"}
              </button>
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-800">{value}</span>
    </div>
  );
}