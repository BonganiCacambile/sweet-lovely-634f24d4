import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows } from "@/components/admin/data-shell";
import { listSettings, updateSetting } from "@/lib/admin/settings.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

type Row = { group_key: string; key: string; value: unknown; description: string | null; updated_at: string };

function SettingsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSettings);
  const updFn = useServerFn(updateSetting);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "settings"], queryFn: () => listFn(),
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) {
      const initial: Record<string, string> = {};
      for (const r of data) initial[`${r.group_key}.${r.key}`] = JSON.stringify(r.value);
      setDraft(initial);
    }
  }, [data]);

  const groups = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of (data ?? []) as Row[]) (map[r.group_key] ??= []).push(r);
    return map;
  }, [data]);

  const update = useMutation({
    mutationFn: (vars: { group_key: string; key: string; value: unknown }) => updFn({ data: vars }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "settings"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const save = (r: Row) => {
    const k = `${r.group_key}.${r.key}`;
    try {
      const parsed = JSON.parse(draft[k] ?? "null");
      update.mutate({ group_key: r.group_key, key: r.key, value: parsed });
    } catch {
      toast.error("Value must be valid JSON (use quotes around strings)");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="System Settings" description="Configure store, email, security and branding defaults." />
      {error ? <ErrorPanel error={error} onRetry={() => refetch()} /> : null}
      {isLoading ? <LoadingRows rows={6} /> : !data?.length ? (
        <EmptyState icon={<SettingsIcon className="h-5 w-5" />} title="No settings configured" />
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([group, items]) => (
            <Card key={group}>
              <div className="border-b border-neutral-100 px-4 py-3">
                <h2 className="text-sm font-semibold capitalize text-neutral-900">{group}</h2>
              </div>
              <div className="divide-y divide-neutral-100">
                {items.map(r => {
                  const k = `${r.group_key}.${r.key}`;
                  const dirty = draft[k] !== JSON.stringify(r.value);
                  return (
                    <div key={k} className="flex flex-wrap items-start gap-3 px-4 py-3">
                      <div className="min-w-[200px] flex-1">
                        <p className="font-mono text-xs text-neutral-900">{r.key}</p>
                        {r.description && <p className="text-[11px] text-neutral-500">{r.description}</p>}
                      </div>
                      <input
                        value={draft[k] ?? ""}
                        onChange={e => setDraft({ ...draft, [k]: e.target.value })}
                        className="flex-[2] min-w-[200px] rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs"
                        placeholder='"value" or 42 or true'
                      />
                      <button
                        disabled={!dirty || update.isPending}
                        onClick={() => save(r)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#ff003c] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                      >
                        <Save className="h-3 w-3" /> Save
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
