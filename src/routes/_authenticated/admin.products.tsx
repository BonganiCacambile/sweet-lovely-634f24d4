import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Search, Plus, X, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { formatZar } from "@/lib/admin/format";
import { listProducts, createProduct, updateProduct, deleteProduct, productSalesSummary } from "@/lib/admin/products.functions";
import { listCategories } from "@/lib/admin/categories.functions";
import { listProductSizes, saveProductSizes } from "@/lib/admin/product-sizes.functions";

export const Route = createFileRoute("/_authenticated/admin/products")({
  beforeLoad: requireMainAdminGuard,
  component: () => (
    <MainAdminGuard>
      <ProductsPage />
    </MainAdminGuard>
  ),
});

type ProductRow = Awaited<ReturnType<typeof listProducts>>["rows"][number];

function ProductsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listProducts);
  const catFn = useServerFn(listCategories);
  const salesFn = useServerFn(productSalesSummary);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin","products","list",{ search: debounced, category, active, page }],
    queryFn: () => listFn({ data: { search: debounced, category, active, page, pageSize: 25, sortBy: "sort_order", sortDir: "asc" } }),
  });
  const { data: cats } = useQuery({ queryKey: ["admin","categories","list"], queryFn: () => catFn() });
  const { data: sales } = useQuery({ queryKey: ["admin","products","sales"], queryFn: () => salesFn() });

  useRealtimeTable("products", [["admin","products","list"]]);

  const exportCols = useMemo(() => ([
    { key: "slug", label: "Slug" },
    { key: "title", label: "Title" },
    { key: "category_slug", label: "Category" },
    { key: "price_zar", label: "Price (R)", map: (r: ProductRow) => Number(r.price_zar).toFixed(2) },
    { key: "stock", label: "Stock" },
    { key: "is_active", label: "Active" },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Manage the menu, pricing, availability and inventory."
        actions={
          <>
            <ExportMenu rows={data?.rows ?? []} columns={exportCols as never} filename="products" title="Products export" />
            <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e6003a]">
              <Plus className="h-3.5 w-3.5" /> New product
            </button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search by name or slug…" className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-400" />
          </div>
          <select value={category} onChange={(e) => { setPage(1); setCategory(e.target.value); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm">
            <option value="">All categories</option>
            {cats?.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
          <select value={active} onChange={(e) => { setPage(1); setActive(e.target.value as never); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm">
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {error ? <div className="p-4"><ErrorPanel error={error} onRetry={() => void refetch()} /></div>
          : isLoading ? <LoadingRows />
          : (data?.rows.length ?? 0) === 0 ? <div className="p-6"><EmptyState icon={<Package className="h-5 w-5" />} title="No products" hint="Add your first product to get started." /></div>
          : (
            <>
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-neutral-500">
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-3 py-2 font-medium">Stock</th>
                      <th className="px-3 py-2 font-medium">Sold</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.rows.map((p) => {
                      const sold = sales?.[p.slug]?.qty ?? 0;
                      return (
                        <tr key={p.slug} className="border-t border-neutral-100">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {p.image ? <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="h-9 w-9 rounded-lg bg-neutral-100" />}
                              <div>
                                <p className="font-medium text-neutral-900">{p.title}</p>
                                <p className="text-xs text-neutral-500">{p.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-neutral-700">{p.category_slug}</td>
                          <td className="px-3 py-3 tabular-nums">{formatZar(Number(p.price_zar))}</td>
                          <td className={`px-3 py-3 tabular-nums ${p.stock <= p.low_stock_threshold ? "text-rose-600 font-medium" : ""}`}>{p.stock}</td>
                          <td className="px-3 py-3 tabular-nums text-neutral-700">{sold}</td>
                          <td className="px-3 py-3"><StatusBadge status={p.is_active ? "active" : "inactive"} /></td>
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50"><Pencil className="h-3 w-3" /> Edit</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={data!.pageSize} total={data!.total} onPage={setPage} />
            </>
          )}
      </Card>

      {editing && <ProductForm key={editing === "new" ? "new" : editing.slug} initial={editing === "new" ? null : editing} categories={cats ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProductForm({ initial, categories, onClose }: { initial: ProductRow | null; categories: { slug: string; label: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProduct);
  const updateFn = useServerFn(updateProduct);
  const deleteFn = useServerFn(deleteProduct);

  const [form, setForm] = useState({
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    price_zar: initial?.price_zar ?? 0,
    price_medium_zar: initial?.price_medium_zar ?? 80,
    price_large_zar: initial?.price_large_zar ?? 150,
    category_slug: initial?.category_slug ?? categories[0]?.slug ?? "",
    image: initial?.image ?? "",
    is_active: initial?.is_active ?? true,
    stock: initial?.stock ?? 0,
    low_stock_threshold: initial?.low_stock_threshold ?? 5,
    sort_order: initial?.sort_order ?? 0,
    ingredients: ((initial as unknown as { ingredients?: string[] } | null)?.ingredients ?? []).join("\n"),
    allergens: ((initial as unknown as { allergens?: string | null } | null)?.allergens ?? "") as string,
    calories: ((initial as unknown as { calories?: number | null } | null)?.calories ?? "") as number | "",
    fat_g: ((initial as unknown as { fat_g?: number | null } | null)?.fat_g ?? "") as number | "",
    carbs_g: ((initial as unknown as { carbs_g?: number | null } | null)?.carbs_g ?? "") as number | "",
    protein_g: ((initial as unknown as { protein_g?: number | null } | null)?.protein_g ?? "") as number | "",
    size_selection_enabled: ((initial as unknown as { size_selection_enabled?: boolean } | null)?.size_selection_enabled) ?? false,
  });

  type SizeRow = {
    id?: string;
    name: string;
    description: string;
    portion: string;
    price_zar: number;
    is_available: boolean;
  };
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const listSizesFn = useServerFn(listProductSizes);
  const saveSizesFn = useServerFn(saveProductSizes);

  useEffect(() => {
    if (!initial) return;
    void listSizesFn({ data: { product_slug: initial.slug } }).then((rows) => {
      setSizes(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? "",
          portion: r.portion ?? "",
          price_zar: Number(r.price_zar),
          is_available: r.is_available,
        })),
      );
    }).catch((e: Error) => toast.error(e.message));
  }, [initial, listSizesFn]);

  const updateSize = (i: number, patch: Partial<SizeRow>) => {
    setSizes((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const addSize = () => setSizes((cur) => [...cur, { name: "", description: "", portion: "", price_zar: 0, is_available: true }]);
  const removeSize = (i: number) => setSizes((cur) => cur.filter((_, idx) => idx !== i));
  const moveSize = (i: number, dir: -1 | 1) => setSizes((cur) => {
    const j = i + dir;
    if (j < 0 || j >= cur.length) return cur;
    const next = [...cur];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const save = useMutation({
    mutationFn: async () => {
      const isPizza = form.category_slug === "pizza";
      const ingredientsArr = form.ingredients
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const num = (v: number | "") => (v === "" ? null : Number(v));
      const payload = {
        ...form,
        price_zar: Number(form.price_zar),
        price_medium_zar: isPizza ? Number(form.price_medium_zar) : null,
        price_large_zar: isPizza ? Number(form.price_large_zar) : null,
        stock: Number(form.stock),
        low_stock_threshold: Number(form.low_stock_threshold),
        sort_order: Number(form.sort_order),
        ingredients: ingredientsArr,
        allergens: form.allergens.trim() === "" ? null : form.allergens.trim(),
        calories: num(form.calories),
        fat_g: num(form.fat_g),
        carbs_g: num(form.carbs_g),
        protein_g: num(form.protein_g),
        size_selection_enabled: form.size_selection_enabled,
      };
      const slug = initial?.slug ?? form.slug;
      if (initial) {
        const { slug, ...patch } = payload;
        void slug;
        await updateFn({ data: { original_slug: initial.slug, patch } });
      } else {
        await createFn({ data: payload });
      }
      if (form.size_selection_enabled) {
        const cleaned = sizes
          .filter((s) => s.name.trim().length > 0)
          .map((s, i) => ({
            id: s.id,
            name: s.name.trim(),
            description: s.description.trim() || null,
            portion: s.portion.trim() || null,
            price_zar: Number(s.price_zar) || 0,
            sort_order: i,
            is_available: s.is_available,
          }));
        await saveSizesFn({ data: { product_slug: slug, sizes: cleaned } });
      } else if (initial) {
        // toggle off — clear existing sizes so customers don't see the picker
        await saveSizesFn({ data: { product_slug: slug, sizes: [] } });
      }
      return { ok: true };
    },
    onSuccess: () => { toast.success(initial ? "Product updated" : "Product created"); qc.invalidateQueries({ queryKey: ["admin","products"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { slug: initial!.slug } }),
    onSuccess: () => { toast.success("Product deleted"); qc.invalidateQueries({ queryKey: ["admin","products"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-neutral-900/40" onClick={onClose} />
      <aside className="flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h2 className="text-lg font-semibold">{initial ? "Edit product" : "New product"}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </header>
        <form className="flex-1 space-y-4 p-4 text-sm" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Slug" disabled={!!initial}><input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} pattern="[a-z0-9-]+" className="input" disabled={!!initial} /></Field>
          <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" /></Field>
          <Field label="Description"><textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (R)"><input type="number" step="0.01" min={0} required value={form.price_zar} onChange={(e) => setForm({ ...form, price_zar: Number(e.target.value) })} className="input" /></Field>
            <Field label="Category">
              <select value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })} className="input">
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Stock"><input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="input" /></Field>
            <Field label="Low-stock threshold"><input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} className="input" /></Field>
            <Field label="Sort order"><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="input" /></Field>
          </div>
          {form.category_slug === "pizza" && (
            <div className="rounded-2xl border border-dashed border-[#ff003c]/30 bg-[#fff5f7]/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#ff003c]">Pizza size prices</p>
              <p className="mb-3 text-xs text-neutral-600">Shown in the customer size picker. Leave defaults if unsure.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label='Medium (10") price (R)'>
                  <input type="number" step="0.01" min={0} value={form.price_medium_zar ?? 0} onChange={(e) => setForm({ ...form, price_medium_zar: Number(e.target.value) })} className="input" />
                </Field>
                <Field label='Large (14") price (R)'>
                  <input type="number" step="0.01" min={0} value={form.price_large_zar ?? 0} onChange={(e) => setForm({ ...form, price_large_zar: Number(e.target.value) })} className="input" />
                </Field>
              </div>
            </div>
          )}
          <Field label="Image URL"><input value={form.image ?? ""} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" className="input" /></Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active (visible to customers)</label>

          <fieldset className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">Ingredients</legend>
            <p className="text-xs text-neutral-500">One ingredient per line (or comma-separated). Shown to customers on the menu.</p>
            <textarea rows={4} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} placeholder={"Mozzarella\nMarinara sauce\nBasil"} className="input" />
          </fieldset>

          <fieldset className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">Nutritional information (per serving)</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories (kcal)"><input type="number" min={0} value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value === "" ? "" : Number(e.target.value) })} className="input" /></Field>
              <Field label="Fat (g)"><input type="number" step="0.1" min={0} value={form.fat_g} onChange={(e) => setForm({ ...form, fat_g: e.target.value === "" ? "" : Number(e.target.value) })} className="input" /></Field>
              <Field label="Carbs (g)"><input type="number" step="0.1" min={0} value={form.carbs_g} onChange={(e) => setForm({ ...form, carbs_g: e.target.value === "" ? "" : Number(e.target.value) })} className="input" /></Field>
              <Field label="Protein (g)"><input type="number" step="0.1" min={0} value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: e.target.value === "" ? "" : Number(e.target.value) })} className="input" /></Field>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">Allergens</legend>
            <p className="text-xs text-neutral-500">Comma-separated (e.g. "Dairy, Gluten, Nuts").</p>
            <input value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })} placeholder="Dairy, Gluten" className="input" />
          </fieldset>

          <div className="flex items-center justify-between gap-2 pt-2">
            {initial ? (
              <button type="button" onClick={() => { if (confirm("Delete this product?")) remove.mutate(); }} disabled={remove.isPending} className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs">Cancel</button>
              <button type="submit" disabled={save.isPending} className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e6003a] disabled:opacity-60">{save.isPending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </form>
      </aside>

      <style>{`.input{display:block;width:100%;border-radius:0.75rem;border:1px solid #e5e5e5;padding:0.5rem 0.75rem;font-size:0.875rem;background:#fff} .input:focus{outline:none;border-color:#a3a3a3} .input:disabled{background:#f5f5f5;color:#737373}`}</style>
    </div>
  );
}

function Field({ label, children, disabled }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-medium ${disabled ? "text-neutral-400" : "text-neutral-600"}`}>{label}</span>
      {children}
    </label>
  );
}