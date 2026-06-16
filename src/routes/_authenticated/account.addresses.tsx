import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { Field, fieldCls } from "@/components/auth/login-form";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import {
  listAddresses,
  saveAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/account/account.functions";
import { Loader2, MapPin, Plus, Star, Trash2, Edit3, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account/addresses")({
  head: () => ({ meta: [{ title: "Addresses — Sweet & Lovely" }] }),
  component: AddressesPage,
});

type Address = {
  id: string;
  label: string;
  recipient: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  notes: string | null;
};

const empty: Partial<Address> = {
  label: "Home",
  country: "ZA",
  is_default: false,
};

function AddressesPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listAddresses);
  const save = useServerFn(saveAddress);
  const del = useServerFn(deleteAddress);
  const setDef = useServerFn(setDefaultAddress);

  const { data, isLoading } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: () => fetchList(),
  });
  useRealtimeInvalidate(["user_addresses"], [["my-addresses"], ["account-overview"]]);

  const [editing, setEditing] = useState<Partial<Address> | null>(null);

  const saveMut = useMutation({
    mutationFn: (input: Partial<Address>) => save({ data: input as any }),
    onSuccess: () => {
      toast.success("Address saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["my-addresses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Address removed");
      qc.invalidateQueries({ queryKey: ["my-addresses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const defMut = useMutation({
    mutationFn: (id: string) => setDef({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-addresses"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addresses = (data?.addresses ?? []) as Address[];

  return (
    <AccountShell title="Saved addresses">
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ ...empty })}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Add address
        </button>
      </div>

      {editing && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">
              {editing.id ? "Edit address" : "New address"}
            </p>
            <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-neutral-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate(editing);
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <Field label="Label"><input required value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} className={fieldCls} /></Field>
            <Field label="Recipient"><input value={editing.recipient ?? ""} onChange={(e) => setEditing({ ...editing, recipient: e.target.value })} className={fieldCls} /></Field>
            <Field label="Phone"><input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={fieldCls} /></Field>
            <Field label="Country (ISO)"><input maxLength={2} required value={editing.country ?? "ZA"} onChange={(e) => setEditing({ ...editing, country: e.target.value.toUpperCase() })} className={fieldCls} /></Field>
            <div className="sm:col-span-2"><Field label="Address line 1"><input required value={editing.line1 ?? ""} onChange={(e) => setEditing({ ...editing, line1: e.target.value })} className={fieldCls} /></Field></div>
            <div className="sm:col-span-2"><Field label="Address line 2"><input value={editing.line2 ?? ""} onChange={(e) => setEditing({ ...editing, line2: e.target.value })} className={fieldCls} /></Field></div>
            <Field label="City"><input required value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} className={fieldCls} /></Field>
            <Field label="Province"><input value={editing.province ?? ""} onChange={(e) => setEditing({ ...editing, province: e.target.value })} className={fieldCls} /></Field>
            <Field label="Postal code"><input value={editing.postal_code ?? ""} onChange={(e) => setEditing({ ...editing, postal_code: e.target.value })} className={fieldCls} /></Field>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={Boolean(editing.is_default)} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />
              Set as default
            </label>
            <div className="sm:col-span-2"><Field label="Notes (e.g. gate code)"><textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={fieldCls} /></Field></div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={saveMut.isPending} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save address
              </button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-8 text-neutral-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading addresses…
          </div>
        </Card>
      ) : addresses.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
              <MapPin className="h-6 w-6" />
            </span>
            <p className="text-base font-semibold text-neutral-900">No saved addresses</p>
            <p className="mt-1 text-sm text-neutral-500">Add one to checkout faster next time.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{a.label}</p>
                    {a.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0f3] px-2 py-0.5 text-[10px] font-semibold text-[#ff003c]">
                        <Star className="h-3 w-3" /> Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">
                    {a.recipient ? `${a.recipient} · ` : ""}
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {a.city}
                    {a.province ? `, ${a.province}` : ""} {a.postal_code ?? ""} · {a.country}
                    {a.phone ? ` · ${a.phone}` : ""}
                  </p>
                  {a.notes && <p className="mt-1 text-xs text-neutral-500">Note: {a.notes}</p>}
                </div>
                <div className="flex gap-2">
                  {!a.is_default && (
                    <button onClick={() => defMut.mutate(a.id)} className="rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                      Make default
                    </button>
                  )}
                  <button onClick={() => setEditing(a)} className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button onClick={() => delMut.mutate(a.id)} className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AccountShell>
  );
}