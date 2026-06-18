import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { formatRelative } from "@/lib/admin/format";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import {
  listUsers,
  listZoneAssignments,
  assignZoneAdmin,
  revokeZoneAdmin,
  type ZoneAssignmentRow,
} from "@/lib/admin/users.functions";
import { listAllZones } from "@/lib/admin/zones.functions";

export const Route = createFileRoute("/_authenticated/admin/zone-assignments")({
  beforeLoad: requireMainAdminGuard,
  head: () => ({
    meta: [{ title: "Zone Assignments — Sweet & Lovely Admin" }],
  }),
  component: ZoneAssignmentsPage,
});

function ZoneAssignmentsPage() {
  const qc = useQueryClient();
  const fetchAssignments = useServerFn(listZoneAssignments);
  const fetchZones = useServerFn(listAllZones);
  const fetchUsers = useServerFn(listUsers);

  const assignments = useQuery({
    queryKey: ["admin", "zone-assignments"],
    queryFn: () => fetchAssignments(),
  });
  const zones = useQuery({
    queryKey: ["admin", "zones-all"],
    queryFn: () => fetchZones(),
  });

  const [showAdd, setShowAdd] = useState(false);

  const assign = useMutation({
    mutationFn: useServerFn(assignZoneAdmin),
    onSuccess: () => {
      toast.success("Zone assignment saved");
      void qc.invalidateQueries({ queryKey: ["admin", "zone-assignments"] });
      setShowAdd(false);
    },
    onError: (e: Error) => toast.error("Could not assign zone", { description: e.message }),
  });

  const revoke = useMutation({
    mutationFn: useServerFn(revokeZoneAdmin),
    onSuccess: () => {
      toast.success("Assignment removed");
      void qc.invalidateQueries({ queryKey: ["admin", "zone-assignments"] });
    },
    onError: (e: Error) => toast.error("Could not remove assignment", { description: e.message }),
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users-for-assign"],
    queryFn: () => fetchUsers({ data: { search: "", role: "", page: 1, pageSize: 200 } }),
    enabled: showAdd,
  });

  const assignedUserIds = useMemo(
    () => new Set((assignments.data ?? []).map((r) => r.user_id)),
    [assignments.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Zone Assignments"
        description="Assign employee admins to a single delivery zone. Each employee is locked to one zone and only sees data, orders, and inventory movements from that zone."
        actions={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#ff003c] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#e6003a]"
          >
            <UserPlus className="h-4 w-4" />
            Assign employee
          </button>
        }
      />

      <Card>
        {assignments.isLoading ? (
          <LoadingRows rows={4} />
        ) : assignments.error ? (
          <ErrorPanel
            error={assignments.error}
            onRetry={() => void assignments.refetch()}
          />
        ) : (assignments.data ?? []).length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No zone assignments yet"
            hint="Assign an employee admin to a delivery zone to give them isolated access to that zone's orders and operations."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Assigned zone</th>
                  <th className="px-4 py-3">Granted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(assignments.data ?? []).map((row) => (
                  <AssignmentRow
                    key={`${row.user_id}-${row.zone_id}`}
                    row={row}
                    onRevoke={() => revoke.mutate({ data: { userId: row.user_id } })}
                    revoking={
                      revoke.isPending &&
                      (revoke.variables as { data: { userId: string } } | undefined)?.data
                        .userId === row.user_id
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && (
        <AssignDialog
          onClose={() => setShowAdd(false)}
          zones={zones.data ?? []}
          users={(usersQuery.data?.rows ?? []).filter((u) => !assignedUserIds.has(u.id))}
          loadingUsers={usersQuery.isLoading}
          onAssign={(userId, zoneId) => assign.mutate({ data: { userId, zoneId } })}
          submitting={assign.isPending}
        />
      )}
    </div>
  );
}

function AssignmentRow({
  row,
  onRevoke,
  revoking,
}: {
  row: ZoneAssignmentRow;
  onRevoke: () => void;
  revoking: boolean;
}) {
  return (
    <tr className="text-neutral-700">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {row.avatar_url ? (
            <img
              src={row.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
              {(row.full_name ?? row.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-neutral-900">
              {row.full_name ?? row.email ?? row.user_id}
            </p>
            {row.email && row.full_name && (
              <p className="text-xs text-neutral-500">{row.email}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
          <MapPin className="h-3 w-3" />
          {row.zone_name}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-neutral-500">{formatRelative(row.assigned_at)}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          {revoking ? "Removing…" : "Remove"}
        </button>
      </td>
    </tr>
  );
}

function AssignDialog({
  onClose,
  zones,
  users,
  loadingUsers,
  onAssign,
  submitting,
}: {
  onClose: () => void;
  zones: Awaited<ReturnType<typeof listAllZones>>;
  users: Awaited<ReturnType<typeof listUsers>>["rows"];
  loadingUsers: boolean;
  onAssign: (userId: string, zoneId: string) => void;
  submitting: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [filter, setFilter] = useState("");

  const filteredUsers = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return users;
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(f) ||
        (u.full_name ?? "").toLowerCase().includes(f),
    );
  }, [users, filter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff003c]">
              New assignment
            </p>
            <h2 className="text-base font-semibold text-neutral-900">Assign employee to a zone</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">
              Search employees
            </label>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Name or email"
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff003c]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Employee</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff003c]"
            >
              <option value="">{loadingUsers ? "Loading…" : "Select an employee"}</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.full_name || u.email || u.id) + (u.email && u.full_name ? ` · ${u.email}` : "")}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-neutral-500">
              Employees already assigned to a zone are hidden. Remove the existing assignment to
              reassign.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Delivery zone</label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff003c]"
            >
              <option value="">Select a delivery zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                  {z.is_active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!userId || !zoneId || submitting}
            onClick={() => onAssign(userId, zoneId)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ff003c] px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e6003a] disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting ? "Assigning…" : "Assign zone"}
          </button>
        </div>
      </div>
    </div>
  );
}