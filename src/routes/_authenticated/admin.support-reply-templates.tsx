import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, LoadingRows } from "@/components/admin/data-shell";
import {
  deleteSupportReplyTemplate,
  listSupportReplyTemplates,
  reorderSupportReplyTemplates,
  setSupportReplyTemplateActive,
  upsertSupportReplyTemplate,
} from "@/lib/admin/support-reply-templates.functions";

export const Route = createFileRoute("/_authenticated/admin/support-reply-templates")({
  beforeLoad: requireMainAdminGuard,
  component: () => (
    <MainAdminGuard>
      <TemplatesPage />
    </MainAdminGuard>
  ),
});

type Row = {
  id: string;
  label: string;
  description: string | null;
  body: string;
  sort_order: number;
  is_active: boolean;
};

const EMPTY = { id: undefined as string | undefined, label: "", description: "", body: "", is_active: true };

function TemplatesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSupportReplyTemplates);
  const saveFn = useServerFn(upsertSupportReplyTemplate);
  const activeFn = useServerFn(setSupportReplyTemplateActive);
  const deleteFn = useServerFn(deleteSupportReplyTemplate);
  const reorderFn = useServerFn(reorderSupportReplyTemplates);

  const [draft, setDraft] = useState({ ...EMPTY });
  const [order, setOrder] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "support-reply-templates", "all"],
    queryFn: () => listFn({ data: { includeDisabled: true } }),
  });

  const rows = (data?.rows ?? []) as Row[];
  useEffect(() => {
    setOrder(rows.map((r) => r.id));
  }, [data]);

  const ordered = order.length
    ? (order.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Row[])
    : rows;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "support-reply-templates"] });
  };

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          label: draft.label.trim(),
          description: draft.description.trim(),
          body: draft.body,
          is_active: draft.is_active,
        },
      }),
    onSuccess: () => {
      toast.success(draft.id ? "Template updated" : "Template created");
      setDraft({ ...EMPTY });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => activeFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const persistOrder = useMutation({
    mutationFn: (ids: string[]) => reorderFn({ data: { ids } }),
    onSuccess: () => {
      toast.success("Order saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (index: number, dir: -1 | 1) => {
    const next = ordered.map((r) => r.id);
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setOrder(next);
    persistOrder.mutate(next);
  };

  return (
    <div className="space-y-6" data-testid="support-reply-templates-page">
      <PageHeader
        title="Support Reply Templates"
        description="Create, edit, disable and reorder the quick replies admins can insert when answering support requests."
      />

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          {draft.id ? "Edit template" : "New template"}
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Placeholders: {"{{name}}"}, {"{{email}}"}, {"{{reference}}"}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            data-testid="template-label"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="Label (e.g. Refund approved)"
            className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
          <input
            data-testid="template-description"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Short description (optional)"
            className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
        </div>
        <textarea
          data-testid="template-body"
          rows={6}
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          placeholder="Hi {{name}}, …"
          className="mt-3 w-full rounded-2xl border border-neutral-200 p-3 text-sm outline-none focus:border-neutral-400"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              data-testid="template-active"
              checked={draft.is_active}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
            />
            Active
          </label>
          <button
            type="button"
            data-testid="template-save"
            disabled={!draft.label.trim() || draft.body.trim().length < 5 || save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> {draft.id ? "Save changes" : "Create template"}
          </button>
          {draft.id ? (
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY })}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Templates</h2>
        {isLoading ? (
          <LoadingRows />
        ) : ordered.length === 0 ? (
          <EmptyState title="No templates yet" hint="Create your first reply template above." />
        ) : (
          <ul className="mt-3 space-y-2">
            {ordered.map((t, i) => (
              <li
                key={t.id}
                data-testid="template-row"
                className="rounded-2xl border border-neutral-200 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">
                      {t.label}{" "}
                      {!t.is_active ? (
                        <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                          Disabled
                        </span>
                      ) : null}
                    </p>
                    {t.description ? (
                      <p className="text-xs text-neutral-500">{t.description}</p>
                    ) : null}
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-neutral-600">{t.body}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Move up"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded-full border border-neutral-200 p-1.5 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      onClick={() => move(i, 1)}
                      disabled={i === ordered.length - 1}
                      className="rounded-full border border-neutral-200 p-1.5 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-testid="template-edit"
                      onClick={() =>
                        setDraft({
                          id: t.id,
                          label: t.label,
                          description: t.description ?? "",
                          body: t.body,
                          is_active: t.is_active,
                        })
                      }
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      data-testid="template-toggle"
                      onClick={() => toggle.mutate({ id: t.id, is_active: !t.is_active })}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      {t.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      aria-label="Delete template"
                      onClick={() => {
                        if (confirm(`Delete template "${t.label}"?`)) remove.mutate(t.id);
                      }}
                      className="rounded-full border border-neutral-200 p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
