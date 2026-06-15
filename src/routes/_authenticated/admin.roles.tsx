import { Fragment, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, LoadingRows } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { formatRelative } from "@/lib/admin/format";
import { getRoleMatrix, setRolePermission, listRoleAssignments } from "@/lib/admin/roles.functions";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesPage,
});

function RolesPage() {
  const qc = useQueryClient();
  const matrixFn = useServerFn(getRoleMatrix);
  const setFn = useServerFn(setRolePermission);
  const assignFn = useServerFn(listRoleAssignments);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "roles", "matrix"],
    queryFn: () => matrixFn(),
    refetchOnWindowFocus: true,
  });
  const { data: assignments } = useQuery({
    queryKey: ["admin", "roles", "assignments"],
    queryFn: () => assignFn(),
    refetchOnWindowFocus: true,
  });

  const mutate = useMutation({
    mutationFn: (v: { role: "admin" | "user"; permission: string; enabled: boolean }) =>
      setFn({ data: v as never }),
    onSuccess: () => { toast.success("Permission updated"); qc.invalidateQueries({ queryKey: ["admin", "roles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    if (!data) return [];
    const groups: Record<string, string[]> = {};
    for (const p of data.permissions) {
      const [g] = p.split(".");
      (groups[g] ??= []).push(p);
    }
    return Object.entries(groups);
  }, [data]);

  const exportCols = useMemo(() => ([
    { key: "email", label: "Email" },
    { key: "full_name", label: "Name" },
    { key: "role", label: "Role" },
    { key: "created_at", label: "Granted" },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access control"
        title="Roles & permissions"
        description="Define what each role can do across the admin surface."
      />

      <Card>
        <div className="flex items-center justify-between border-b border-neutral-100 p-4">
          <div>
            <h2 className="text-base font-semibold">Permission matrix</h2>
            <p className="text-xs text-neutral-500">Click a cell to grant or revoke a permission for that role.</p>
          </div>
        </div>
        {isLoading || !data ? (
          <LoadingRows rows={8} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-2 font-medium">Permission</th>
                  {data.roles.map((r) => (
                    <th key={r} className="px-4 py-2 text-center font-medium">
                      <span className="inline-flex items-center gap-1">
                        {r === "admin" && <ShieldCheck className="h-3.5 w-3.5 text-violet-600" />}
                        {r}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map(([group, perms]) => (
                  <Fragment key={group}>
                    <tr className="bg-neutral-50/40">
                      <td colSpan={data.roles.length + 1} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{group}</td>
                    </tr>
                    {perms.map((p) => (
                      <tr key={p} className="border-b border-neutral-50 last:border-b-0">
                        <td className="px-4 py-2 text-sm text-neutral-700">{p}</td>
                        {data.roles.map((role) => {
                          const enabled = !!data.matrix[role]?.[p];
                          return (
                            <td key={role} className="px-4 py-2 text-center">
                              <button
                                disabled={mutate.isPending}
                                onClick={() => mutate.mutate({ role: role as "admin" | "user", permission: p, enabled: !enabled })}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${enabled ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-neutral-200 bg-white text-neutral-300 hover:bg-neutral-50"}`}
                              >
                                {enabled ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-neutral-100 p-4">
          <div>
            <h2 className="text-base font-semibold">Current role assignments</h2>
            <p className="text-xs text-neutral-500">Users who have been granted a role.</p>
          </div>
          <ExportMenu rows={assignments ?? []} columns={exportCols as never} filename="role-assignments" title="Role assignments" />
        </div>
        {!assignments ? (
          <LoadingRows rows={3} />
        ) : assignments.length === 0 ? (
          <div className="p-6"><EmptyState title="No assignments yet" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50/70 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Granted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {assignments.map((r) => (
                <tr key={`${r.user_id}-${r.role}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{r.full_name ?? "—"}</p>
                    <p className="text-xs text-neutral-500">{r.email ?? r.user_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${r.role === "admin" ? "bg-violet-50 text-violet-700" : "bg-neutral-100 text-neutral-700"}`}>
                      {r.role === "admin" && <ShieldCheck className="h-3 w-3" />} {r.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{formatRelative(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}