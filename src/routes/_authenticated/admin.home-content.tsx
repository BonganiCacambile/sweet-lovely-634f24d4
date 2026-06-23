import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { useAuth } from "@/lib/auth-context";
import {
  listPopularItems, upsertPopularItem, deletePopularItem,
  listHotDeals, upsertHotDeal, deleteHotDeal,
  listSpecials, upsertSpecial, deleteSpecial,
  listBanners, upsertBanner, deleteBanner,
  reorderHomeContent,
  listSectionVisibility, setSectionVisibility,
  getHomeAnalytics,
  listProductPicker, listZonesForPicker,
} from "@/lib/admin/home-content.functions";

export const Route = createFileRoute("/_authenticated/admin/home-content")({
  component: HomeContentPage,
});

type Tab = "popular" | "hot_deals" | "specials" | "banners" | "visibility" | "analytics";

function HomeContentPage() {
  const [tab, setTab] = useState<Tab>("popular");
  const { isMainAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Home Page"
        title="Home Content Manager"
        description="Curate Popular Items, Hot Deals, Specials, and Banners that appear on the customer home page. Changes propagate live."
      />

      <div className="flex flex-wrap items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 text-xs">
        {([
          ["popular", "Popular Items"],
          ["hot_deals", "Hot Deals"],
          ["specials", "Specials & Featured"],
          ["banners", "Banners"],
          ["visibility", "Section Visibility"],
          ["analytics", "Analytics"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 font-medium transition ${
              tab === k ? "bg-[#ff003c] text-white" : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "popular" && <PopularTab isMain={isMainAdmin} />}
      {tab === "hot_deals" && <HotDealsTab isMain={isMainAdmin} />}
      {tab === "specials" && <SpecialsTab isMain={isMainAdmin} />}
      {tab === "banners" && <BannersTab isMain={isMainAdmin} />}
      {tab === "visibility" && <VisibilityTab isMain={isMainAdmin} />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}

/* ----------------------------- shared ----------------------------- */

function useZonesAndProducts() {
  const zonesFn = useServerFn(listZonesForPicker);
  const prodFn = useServerFn(listProductPicker);
  const { data: zones } = useQuery({ queryKey: ["admin","home","zones"], queryFn: () => zonesFn() });
  const { data: products } = useQuery({ queryKey: ["admin","home","products"], queryFn: () => prodFn() });
  return { zones: zones ?? [], products: products ?? [] };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#ff003c] focus:outline-none";

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function RowActions<T extends { id: string; position?: number; is_active: boolean }>({
  row, rows, table, onEdit, onDelete, onToggle,
}: {
  row: T; rows: T[]; table: "home_popular_items" | "home_hot_deals" | "home_specials" | "home_banners";
  onEdit: () => void; onDelete: () => void; onToggle: () => void;
}) {
  const qc = useQueryClient();
  const reorderFn = useServerFn(reorderHomeContent);
  const move = useMutation({
    mutationFn: (dir: -1 | 1) => {
      const sorted = [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const idx = sorted.findIndex((r) => r.id === row.id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= sorted.length) return Promise.resolve({ ok: true });
      const other = sorted[swapIdx];
      return reorderFn({ data: { table, items: [
        { id: row.id, position: other.position ?? 0 },
        { id: other.id, position: row.position ?? 0 },
      ] } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin","home"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => move.mutate(-1)} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100" title="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
      <button onClick={() => move.mutate(1)} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100" title="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
      <button onClick={onToggle} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100" title={row.is_active ? "Deactivate" : "Activate"}>
        {row.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onEdit} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
      <button onClick={onDelete} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

/* ----------------------------- POPULAR ----------------------------- */

type PopularRow = Awaited<ReturnType<typeof listPopularItems>>["rows"][number];

function PopularTab({ isMain }: { isMain: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPopularItems);
  const delFn = useServerFn(deletePopularItem);
  const upFn = useServerFn(upsertPopularItem);
  const { products, zones } = useZonesAndProducts();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin","home","popular"],
    queryFn: () => listFn(),
  });
  useRealtimeTable("home_popular_items", [["admin","home","popular"]]);
  const [editing, setEditing] = useState<PopularRow | "new" | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin","home"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const toggle = useMutation({
    mutationFn: (r: PopularRow) => upFn({ data: { ...r, is_active: !r.is_active } as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin","home"] }),
  });

  const rows = data?.rows ?? [];
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-500">{rows.length} item(s)</p>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e6002f]">
          <Plus className="h-3.5 w-3.5" /> Add popular item
        </button>
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorPanel error={error} onRetry={refetch} /> : rows.length === 0 ? (
        <EmptyState icon={<Home className="h-5 w-5" />} title="No popular items yet" hint="Add items to feature them in the Fan Favorites section." />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr><th className="px-4 py-2 text-left">Pos</th><th className="px-4 py-2 text-left">Item</th><th className="px-4 py-2 text-left">Price</th><th className="px-4 py-2 text-left">Category</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {[...rows].sort((a,b)=>(a.position??0)-(b.position??0)).map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="px-4 py-3 text-neutral-500">{r.position}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.image_url && <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                    <div><p className="font-medium">{r.title}</p>{r.description && <p className="text-xs text-neutral-500 line-clamp-1">{r.description}</p>}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-700">{r.price ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-500">{r.category ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <RowActions row={r} rows={rows} table="home_popular_items"
                      onEdit={() => setEditing(r)}
                      onDelete={() => { if (confirm("Delete this item?")) del.mutate(r.id); }}
                      onToggle={() => toggle.mutate(r)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New popular item" : "Edit popular item"}>
        {editing !== null && (
          <PopularForm
            initial={editing === "new" ? null : editing}
            products={products}
            zones={zones}
            isMain={isMain}
            onSubmit={(payload) => upFn({ data: payload as never }).then(() => {
              toast.success("Saved");
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["admin","home"] });
            }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))}
          />
        )}
      </Drawer>
    </Card>
  );
}

function PopularForm({ initial, products, zones, isMain, onSubmit }: {
  initial: PopularRow | null;
  products: Array<{ slug: string; title: string; price_zar: number; image: string | null }>;
  zones: Array<{ id: string; name: string }>;
  isMain: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    id: initial?.id, title: initial?.title ?? "", description: initial?.description ?? "",
    image_url: initial?.image_url ?? "", price: initial?.price ?? "",
    product_slug: initial?.product_slug ?? "", category: initial?.category ?? "",
    zone_id: initial?.zone_id ?? "", position: initial?.position ?? 0,
    is_active: initial?.is_active ?? true,
    starts_at: initial?.starts_at?.slice(0,16) ?? "", ends_at: initial?.ends_at?.slice(0,16) ?? "",
  });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({
      ...f,
      product_slug: f.product_slug || null, image_url: f.image_url || null,
      description: f.description || null, price: f.price || null, category: f.category || null,
      zone_id: f.zone_id || null,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    }); }}>
      <Field label="Title"><input required className={inputCls} value={f.title} onChange={(e) => setF({...f, title: e.target.value})} /></Field>
      <Field label="Link to product (optional)">
        <select className={inputCls} value={f.product_slug ?? ""} onChange={(e) => {
          const p = products.find(p => p.slug === e.target.value);
          setF({ ...f, product_slug: e.target.value, ...(p ? { title: f.title || p.title, image_url: f.image_url || p.image || "", price: f.price || `R${Number(p.price_zar).toFixed(2)}` } : {}) });
        }}>
          <option value="">— None —</option>
          {products.map(p => <option key={p.slug} value={p.slug}>{p.title}</option>)}
        </select>
      </Field>
      <Field label="Description"><textarea rows={2} className={inputCls} value={f.description ?? ""} onChange={(e) => setF({...f, description: e.target.value})} /></Field>
      <Field label="Image URL"><input className={inputCls} value={f.image_url ?? ""} onChange={(e) => setF({...f, image_url: e.target.value})} placeholder="https://…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price label"><input className={inputCls} value={f.price ?? ""} onChange={(e) => setF({...f, price: e.target.value})} placeholder="R80" /></Field>
        <Field label="Category"><input className={inputCls} value={f.category ?? ""} onChange={(e) => setF({...f, category: e.target.value})} placeholder="Pizza" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Position"><input type="number" min={0} className={inputCls} value={f.position ?? 0} onChange={(e) => setF({...f, position: Number(e.target.value)})} /></Field>
        {isMain && (
          <Field label="Delivery zone">
            <select className={inputCls} value={f.zone_id ?? ""} onChange={(e) => setF({...f, zone_id: e.target.value})}>
              <option value="">All zones</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts at"><input type="datetime-local" className={inputCls} value={f.starts_at ?? ""} onChange={(e) => setF({...f, starts_at: e.target.value})} /></Field>
        <Field label="Ends at"><input type="datetime-local" className={inputCls} value={f.ends_at ?? ""} onChange={(e) => setF({...f, ends_at: e.target.value})} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.is_active} onChange={(e) => setF({...f, is_active: e.target.checked})} /> Active
      </label>
      <button type="submit" className="w-full rounded-xl bg-[#ff003c] py-2.5 text-sm font-semibold text-white hover:bg-[#e6002f]">Save</button>
    </form>
  );
}

/* ----------------------------- HOT DEALS ----------------------------- */

type DealRow = Awaited<ReturnType<typeof listHotDeals>>["rows"][number];

function HotDealsTab({ isMain }: { isMain: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listHotDeals);
  const delFn = useServerFn(deleteHotDeal);
  const upFn = useServerFn(upsertHotDeal);
  const { products, zones } = useZonesAndProducts();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin","home","deals"], queryFn: () => listFn() });
  useRealtimeTable("home_hot_deals", [["admin","home","deals"]]);
  const [editing, setEditing] = useState<DealRow | "new" | null>(null);

  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin","home"] }); } });
  const toggle = useMutation({ mutationFn: (r: DealRow) => upFn({ data: { ...r, is_active: !r.is_active } as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin","home"] }) });

  const rows = data?.rows ?? [];
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-500">{rows.length} deal(s)</p>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Add hot deal</button>
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorPanel error={error} onRetry={refetch} /> : rows.length === 0 ? (
        <EmptyState title="No hot deals yet" />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr><th className="px-4 py-2 text-left">Pos</th><th className="px-4 py-2 text-left">Deal</th><th className="px-4 py-2 text-left">Original</th><th className="px-4 py-2 text-left">Now</th><th className="px-4 py-2 text-left">Save</th><th className="px-4 py-2 text-left">Window</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-right"></th></tr>
          </thead>
          <tbody>
            {[...rows].sort((a,b)=>(a.position??0)-(b.position??0)).map((r) => {
              const savings = r.original_price && r.discounted_price ? Number(r.original_price) - Number(r.discounted_price) : null;
              return (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 text-neutral-500">{r.position}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {r.image_url && <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                      <div><p className="font-medium">{r.title}</p>{r.label && <p className="text-xs text-[#ff003c]">{r.label}</p>}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 line-through text-neutral-400">{r.original_price ? `R${Number(r.original_price).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 font-semibold">{r.discounted_price ? `R${Number(r.discounted_price).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-emerald-700">{savings ? `R${savings.toFixed(2)}` : (r.discount_pct ? `${r.discount_pct}%` : "—")}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{r.ends_at ? `until ${new Date(r.ends_at).toLocaleDateString()}` : "always"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>{r.is_active ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3"><div className="flex justify-end"><RowActions row={r} rows={rows} table="home_hot_deals"
                    onEdit={() => setEditing(r)} onDelete={() => { if (confirm("Delete?")) del.mutate(r.id); }} onToggle={() => toggle.mutate(r)} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New hot deal" : "Edit hot deal"}>
        {editing !== null && <DealForm initial={editing === "new" ? null : editing} products={products} zones={zones} isMain={isMain}
          onSubmit={(p) => upFn({ data: p as never }).then(() => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin","home"] }); }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))} />}
      </Drawer>
    </Card>
  );
}

function DealForm({ initial, products, zones, isMain, onSubmit }: {
  initial: DealRow | null;
  products: Array<{ slug: string; title: string; price_zar: number; image: string | null }>;
  zones: Array<{ id: string; name: string }>;
  isMain: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    id: initial?.id, title: initial?.title ?? "", description: initial?.description ?? "",
    image_url: initial?.image_url ?? "", product_slug: initial?.product_slug ?? "",
    original_price: initial?.original_price ?? "", discounted_price: initial?.discounted_price ?? "",
    discount_pct: initial?.discount_pct ?? "", label: initial?.label ?? "",
    zone_id: initial?.zone_id ?? "", position: initial?.position ?? 0,
    is_active: initial?.is_active ?? true,
    starts_at: initial?.starts_at?.slice(0,16) ?? "", ends_at: initial?.ends_at?.slice(0,16) ?? "",
  });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({
      ...f, product_slug: f.product_slug || null, image_url: f.image_url || null,
      description: f.description || null, label: f.label || null, zone_id: f.zone_id || null,
      original_price: f.original_price === "" ? null : Number(f.original_price),
      discounted_price: f.discounted_price === "" ? null : Number(f.discounted_price),
      discount_pct: f.discount_pct === "" ? null : Number(f.discount_pct),
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    }); }}>
      <Field label="Title"><input required className={inputCls} value={f.title} onChange={(e) => setF({...f, title: e.target.value})} /></Field>
      <Field label="Link to product (optional)">
        <select className={inputCls} value={f.product_slug ?? ""} onChange={(e) => {
          const p = products.find(p => p.slug === e.target.value);
          setF({ ...f, product_slug: e.target.value, ...(p ? { title: f.title || p.title, image_url: f.image_url || p.image || "", original_price: f.original_price || p.price_zar } : {}) });
        }}>
          <option value="">— None —</option>
          {products.map(p => <option key={p.slug} value={p.slug}>{p.title}</option>)}
        </select>
      </Field>
      <Field label="Description"><textarea rows={2} className={inputCls} value={f.description ?? ""} onChange={(e) => setF({...f, description: e.target.value})} /></Field>
      <Field label="Image URL"><input className={inputCls} value={f.image_url ?? ""} onChange={(e) => setF({...f, image_url: e.target.value})} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Original (R)"><input type="number" step="0.01" className={inputCls} value={f.original_price as never} onChange={(e) => setF({...f, original_price: e.target.value as never})} /></Field>
        <Field label="Now (R)"><input type="number" step="0.01" className={inputCls} value={f.discounted_price as never} onChange={(e) => setF({...f, discounted_price: e.target.value as never})} /></Field>
        <Field label="Discount %"><input type="number" min={0} max={100} className={inputCls} value={f.discount_pct as never} onChange={(e) => setF({...f, discount_pct: e.target.value as never})} /></Field>
      </div>
      <Field label="Promotional label"><input className={inputCls} value={f.label ?? ""} onChange={(e) => setF({...f, label: e.target.value})} placeholder="Limited time" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Position"><input type="number" min={0} className={inputCls} value={f.position} onChange={(e) => setF({...f, position: Number(e.target.value)})} /></Field>
        {isMain && (
          <Field label="Delivery zone">
            <select className={inputCls} value={f.zone_id ?? ""} onChange={(e) => setF({...f, zone_id: e.target.value})}>
              <option value="">All zones</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts at"><input type="datetime-local" className={inputCls} value={f.starts_at} onChange={(e) => setF({...f, starts_at: e.target.value})} /></Field>
        <Field label="Ends at"><input type="datetime-local" className={inputCls} value={f.ends_at} onChange={(e) => setF({...f, ends_at: e.target.value})} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({...f, is_active: e.target.checked})} /> Active</label>
      <button type="submit" className="w-full rounded-xl bg-[#ff003c] py-2.5 text-sm font-semibold text-white">Save</button>
    </form>
  );
}

/* ----------------------------- SPECIALS ----------------------------- */

type SpecialRow = Awaited<ReturnType<typeof listSpecials>>["rows"][number];

function SpecialsTab({ isMain }: { isMain: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSpecials);
  const delFn = useServerFn(deleteSpecial);
  const upFn = useServerFn(upsertSpecial);
  const { products, zones } = useZonesAndProducts();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin","home","specials"], queryFn: () => listFn() });
  useRealtimeTable("home_specials", [["admin","home","specials"]]);
  const [editing, setEditing] = useState<SpecialRow | "new" | null>(null);

  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin","home"] }); } });
  const toggle = useMutation({ mutationFn: (r: SpecialRow) => upFn({ data: { ...r, is_active: !r.is_active } as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin","home"] }) });

  const rows = data?.rows ?? [];
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-500">{rows.length} item(s) — includes Specials, Featured, Seasonal, Combos & Meal deals</p>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Add special</button>
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorPanel error={error} onRetry={refetch} /> : rows.length === 0 ? (
        <EmptyState title="No specials yet" />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr><th className="px-4 py-2 text-left">Pos</th><th className="px-4 py-2 text-left">Special</th><th className="px-4 py-2 text-left">Kind</th><th className="px-4 py-2 text-left">Price</th><th className="px-4 py-2 text-left">Items</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-right"></th></tr>
          </thead>
          <tbody>
            {[...rows].sort((a,b)=>(a.position??0)-(b.position??0)).map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="px-4 py-3 text-neutral-500">{r.position}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2">{r.image_url && <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}<p className="font-medium">{r.title}</p></div></td>
                <td className="px-4 py-3 text-xs"><span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{r.kind}</span></td>
                <td className="px-4 py-3">{r.price ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">{(r.product_slugs ?? []).length} linked</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>{r.is_active ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-3"><div className="flex justify-end"><RowActions row={r} rows={rows} table="home_specials"
                  onEdit={() => setEditing(r)} onDelete={() => { if (confirm("Delete?")) del.mutate(r.id); }} onToggle={() => toggle.mutate(r)} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New special" : "Edit special"}>
        {editing !== null && <SpecialForm initial={editing === "new" ? null : editing} products={products} zones={zones} isMain={isMain}
          onSubmit={(p) => upFn({ data: p as never }).then(() => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin","home"] }); }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))} />}
      </Drawer>
    </Card>
  );
}

function SpecialForm({ initial, products, zones, isMain, onSubmit }: {
  initial: SpecialRow | null;
  products: Array<{ slug: string; title: string; price_zar: number; image: string | null }>;
  zones: Array<{ id: string; name: string }>;
  isMain: boolean;
  onSubmit: (p: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    id: initial?.id, title: initial?.title ?? "", description: initial?.description ?? "",
    image_url: initial?.image_url ?? "", price: initial?.price ?? "",
    product_slugs: initial?.product_slugs ?? [], kind: initial?.kind ?? "special",
    zone_id: initial?.zone_id ?? "", position: initial?.position ?? 0,
    is_active: initial?.is_active ?? true,
    starts_at: initial?.starts_at?.slice(0,16) ?? "", ends_at: initial?.ends_at?.slice(0,16) ?? "",
  });
  function toggleSlug(slug: string) {
    setF((cur) => ({ ...cur, product_slugs: cur.product_slugs.includes(slug) ? cur.product_slugs.filter(s => s !== slug) : [...cur.product_slugs, slug] }));
  }
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({
      ...f, image_url: f.image_url || null, description: f.description || null, price: f.price || null,
      zone_id: f.zone_id || null,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    }); }}>
      <Field label="Title"><input required className={inputCls} value={f.title} onChange={(e) => setF({...f, title: e.target.value})} /></Field>
      <Field label="Kind">
        <select className={inputCls} value={f.kind} onChange={(e) => setF({...f, kind: e.target.value as never})}>
          <option value="special">Special</option><option value="featured">Featured</option><option value="combo">Combo</option><option value="meal_deal">Meal deal</option><option value="seasonal">Seasonal campaign</option>
        </select>
      </Field>
      <Field label="Description"><textarea rows={2} className={inputCls} value={f.description ?? ""} onChange={(e) => setF({...f, description: e.target.value})} /></Field>
      <Field label="Image URL"><input className={inputCls} value={f.image_url ?? ""} onChange={(e) => setF({...f, image_url: e.target.value})} /></Field>
      <Field label="Price label"><input className={inputCls} value={f.price ?? ""} onChange={(e) => setF({...f, price: e.target.value})} placeholder="R220" /></Field>
      <Field label={`Linked products (${f.product_slugs.length})`}>
        <div className="max-h-40 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-xs">
          {products.map(p => (
            <label key={p.slug} className="flex items-center gap-2 py-1">
              <input type="checkbox" checked={f.product_slugs.includes(p.slug)} onChange={() => toggleSlug(p.slug)} />
              <span>{p.title}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Position"><input type="number" min={0} className={inputCls} value={f.position} onChange={(e) => setF({...f, position: Number(e.target.value)})} /></Field>
        {isMain && (
          <Field label="Delivery zone">
            <select className={inputCls} value={f.zone_id ?? ""} onChange={(e) => setF({...f, zone_id: e.target.value})}>
              <option value="">All zones</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts at"><input type="datetime-local" className={inputCls} value={f.starts_at} onChange={(e) => setF({...f, starts_at: e.target.value})} /></Field>
        <Field label="Ends at"><input type="datetime-local" className={inputCls} value={f.ends_at} onChange={(e) => setF({...f, ends_at: e.target.value})} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({...f, is_active: e.target.checked})} /> Active</label>
      <button type="submit" className="w-full rounded-xl bg-[#ff003c] py-2.5 text-sm font-semibold text-white">Save</button>
    </form>
  );
}

/* ----------------------------- BANNERS ----------------------------- */

type BannerRow = Awaited<ReturnType<typeof listBanners>>["rows"][number];

function BannersTab({ isMain }: { isMain: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listBanners);
  const delFn = useServerFn(deleteBanner);
  const upFn = useServerFn(upsertBanner);
  const { zones } = useZonesAndProducts();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin","home","banners"], queryFn: () => listFn() });
  useRealtimeTable("home_banners", [["admin","home","banners"]]);
  const [editing, setEditing] = useState<BannerRow | "new" | null>(null);

  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin","home"] }); } });
  const toggle = useMutation({ mutationFn: (r: BannerRow) => upFn({ data: { ...r, is_active: !r.is_active } as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin","home"] }) });

  const rows = data?.rows ?? [];
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-500">{rows.length} banner(s)</p>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Add banner</button>
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorPanel error={error} onRetry={refetch} /> : rows.length === 0 ? (
        <EmptyState title="No banners yet" />
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {[...rows].sort((a,b)=>(a.position??0)-(b.position??0)).map((r) => (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-neutral-200">
              {r.image_url && <img src={r.image_url} alt="" className="h-32 w-full object-cover" />}
              <div className="p-3">
                <p className="text-sm font-semibold">{r.title}</p>
                {r.subtitle && <p className="text-xs text-neutral-500">{r.subtitle}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>{r.is_active ? "Active" : "Inactive"}</span>
                  <RowActions row={r} rows={rows} table="home_banners"
                    onEdit={() => setEditing(r)} onDelete={() => { if (confirm("Delete?")) del.mutate(r.id); }} onToggle={() => toggle.mutate(r)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New banner" : "Edit banner"}>
        {editing !== null && <BannerForm initial={editing === "new" ? null : editing} zones={zones} isMain={isMain}
          onSubmit={(p) => upFn({ data: p as never }).then(() => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin","home"] }); }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))} />}
      </Drawer>
    </Card>
  );
}

function BannerForm({ initial, zones, isMain, onSubmit }: {
  initial: BannerRow | null; zones: Array<{ id: string; name: string }>; isMain: boolean;
  onSubmit: (p: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    id: initial?.id, title: initial?.title ?? "", subtitle: initial?.subtitle ?? "",
    image_url: initial?.image_url ?? "", cta_label: initial?.cta_label ?? "", cta_href: initial?.cta_href ?? "",
    zone_id: initial?.zone_id ?? "", position: initial?.position ?? 0,
    is_active: initial?.is_active ?? true,
    starts_at: initial?.starts_at?.slice(0,16) ?? "", ends_at: initial?.ends_at?.slice(0,16) ?? "",
  });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({
      ...f, image_url: f.image_url || null, subtitle: f.subtitle || null, cta_label: f.cta_label || null, cta_href: f.cta_href || null,
      zone_id: f.zone_id || null,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    }); }}>
      <Field label="Title"><input required className={inputCls} value={f.title} onChange={(e) => setF({...f, title: e.target.value})} /></Field>
      <Field label="Subtitle"><input className={inputCls} value={f.subtitle ?? ""} onChange={(e) => setF({...f, subtitle: e.target.value})} /></Field>
      <Field label="Image URL"><input className={inputCls} value={f.image_url ?? ""} onChange={(e) => setF({...f, image_url: e.target.value})} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA label"><input className={inputCls} value={f.cta_label ?? ""} onChange={(e) => setF({...f, cta_label: e.target.value})} placeholder="Order now" /></Field>
        <Field label="CTA link"><input className={inputCls} value={f.cta_href ?? ""} onChange={(e) => setF({...f, cta_href: e.target.value})} placeholder="/menu/full-menu" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Position"><input type="number" min={0} className={inputCls} value={f.position} onChange={(e) => setF({...f, position: Number(e.target.value)})} /></Field>
        {isMain && (
          <Field label="Delivery zone">
            <select className={inputCls} value={f.zone_id ?? ""} onChange={(e) => setF({...f, zone_id: e.target.value})}>
              <option value="">All zones</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts at"><input type="datetime-local" className={inputCls} value={f.starts_at} onChange={(e) => setF({...f, starts_at: e.target.value})} /></Field>
        <Field label="Ends at"><input type="datetime-local" className={inputCls} value={f.ends_at} onChange={(e) => setF({...f, ends_at: e.target.value})} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({...f, is_active: e.target.checked})} /> Active</label>
      <button type="submit" className="w-full rounded-xl bg-[#ff003c] py-2.5 text-sm font-semibold text-white">Save</button>
    </form>
  );
}

/* ----------------------------- VISIBILITY ----------------------------- */

const SECTIONS = ["popular","hot_deals","specials","banners","featured","seasonal"] as const;

function VisibilityTab({ isMain }: { isMain: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSectionVisibility);
  const setFn = useServerFn(setSectionVisibility);
  const { zones } = useZonesAndProducts();
  const [zoneId, setZoneId] = useState<string>("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin","home","visibility"], queryFn: () => listFn() });
  const rows = data?.rows ?? [];
  function isVisible(section: string) {
    const targetZone = isMain ? (zoneId || null) : null;
    const exact = rows.find(r => r.section === section && r.zone_id === targetZone);
    if (exact) return exact.is_visible;
    return true;
  }
  const set = useMutation({
    mutationFn: (args: { section: typeof SECTIONS[number]; is_visible: boolean }) =>
      setFn({ data: { section: args.section, zone_id: isMain ? (zoneId || null) : undefined, is_visible: args.is_visible } }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin","home","visibility"] }); },
  });
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <p className="text-xs text-neutral-500">Toggle entire sections on or off without deleting their content.</p>
        {isMain && (
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs">
            <option value="">Global (all zones)</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        )}
      </div>
      {isLoading ? <LoadingRows /> : error ? <ErrorPanel error={error} onRetry={refetch} /> : (
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {SECTIONS.map(s => {
            const visible = isVisible(s);
            return (
              <div key={s} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize">{s.replace("_"," ")}</p>
                  <p className="text-xs text-neutral-500">{visible ? "Visible on home page" : "Hidden from home page"}</p>
                </div>
                <button onClick={() => set.mutate({ section: s, is_visible: !visible })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${visible ? "bg-[#ff003c]" : "bg-neutral-300"}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${visible ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ----------------------------- ANALYTICS ----------------------------- */

function AnalyticsTab() {
  const fn = useServerFn(getHomeAnalytics);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin","home","analytics"], queryFn: () => fn({ data: { days: 30 } }) });
  if (isLoading) return <LoadingRows />;
  if (error) return <ErrorPanel error={error} />;
  const totals = data?.totals ?? { views: 0, clicks: 0 };
  const ctr = totals.views ? ((totals.clicks / totals.views) * 100).toFixed(1) : "0.0";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><div className="p-4"><p className="text-xs text-neutral-500">Views (30d)</p><p className="mt-1 text-2xl font-semibold">{totals.views}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-neutral-500">Clicks (30d)</p><p className="mt-1 text-2xl font-semibold">{totals.clicks}</p></div></Card>
        <Card><div className="p-4"><p className="text-xs text-neutral-500">Click-through rate</p><p className="mt-1 text-2xl font-semibold">{ctr}%</p></div></Card>
      </div>
      <Card>
        <div className="border-b border-neutral-100 px-4 py-3 text-xs uppercase tracking-wider text-neutral-500">Top home content</div>
        {(data?.items ?? []).length === 0 ? <EmptyState title="No tracking events yet" hint="Events appear as visitors browse the home page." /> : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Content ID</th><th className="px-4 py-2 text-right">Views</th><th className="px-4 py-2 text-right">Clicks</th><th className="px-4 py-2 text-right">CTR</th></tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((r) => (
                <tr key={`${r.content_type}-${r.content_id}`} className="border-t border-neutral-100">
                  <td className="px-4 py-3 capitalize">{r.content_type}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.content_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-right">{r.views}</td>
                  <td className="px-4 py-3 text-right">{r.clicks}</td>
                  <td className="px-4 py-3 text-right">{r.views ? ((r.clicks/r.views)*100).toFixed(1) : "0.0"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
