import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Home, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/section-card";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import {
  SECTION_KEYS,
  type SectionKey,
  deleteBanner,
  deleteFeatured,
  deleteHotDeal,
  deletePopular,
  deleteSpecial,
  homeContentAnalytics,
  listBanners,
  listFeatured,
  listHotDeals,
  listPopular,
  listProductOptions,
  listSpecials,
  listVisibility,
  setVisibility,
  upsertBanner,
  upsertFeatured,
  upsertHotDeal,
  upsertPopular,
  upsertSpecial,
} from "@/lib/admin/home-content.functions";

export const Route = createFileRoute("/_authenticated/admin/home-content")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth/admin" });
  },
  component: HomeContentPage,
});

type Tab =
  | "popular"
  | "hot_deals"
  | "specials"
  | "featured"
  | "banners"
  | "visibility"
  | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "popular", label: "Popular Items" },
  { id: "hot_deals", label: "Hot Deals" },
  { id: "specials", label: "Specials" },
  { id: "featured", label: "Featured" },
  { id: "banners", label: "Banners" },
  { id: "visibility", label: "Section Visibility" },
  { id: "analytics", label: "Analytics" },
];

function HomeContentPage() {
  const [tab, setTab] = useState<Tab>("popular");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Home Page"
        title="Home Content Manager"
        description="Control every promotional block on the customer home page. Changes go live instantly."
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "rounded-full border px-4 py-2 text-xs font-medium transition " +
              (tab === t.id
                ? "border-[#ff003c] bg-[#ff003c] text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "popular" && <PopularTab />}
      {tab === "hot_deals" && <HotDealsTab />}
      {tab === "specials" && <SpecialsTab />}
      {tab === "featured" && <FeaturedTab />}
      {tab === "banners" && <BannersTab />}
      {tab === "visibility" && <VisibilityTab />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}

// ----------------------------- Shared UI -----------------------------------

type Row = Record<string, unknown> & { id: string; title?: string; is_active?: boolean; position?: number };

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " +
        (active ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500")
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-neutral-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#ff003c]";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function toIsoOrNull(v: string) {
  return v ? new Date(v).toISOString() : null;
}
function fromIso(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ----------------------------- Popular Items -------------------------------

function PopularTab() {
  const qc = useQueryClient();
  const list = useServerFn(listPopular);
  const del = useServerFn(deletePopular);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "home-content", "popular"],
    queryFn: () => list(),
  });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "home-content", "popular"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <SectionCard
      title="Popular Items"
      action={
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      }
    >
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (data?.rows ?? []).length === 0 ? (
        <EmptyState title="No popular items yet" hint="Create your first item to feature on the home page." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Item</th>
                <th className="p-3">Price</th>
                <th className="p-3">Category</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="p-3 text-neutral-500">{r.position}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {r.image_url && (
                        <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      )}
                      <div>
                        <p className="font-medium text-neutral-900">{r.title}</p>
                        {r.description && (
                          <p className="line-clamp-1 text-[11px] text-neutral-500">{r.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{r.price ?? "—"}</td>
                  <td className="p-3">{r.category ?? "—"}</td>
                  <td className="p-3">
                    <StatusPill active={!!r.is_active} />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setEditing(r as unknown as Row)}
                      className="mr-2 rounded-full border border-neutral-200 p-1.5 hover:bg-neutral-100"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => confirm("Delete this item?") && removeMut.mutate(r.id)}
                      className="rounded-full border border-neutral-200 p-1.5 text-red-600 hover:bg-red-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <PopularForm
          initial={editing === "new" ? null : (editing as Record<string, unknown>)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin", "home-content", "popular"] });
          }}
        />
      )}
    </SectionCard>
  );
}

function ProductPicker({ value, onChange }: { value: string; onChange: (slug: string, product?: { title: string; image: string | null; price_zar: number }) => void }) {
  const list = useServerFn(listProductOptions);
  const { data } = useQuery({ queryKey: ["admin", "home-content", "products"], queryFn: () => list() });
  return (
    <select
      className={inputCls}
      value={value}
      onChange={(e) => {
        const slug = e.target.value;
        const p = (data ?? []).find((x) => x.slug === slug);
        onChange(slug, p ? { title: p.title, image: p.image, price_zar: Number(p.price_zar) } : undefined);
      }}
    >
      <option value="">— none —</option>
      {(data ?? []).map((p) => (
        <option key={p.slug} value={p.slug}>
          {p.title} · R{Number(p.price_zar).toFixed(2)}
        </option>
      ))}
    </select>
  );
}

function PopularForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertPopular);
  const [title, setTitle] = useState(String(initial?.title ?? ""));
  const [description, setDescription] = useState(String(initial?.description ?? ""));
  const [image_url, setImage] = useState(String(initial?.image_url ?? ""));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [category, setCategory] = useState(String(initial?.category ?? ""));
  const [product_slug, setSlug] = useState(String(initial?.product_slug ?? ""));
  const [position, setPosition] = useState(Number(initial?.position ?? 0));
  const [is_active, setActive] = useState(initial?.is_active !== false);
  const [starts_at, setStarts] = useState(fromIso(initial?.starts_at as string | null));
  const [ends_at, setEnds] = useState(fromIso(initial?.ends_at as string | null));

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: (initial?.id as string | undefined) ?? undefined,
          patch: {
            title,
            description: description || null,
            image_url: image_url || null,
            price: price || null,
            category: category || null,
            product_slug: product_slug || null,
            position,
            is_active,
            starts_at: toIsoOrNull(starts_at),
            ends_at: toIsoOrNull(ends_at),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Modal title={initial ? "Edit Popular Item" : "New Popular Item"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Position">
          <input type="number" className={inputCls} value={position} onChange={(e) => setPosition(Number(e.target.value))} />
        </Field>
        <Field label="Product" hint="Optional — link to an inventory product">
          <ProductPicker
            value={product_slug}
            onChange={(slug, p) => {
              setSlug(slug);
              if (p) {
                if (!title) setTitle(p.title);
                if (!image_url && p.image) setImage(p.image);
                if (!price && p.price_zar) setPrice(`R${p.price_zar.toFixed(2)}`);
              }
            }}
          />
        </Field>
        <Field label="Category">
          <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field label="Price (display)" hint="e.g. R80 or 'from R80'">
          <input className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Image URL">
          <input className={inputCls} value={image_url} onChange={(e) => setImage(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Starts at">
          <input type="datetime-local" className={inputCls} value={starts_at} onChange={(e) => setStarts(e.target.value)} />
        </Field>
        <Field label="Ends at">
          <input type="datetime-local" className={inputCls} value={ends_at} onChange={(e) => setEnds(e.target.value)} />
        </Field>
        <label className="col-span-full mt-1 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={is_active} onChange={(e) => setActive(e.target.checked)} />
          <span>Active</span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-medium">
          Cancel
        </button>
        <button
          disabled={!title || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {mut.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------- Hot Deals -----------------------------------

function HotDealsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listHotDeals);
  const del = useServerFn(deleteHotDeal);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "home-content", "hot_deals"],
    queryFn: () => list(),
  });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "home-content", "hot_deals"] });
    },
  });

  return (
    <SectionCard
      title="Hot Deals"
      action={
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> New deal
        </button>
      }
    >
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (data?.rows ?? []).length === 0 ? (
        <EmptyState title="No hot deals yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-3">Deal</th>
                <th className="p-3">Was</th>
                <th className="p-3">Now</th>
                <th className="p-3">Save</th>
                <th className="p-3">Ends</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r) => {
                const orig = r.original_price ? Number(r.original_price) : null;
                const disc = r.discounted_price ? Number(r.discounted_price) : null;
                const save = orig != null && disc != null ? (orig - disc).toFixed(2) : null;
                return (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {r.image_url && <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                        <div>
                          <p className="font-medium">{r.title}</p>
                          {r.label && (
                            <span className="mt-0.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              {r.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-neutral-500 line-through">{orig != null ? `R${orig.toFixed(2)}` : "—"}</td>
                    <td className="p-3 font-semibold">{disc != null ? `R${disc.toFixed(2)}` : "—"}</td>
                    <td className="p-3">{save ? `R${save}` : r.discount_pct ? `${r.discount_pct}%` : "—"}</td>
                    <td className="p-3 text-[12px]">{r.ends_at ? new Date(r.ends_at).toLocaleDateString() : "—"}</td>
                    <td className="p-3">
                      <StatusPill active={!!r.is_active} />
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => setEditing(r as unknown as Row)} className="mr-2 rounded-full border border-neutral-200 p-1.5">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => confirm("Delete this deal?") && removeMut.mutate(r.id)}
                        className="rounded-full border border-neutral-200 p-1.5 text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <HotDealForm
          initial={editing === "new" ? null : (editing as Record<string, unknown>)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin", "home-content", "hot_deals"] });
          }}
        />
      )}
    </SectionCard>
  );
}

function HotDealForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertHotDeal);
  const [title, setTitle] = useState(String(initial?.title ?? ""));
  const [description, setDescription] = useState(String(initial?.description ?? ""));
  const [image_url, setImage] = useState(String(initial?.image_url ?? ""));
  const [label, setLabel] = useState(String(initial?.label ?? ""));
  const [product_slug, setSlug] = useState(String(initial?.product_slug ?? ""));
  const [original_price, setOrig] = useState(initial?.original_price ? String(initial.original_price) : "");
  const [discounted_price, setDisc] = useState(initial?.discounted_price ? String(initial.discounted_price) : "");
  const [discount_pct, setPct] = useState(initial?.discount_pct ? String(initial.discount_pct) : "");
  const [position, setPosition] = useState(Number(initial?.position ?? 0));
  const [is_active, setActive] = useState(initial?.is_active !== false);
  const [starts_at, setStarts] = useState(fromIso(initial?.starts_at as string | null));
  const [ends_at, setEnds] = useState(fromIso(initial?.ends_at as string | null));

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: (initial?.id as string | undefined) ?? undefined,
          patch: {
            title,
            description: description || null,
            image_url: image_url || null,
            label: label || null,
            product_slug: product_slug || null,
            original_price: original_price ? Number(original_price) : null,
            discounted_price: discounted_price ? Number(discounted_price) : null,
            discount_pct: discount_pct ? Number(discount_pct) : null,
            position,
            is_active,
            starts_at: toIsoOrNull(starts_at),
            ends_at: toIsoOrNull(ends_at),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Modal title={initial ? "Edit Hot Deal" : "New Hot Deal"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Promo label" hint="e.g. Limited time">
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Product">
          <ProductPicker
            value={product_slug}
            onChange={(slug, p) => {
              setSlug(slug);
              if (p) {
                if (!title) setTitle(p.title);
                if (!image_url && p.image) setImage(p.image);
                if (!original_price) setOrig(String(p.price_zar));
              }
            }}
          />
        </Field>
        <Field label="Image URL">
          <input className={inputCls} value={image_url} onChange={(e) => setImage(e.target.value)} />
        </Field>
        <Field label="Original price (ZAR)">
          <input type="number" step="0.01" className={inputCls} value={original_price} onChange={(e) => setOrig(e.target.value)} />
        </Field>
        <Field label="Discounted price (ZAR)">
          <input type="number" step="0.01" className={inputCls} value={discounted_price} onChange={(e) => setDisc(e.target.value)} />
        </Field>
        <Field label="Discount %">
          <input type="number" className={inputCls} value={discount_pct} onChange={(e) => setPct(e.target.value)} />
        </Field>
        <Field label="Position">
          <input type="number" className={inputCls} value={position} onChange={(e) => setPosition(Number(e.target.value))} />
        </Field>
        <Field label="Description">
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Starts at">
          <input type="datetime-local" className={inputCls} value={starts_at} onChange={(e) => setStarts(e.target.value)} />
        </Field>
        <Field label="Ends at">
          <input type="datetime-local" className={inputCls} value={ends_at} onChange={(e) => setEnds(e.target.value)} />
        </Field>
        <label className="col-span-full mt-1 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={is_active} onChange={(e) => setActive(e.target.checked)} />
          <span>Active</span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-medium">Cancel</button>
        <button
          disabled={!title || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {mut.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------- Specials ------------------------------------

function SpecialsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listSpecials);
  const del = useServerFn(deleteSpecial);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "home-content", "specials"],
    queryFn: () => list(),
  });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "home-content", "specials"] });
    },
  });

  return (
    <SectionCard
      title="Specials & Combos"
      action={
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> New special
        </button>
      }
    >
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (data?.rows ?? []).length === 0 ? (
        <EmptyState title="No specials yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-3">Special</th>
                <th className="p-3">Kind</th>
                <th className="p-3">Items</th>
                <th className="p-3">Price</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {r.image_url && <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                      <p className="font-medium">{r.title}</p>
                    </div>
                  </td>
                  <td className="p-3 capitalize">{r.kind?.replace("_", " ")}</td>
                  <td className="p-3 text-[12px] text-neutral-500">
                    {(r.product_slugs ?? []).slice(0, 3).join(", ")}
                    {(r.product_slugs?.length ?? 0) > 3 ? "…" : ""}
                  </td>
                  <td className="p-3">{r.price ?? "—"}</td>
                  <td className="p-3">
                    <StatusPill active={!!r.is_active} />
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(r as unknown as Row)} className="mr-2 rounded-full border border-neutral-200 p-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => confirm("Delete this special?") && removeMut.mutate(r.id)}
                      className="rounded-full border border-neutral-200 p-1.5 text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <SpecialForm
          initial={editing === "new" ? null : (editing as Record<string, unknown>)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin", "home-content", "specials"] });
          }}
        />
      )}
    </SectionCard>
  );
}

function SpecialForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertSpecial);
  const list = useServerFn(listProductOptions);
  const { data: products } = useQuery({ queryKey: ["admin", "home-content", "products"], queryFn: () => list() });
  const [title, setTitle] = useState(String(initial?.title ?? ""));
  const [description, setDescription] = useState(String(initial?.description ?? ""));
  const [image_url, setImage] = useState(String(initial?.image_url ?? ""));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [kind, setKind] = useState<"special" | "combo" | "meal_deal">(
    (initial?.kind as "special" | "combo" | "meal_deal") ?? "special",
  );
  const [slugs, setSlugs] = useState<string[]>((initial?.product_slugs as string[]) ?? []);
  const [position, setPosition] = useState(Number(initial?.position ?? 0));
  const [is_active, setActive] = useState(initial?.is_active !== false);
  const [starts_at, setStarts] = useState(fromIso(initial?.starts_at as string | null));
  const [ends_at, setEnds] = useState(fromIso(initial?.ends_at as string | null));

  const toggle = (slug: string) =>
    setSlugs((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: (initial?.id as string | undefined) ?? undefined,
          patch: {
            title,
            description: description || null,
            image_url: image_url || null,
            price: price || null,
            kind,
            product_slugs: slugs,
            position,
            is_active,
            starts_at: toIsoOrNull(starts_at),
            ends_at: toIsoOrNull(ends_at),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Modal title={initial ? "Edit Special" : "New Special"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Kind">
          <select
            className={inputCls}
            value={kind}
            onChange={(e) => setKind(e.target.value as "special" | "combo" | "meal_deal")}
          >
            <option value="special">Special</option>
            <option value="combo">Combo</option>
            <option value="meal_deal">Meal deal</option>
          </select>
        </Field>
        <Field label="Price (display)">
          <input className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Position">
          <input type="number" className={inputCls} value={position} onChange={(e) => setPosition(Number(e.target.value))} />
        </Field>
        <Field label="Image URL">
          <input className={inputCls} value={image_url} onChange={(e) => setImage(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="col-span-full">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Included products</p>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-neutral-200 p-2">
            {(products ?? []).map((p) => (
              <label key={p.slug} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-neutral-50">
                <input type="checkbox" checked={slugs.includes(p.slug)} onChange={() => toggle(p.slug)} />
                <span className="flex-1">{p.title}</span>
                <span className="text-xs text-neutral-500">R{Number(p.price_zar).toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>
        <Field label="Starts at">
          <input type="datetime-local" className={inputCls} value={starts_at} onChange={(e) => setStarts(e.target.value)} />
        </Field>
        <Field label="Ends at">
          <input type="datetime-local" className={inputCls} value={ends_at} onChange={(e) => setEnds(e.target.value)} />
        </Field>
        <label className="col-span-full mt-1 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={is_active} onChange={(e) => setActive(e.target.checked)} />
          <span>Active</span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-medium">Cancel</button>
        <button
          disabled={!title || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {mut.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------- Featured ------------------------------------

function FeaturedTab() {
  const qc = useQueryClient();
  const list = useServerFn(listFeatured);
  const del = useServerFn(deleteFeatured);
  const save = useServerFn(upsertFeatured);
  const productList = useServerFn(listProductOptions);
  const { data: products } = useQuery({ queryKey: ["admin", "home-content", "products"], queryFn: () => productList() });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "home-content", "featured"],
    queryFn: () => list(),
  });
  const [slug, setSlug] = useState("");
  const [order, setOrder] = useState(0);
  const addMut = useMutation({
    mutationFn: () => save({ data: { patch: { product_slug: slug, placement: "home", sort_order: order, is_active: true, starts_at: null, ends_at: null } } }),
    onSuccess: () => {
      toast.success("Added");
      setSlug("");
      qc.invalidateQueries({ queryKey: ["admin", "home-content", "featured"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "home-content", "featured"] }),
  });

  const rows = (data?.rows ?? []) as Array<{ id: string; product_slug: string; sort_order: number; is_active: boolean; products: { title: string; image: string | null; price_zar: number } | null }>;

  return (
    <SectionCard title="Featured Products">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Add product">
          <select className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)}>
            <option value="">— select —</option>
            {(products ?? []).map((p) => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Sort order">
          <input type="number" className={inputCls} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </Field>
        <button
          disabled={!slug || addMut.isPending}
          onClick={() => addMut.mutate()}
          className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState title="No featured products" />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              {r.products?.image && <img src={r.products.image} alt="" className="h-10 w-10 rounded-lg object-cover" />}
              <div className="flex-1">
                <p className="text-sm font-medium">{r.products?.title ?? r.product_slug}</p>
                <p className="text-[11px] text-neutral-500">Order {r.sort_order}</p>
              </div>
              <button onClick={() => delMut.mutate(r.id)} className="rounded-full border border-neutral-200 p-1.5 text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ----------------------------- Banners -------------------------------------

function BannersTab() {
  const qc = useQueryClient();
  const list = useServerFn(listBanners);
  const del = useServerFn(deleteBanner);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "home-content", "banners"],
    queryFn: () => list(),
  });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "home-content", "banners"] }),
  });

  return (
    <SectionCard
      title="Promotional Banners"
      action={
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> New banner
        </button>
      }
    >
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (data?.rows ?? []).length === 0 ? (
        <EmptyState title="No banners yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.rows ?? []).map((r) => (
            <Card key={r.id}>
              {r.image_url && <img src={r.image_url} alt="" className="h-32 w-full object-cover" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.title}</p>
                    {r.subtitle && <p className="text-xs text-neutral-500">{r.subtitle}</p>}
                  </div>
                  <StatusPill active={!!r.is_active} />
                </div>
                {r.cta_label && (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    CTA: <span className="font-medium">{r.cta_label}</span> → {r.cta_href}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditing(r as unknown as Row)} className="rounded-full border border-neutral-200 px-3 py-1 text-xs">
                    <Pencil className="mr-1 inline h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => confirm("Delete this banner?") && removeMut.mutate(r.id)}
                    className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-red-600"
                  >
                    <Trash2 className="mr-1 inline h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <BannerForm
          initial={editing === "new" ? null : (editing as Record<string, unknown>)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin", "home-content", "banners"] });
          }}
        />
      )}
    </SectionCard>
  );
}

function BannerForm({ initial, onClose, onSaved }: { initial: Record<string, unknown> | null; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(upsertBanner);
  const [title, setTitle] = useState(String(initial?.title ?? ""));
  const [subtitle, setSubtitle] = useState(String(initial?.subtitle ?? ""));
  const [image_url, setImage] = useState(String(initial?.image_url ?? ""));
  const [cta_label, setCtaLabel] = useState(String(initial?.cta_label ?? ""));
  const [cta_href, setCtaHref] = useState(String(initial?.cta_href ?? ""));
  const [position, setPosition] = useState(Number(initial?.position ?? 0));
  const [is_active, setActive] = useState(initial?.is_active !== false);
  const [starts_at, setStarts] = useState(fromIso(initial?.starts_at as string | null));
  const [ends_at, setEnds] = useState(fromIso(initial?.ends_at as string | null));

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: (initial?.id as string | undefined) ?? undefined,
          patch: {
            title,
            subtitle: subtitle || null,
            image_url: image_url || null,
            cta_label: cta_label || null,
            cta_href: cta_href || null,
            position,
            is_active,
            starts_at: toIsoOrNull(starts_at),
            ends_at: toIsoOrNull(ends_at),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Modal title={initial ? "Edit Banner" : "New Banner"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Subtitle">
          <input className={inputCls} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </Field>
        <Field label="Image URL">
          <input className={inputCls} value={image_url} onChange={(e) => setImage(e.target.value)} />
        </Field>
        <Field label="Position">
          <input type="number" className={inputCls} value={position} onChange={(e) => setPosition(Number(e.target.value))} />
        </Field>
        <Field label="CTA label">
          <input className={inputCls} value={cta_label} onChange={(e) => setCtaLabel(e.target.value)} />
        </Field>
        <Field label="CTA link">
          <input className={inputCls} value={cta_href} onChange={(e) => setCtaHref(e.target.value)} />
        </Field>
        <Field label="Starts at">
          <input type="datetime-local" className={inputCls} value={starts_at} onChange={(e) => setStarts(e.target.value)} />
        </Field>
        <Field label="Ends at">
          <input type="datetime-local" className={inputCls} value={ends_at} onChange={(e) => setEnds(e.target.value)} />
        </Field>
        <label className="col-span-full mt-1 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={is_active} onChange={(e) => setActive(e.target.checked)} />
          <span>Active</span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-medium">Cancel</button>
        <button
          disabled={!title || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {mut.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------- Visibility ----------------------------------

function VisibilityTab() {
  const qc = useQueryClient();
  const list = useServerFn(listVisibility);
  const set = useServerFn(setVisibility);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "home-content", "visibility"],
    queryFn: () => list(),
  });
  const setMut = useMutation({
    mutationFn: (v: { section: SectionKey; is_visible: boolean }) => set({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "home-content", "visibility"] }),
  });

  const visible = (section: SectionKey) => {
    const row = (data?.rows ?? []).find((r) => r.section === section && r.zone_id == null);
    return row?.is_visible ?? true;
  };

  return (
    <SectionCard title="Home Page Section Visibility">
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {SECTION_KEYS.map((s) => {
            const v = visible(s);
            return (
              <li key={s} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {v ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-neutral-400" />}
                  <div>
                    <p className="text-sm font-medium capitalize">{s.replace("_", " ")}</p>
                    <p className="text-[11px] text-neutral-500">
                      {v ? "Visible on the home page" : "Hidden from the home page"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMut.mutate({ section: s, is_visible: !v })}
                  className={
                    "rounded-full px-4 py-1.5 text-xs font-semibold " +
                    (v ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700")
                  }
                >
                  {v ? "Hide" : "Show"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ----------------------------- Analytics -----------------------------------

function AnalyticsTab() {
  const fn = useServerFn(homeContentAnalytics);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "home-content", "analytics"],
    queryFn: () => fn(),
  });
  const byType = useMemo(() => Object.entries(data?.byType ?? {}), [data]);
  return (
    <SectionCard title="Home Content Analytics (last 30 days)">
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-neutral-500">Total events</p>
              <p className="mt-1 text-2xl font-bold">{data?.total ?? 0}</p>
            </Card>
            {byType.map(([k, v]) => (
              <Card key={k} className="p-4">
                <p className="text-xs text-neutral-500 capitalize">{k.replace("_", " ")}</p>
                <p className="mt-1 text-sm">
                  <span className="text-lg font-bold">{v.clicks}</span> clicks ·{" "}
                  <span className="text-neutral-500">{v.views} views</span>
                </p>
              </Card>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Top items</p>
            {(data?.top ?? []).length === 0 ? (
              <EmptyState icon={<Home className="h-5 w-5" />} title="No events tracked yet" />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {(data?.top ?? []).map((t) => (
                  <li key={`${t.content_type}:${t.content_id}`} className="flex items-center justify-between py-2 text-sm">
                    <span className="capitalize text-neutral-700">{t.content_type.replace("_", " ")}</span>
                    <span className="font-mono text-[11px] text-neutral-400">{t.content_id.slice(0, 8)}</span>
                    <span>
                      <span className="font-semibold">{t.clicks}</span>
                      <span className="ml-2 text-neutral-500">{t.views} views</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}