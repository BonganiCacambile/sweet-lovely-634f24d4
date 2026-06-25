import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Plus, Pencil, Power, X, BarChart3, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { useAuth } from "@/lib/auth-context";
import { formatZar } from "@/lib/admin/format";
import {
  listAllZones,
  upsertZone,
  toggleZoneActive,
} from "@/lib/admin/zones.functions";

export const Route = createFileRoute("/_authenticated/admin/delivery-zones")({
  component: DeliveryZonesPage,
});

type Zone = Awaited<ReturnType<typeof listAllZones>>[number];

const empty: ZoneDraft = {
  id: null,
  slug: "",
  name: "",
  description: "",
  fee_zar: 0,
  min_order_zar: 0,
  eta_minutes: 30,
  is_active: true,
  sort_order: 0,
  postal_codes_text: "",
  contact_phone: "",
  contact_email: "",
  hours_text: "",
  color: "#ff003c",
  image_url: "",
};

interface ZoneDraft {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  fee_zar: number;
  min_order_zar: number;
  eta_minutes: number;
  is_active: boolean;
  sort_order: number;
  postal_codes_text: string;
  contact_phone: string;
  contact_email: string;
  hours_text: string;
  color: string;
  image_url: string;
}

function DeliveryZonesPage() {
  const qc = useQueryClient();
  const { isMainAdmin, assignedZoneName } = useAuth();
  const listFn = useServerFn(listAllZones);
  const saveFn = useServerFn(upsertZone);
  const toggleFn = useServerFn(toggleZoneActive);

  const [draft, setDraft] = React.useState<ZoneDraft | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "zones", "all"],
    queryFn: () => listFn(),
  });

  useRealtimeTable("delivery_zones", [["admin", "zones", "all"], ["zones", "active"]]);

  const saveMutation = useMutation({
    mutationFn: (d: ZoneDraft) =>
      saveFn({
        data: {
          id: d.id,
          slug: d.slug.trim().toLowerCase(),
          name: d.name.trim(),
          description: d.description.trim() || null,
          fee_zar: Number(d.fee_zar) || 0,
          min_order_zar: Number(d.min_order_zar) || 0,
          eta_minutes: Number(d.eta_minutes) || 0,
          is_active: d.is_active,
          sort_order: Number(d.sort_order) || 0,
          postal_codes: d.postal_codes_text
            .split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
          contact_phone: d.contact_phone.trim() || null,
          contact_email: d.contact_email.trim() || null,
          hours_text: d.hours_text.trim() || null,
          color: d.color.trim() || null,
          image_url: d.image_url.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Delivery zone saved");
      qc.invalidateQueries({ queryKey: ["admin", "zones"] });
      qc.invalidateQueries({ queryKey: ["zones", "active"] });
      setDraft(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (z: Zone) => toggleFn({ data: { id: z.id, is_active: !z.is_active } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "zones"] });
      qc.invalidateQueries({ queryKey: ["zones", "active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (z: Zone) =>
    setDraft({
      id: z.id,
      slug: z.slug,
      name: z.name,
      description: z.description ?? "",
      fee_zar: Number(z.fee_zar),
      min_order_zar: Number(z.min_order_zar),
      eta_minutes: z.eta_minutes,
      is_active: z.is_active,
      sort_order: z.sort_order,
      postal_codes_text: (z.postal_codes ?? []).join(", "),
      contact_phone: z.contact_phone ?? "",
      contact_email: z.contact_email ?? "",
      hours_text: z.hours_text ?? "",
      color: z.color ?? "#ff003c",
      image_url: (z as { image_url: string | null }).image_url ?? "",
    });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title={isMainAdmin ? "Delivery zones" : `Delivery zone · ${assignedZoneName ?? "Assigned"}`}
        description={isMainAdmin
          ? "Manage your delivery areas, fees, minimums and service status."
          : "You can manage fees, minimums and service status for your assigned zone only."}
        actions={
          isMainAdmin ? (
            <button
              onClick={() => setDraft({ ...empty })}
              className="inline-flex items-center gap-2 rounded-full bg-[#ff003c] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#e6003a]"
            >
              <Plus className="h-4 w-4" /> New zone
            </button>
          ) : null
        }
      />

      <Card>
        {error ? (
          <div className="p-4"><ErrorPanel error={error} onRetry={() => void refetch()} /></div>
        ) : isLoading ? (
          <LoadingRows />
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<MapPin className="h-5 w-5" />}
              title="No delivery zones yet"
              hint="Create your first zone to start taking orders."
            />
          </div>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2 font-medium">Zone</th>
                  <th className="px-3 py-2 font-medium">Fee</th>
                  <th className="px-3 py-2 font-medium">Min order</th>
                  <th className="px-3 py-2 font-medium">ETA</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data!.map((z) => (
                  <tr key={z.id} className="border-t border-neutral-100">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: z.color ?? "#ff003c" }} />
                        <div>
                          <p className="font-medium text-neutral-900">{z.name}</p>
                          <p className="text-xs text-neutral-500">{z.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatZar(Number(z.fee_zar))}</td>
                    <td className="px-3 py-3 tabular-nums">{formatZar(Number(z.min_order_zar))}</td>
                    <td className="px-3 py-3 text-neutral-700">{z.eta_minutes} min</td>
                    <td className="px-3 py-3">
                      <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + (z.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500")}>
                        {z.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {isMainAdmin && (
                          <>
                            <Link
                              to="/admin/analytics"
                              search={{ zoneId: z.id }}
                              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                              title="View sales for this zone"
                            >
                              <BarChart3 className="h-3.5 w-3.5" /> Sales
                            </Link>
                            <Link
                              to="/admin/orders"
                              search={{ zoneId: z.id }}
                              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                              title="View orders for this zone"
                            >
                              <ShoppingBag className="h-3.5 w-3.5" /> Orders
                            </Link>
                          </>
                        )}
                        <button onClick={() => openEdit(z)} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate(z)}
                          disabled={toggleMutation.isPending}
                          className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                          aria-label={z.is_active ? "Deactivate" : "Activate"}
                          title={z.is_active ? "Deactivate" : "Activate"}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {draft && (
        <ZoneEditor
          draft={draft}
          onChange={setDraft}
          onSave={() => saveMutation.mutate(draft)}
          saving={saveMutation.isPending}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}

function ZoneEditor({
  draft, onChange, onSave, onClose, saving,
}: {
  draft: ZoneDraft;
  onChange: (d: ZoneDraft) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const set = <K extends keyof ZoneDraft>(k: K, v: ZoneDraft[K]) =>
    onChange({ ...draft, [k]: v });
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-neutral-900/40" onClick={onClose} />
      <aside className="flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h2 className="text-lg font-semibold">{draft.id ? "Edit zone" : "New zone"}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 space-y-4 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field>
            <Field label="Slug"><input value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="sandton" className={inputCls} /></Field>
          </div>
          <Field label="Description">
            <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={2} className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fee (R)"><input type="number" min={0} step="0.01" value={draft.fee_zar} onChange={(e) => set("fee_zar", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Min order (R)"><input type="number" min={0} step="0.01" value={draft.min_order_zar} onChange={(e) => set("min_order_zar", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="ETA (min)"><input type="number" min={0} value={draft.eta_minutes} onChange={(e) => set("eta_minutes", Number(e.target.value))} className={inputCls} /></Field>
          </div>
          <Field label="Postal codes (comma-separated)">
            <input value={draft.postal_codes_text} onChange={(e) => set("postal_codes_text", e.target.value)} placeholder="2196, 2031" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact phone"><input value={draft.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} className={inputCls} /></Field>
            <Field label="Contact email"><input value={draft.contact_email} onChange={(e) => set("contact_email", e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Operating hours"><input value={draft.hours_text} onChange={(e) => set("hours_text", e.target.value)} placeholder="Mon–Sun 10:00–22:00" className={inputCls} /></Field>
          <Field label="Image URL (optional)">
            <input
              value={draft.image_url}
              onChange={(e) => set("image_url", e.target.value)}
              placeholder="https://… (direct image link, not a GitHub blob page)"
              className={inputCls}
            />
            <ImagePreview url={draft.image_url} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Color"><input type="color" value={draft.color} onChange={(e) => set("color", e.target.value)} className="h-10 w-full rounded-lg border border-neutral-200" /></Field>
            <Field label="Sort order"><input type="number" min={0} value={draft.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Active">
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} />
                {draft.is_active ? "Active" : "Inactive"}
              </label>
            </Field>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-neutral-100 p-4">
          <button onClick={onClose} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">Cancel</button>
          <button onClick={onSave} disabled={saving} className="rounded-full bg-[#ff003c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6003a] disabled:opacity-60">
            {saving ? "Saving…" : "Save zone"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
    </label>
  );
}