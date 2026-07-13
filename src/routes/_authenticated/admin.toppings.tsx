import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import {
  listAllToppings,
  createTopping,
  updateTopping,
  deleteTopping,
} from "@/lib/admin/toppings.functions";

export const Route = createFileRoute("/_authenticated/admin/toppings")({
  beforeLoad: requireMainAdminGuard,
  component: () => (
    <MainAdminGuard>
      <ToppingsPage />
    </MainAdminGuard>
  ),
});

type ToppingRow = Awaited<ReturnType<typeof listAllToppings>>[number];

function ToppingsPage() {
  const [editing, setEditing] = useState<ToppingRow | "new" | null>(null);
  const qc = useQueryClient();
  const listFn = useServerFn(listAllToppings);
  const updateFn = useServerFn(updateTopping);
  const deleteFn = useServerFn(deleteTopping);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "toppings"],
    queryFn: () => listFn(),
  });

  const toggleAvailable = useMutation({
    mutationFn: (row: ToppingRow) =>
      updateFn({ data: { id: row.id, patch: { is_available: !row.is_available } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "toppings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleActive = useMutation({
    mutationFn: (row: ToppingRow) =>
      updateFn({ data: { id: row.id, patch: { is_active: !row.is_active } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "toppings"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (row: ToppingRow) => deleteFn({ data: { id: row.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "toppings"] });
      toast.success("Topping removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Menu"
        title="Pizza toppings"
        actions={
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" /> New topping
          </button>
        }
      />
      <Card>
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorPanel error={error as Error} onRetry={refetch} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No toppings yet" hint="Add your first pizza topping to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-neutral-500">
                <tr className="border-b border-neutral-100">
                  <th className="px-3 py-2 text-left">Topping</th>
                  <th className="px-3 py-2 text-left">Price</th>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Available</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 overflow-hidden rounded-full bg-[#fff5f7] ring-1 ring-neutral-100">
                          {row.image_url ? (
                            <img src={row.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm">🧀</div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-neutral-500">{row.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">R{Number(row.price_zar).toFixed(2)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.display_order}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleAvailable.mutate(row)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_available ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
                      >
                        {row.is_available ? "In stock" : "Unavailable"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleActive.mutate(row)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}
                      >
                        {row.is_active ? "Visible" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setEditing(row)}
                        className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${row.name}?`)) del.mutate(row);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <ToppingEditor
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin", "toppings"] });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ToppingEditor({
  row,
  onClose,
  onSaved,
}: {
  row: ToppingRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const createFn = useServerFn(createTopping);
  const updateFn = useServerFn(updateTopping);
  const [form, setForm] = useState({
    name: row?.name ?? "",
    slug: row?.slug ?? "",
    price_zar: Number(row?.price_zar ?? 0),
    image_url: row?.image_url ?? "",
    is_active: row?.is_active ?? true,
    is_available: row?.is_available ?? true,
    display_order: row?.display_order ?? 100,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        price_zar: Number(form.price_zar),
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
        is_available: form.is_available,
        display_order: Number(form.display_order),
      };
      if (row) await updateFn({ data: { id: row.id, patch: payload } });
      else await createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(row ? "Topping updated" : "Topping created");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{row ? "Edit topping" : "New topping"}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </Field>
          <Field label="Slug">
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </Field>
          <Field label="Price (R)">
            <input
              type="number"
              step="0.01"
              value={form.price_zar}
              onChange={(e) => setForm({ ...form, price_zar: Number(e.target.value) })}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </Field>
          <Field label="Display order">
            <input
              type="number"
              value={form.display_order}
              onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Image URL">
              <input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2"
              />
            </Field>
          </div>
          <label className="col-span-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active (visible)
          </label>
          <label className="col-span-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
            />
            In stock
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-neutral-200 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="rounded-full bg-[#ff003c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6003a] disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
    </label>
  );
}