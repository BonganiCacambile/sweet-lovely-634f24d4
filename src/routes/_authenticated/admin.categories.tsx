import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tags, Plus, X, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { listCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from "@/lib/admin/categories.functions";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesPage,
});

type CatRow = Awaited<ReturnType<typeof listCategories>>[number];

function CategoriesPage() {
  const [editing, setEditing] = useState<CatRow | "new" | null>(null);
  const qc = useQueryClient();
  const listFn = useServerFn(listCategories);
  const reorderFn = useServerFn(reorderCategories);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin","categories","list"], queryFn: () => listFn() });

  const reorder = useMutation({
    mutationFn: (slugs: string[]) => reorderFn({ data: { slugs } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin","categories"] }); toast.success("Order saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (idx: number, dir: -1 | 1) => {
    if (!data) return;
    const next = [...data];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    reorder.mutate(next.map((c) => c.slug));
  };

  const exportCols = useMemo(() => ([
    { key: "slug", label: "Slug" },
    { key: "label", label: "Label" },
    { key: "product_count", label: "Products" },
    { key: "sort_order", label: "Order" },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Categories"
        description="Organise the menu into curated categories with custom ordering."
        actions={
          <>
            <ExportMenu rows={data ?? []} columns={exportCols as never} filename="categories" />
            <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e6003a]"><Plus className="h-3.5 w-3.5" /> New category</button>
          </>
        }
      />
      <Card>
        {error ? <div className="p-4"><ErrorPanel error={error} onRetry={() => void refetch()} /></div>
          : isLoading ? <LoadingRows />
          : (data?.length ?? 0) === 0 ? <div className="p-6"><EmptyState icon={<Tags className="h-5 w-5" />} title="No categories yet" /></div>
          : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Slug</th>
                    <th className="px-3 py-2 font-medium">Products</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.map((c, idx) => (
                    <tr key={c.slug} className="border-t border-neutral-100">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded-md p-1 hover:bg-neutral-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button onClick={() => move(idx, 1)} disabled={idx === data!.length - 1} className="rounded-md p-1 hover:bg-neutral-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                          <span className="ml-1 text-xs text-neutral-500">{c.sort_order}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {c.image ? <img src={c.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="h-9 w-9 rounded-lg bg-neutral-100" />}
                          <span className="font-medium">{c.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-neutral-500">{c.slug}</td>
                      <td className="px-3 py-3 tabular-nums">{c.product_count}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => setEditing(c)} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50"><Pencil className="h-3 w-3" /> Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {editing && <CategoryForm key={editing === "new" ? "new" : editing.slug} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryForm({ initial, onClose }: { initial: CatRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createCategory);
  const updateFn = useServerFn(updateCategory);
  const deleteFn = useServerFn(deleteCategory);
  const [form, setForm] = useState({ slug: initial?.slug ?? "", label: initial?.label ?? "", image: initial?.image ?? "", intro: initial?.intro ?? "", sort_order: initial?.sort_order ?? 0 });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, sort_order: Number(form.sort_order) };
      if (initial) {
        const { slug, ...patch } = payload; void slug;
        return updateFn({ data: { original_slug: initial.slug, patch } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => { toast.success(initial ? "Updated" : "Created"); qc.invalidateQueries({ queryKey: ["admin","categories"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { slug: initial!.slug } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin","categories"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-neutral-900/40" onClick={onClose} />
      <aside className="flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h2 className="text-lg font-semibold">{initial ? "Edit category" : "New category"}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </header>
        <form className="flex-1 space-y-3 p-4 text-sm" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Slug</span><input required disabled={!!initial} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} pattern="[a-z0-9-]+" className="w-full rounded-xl border border-neutral-200 px-3 py-2 disabled:bg-neutral-50" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Label</span><input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Image URL</span><input value={form.image ?? ""} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Intro</span><textarea rows={3} value={form.intro ?? ""} onChange={(e) => setForm({ ...form, intro: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Sort order</span><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full rounded-xl border border-neutral-200 px-3 py-2" /></label>
          <div className="flex items-center justify-between gap-2 pt-2">
            {initial ? (
              <button type="button" onClick={() => { if (confirm("Delete this category? Products must be re-assigned first.")) remove.mutate(); }} disabled={remove.isPending} className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs">Cancel</button>
              <button type="submit" disabled={save.isPending} className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e6003a] disabled:opacity-60">{save.isPending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}