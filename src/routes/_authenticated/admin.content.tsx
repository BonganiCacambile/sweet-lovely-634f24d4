import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { deleteContent, getContent, listContent, upsertContent } from "@/lib/admin/content.functions";

export const Route = createFileRoute("/_authenticated/admin/content")({
  beforeLoad: requireMainAdminGuard,
  component: () => (
    <MainAdminGuard>
      <ContentPage />
    </MainAdminGuard>
  ),
});

type Status = "all" | "draft" | "published" | "archived";

function ContentPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null | "new">(null);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listContent);
  const delFn = useServerFn(deleteContent);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "content", { debounced, status, page }],
    queryFn: () => listFn({ data: { search: debounced, status, page, pageSize: 50 } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "content"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = data?.rows ?? [];
  const exportCols = useMemo(() => ([
    { key: "slug", label: "Slug" },
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "publish_at", label: "Publish at" },
    { key: "updated_at", label: "Updated", map: (r: { updated_at: string }) => formatDateTime(r.updated_at) },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Content"
        description="Manage marketing and help pages with markdown and SEO controls."
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu rows={rows} columns={exportCols} filename="content-pages" title="Content pages" />
            <button onClick={() => setEditId("new")} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-2 text-xs font-semibold text-white hover:bg-[#e6002f]">
              <Plus className="h-3.5 w-3.5" /> New page
            </button>
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <input value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} placeholder="Search by title or slug…" className="flex-1 min-w-[200px] rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs" />
          <select value={status} onChange={e => { setPage(1); setStatus(e.target.value as Status); }} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {error ? <ErrorPanel error={error} onRetry={() => refetch()} /> : null}
        {isLoading ? <LoadingRows /> : rows.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="No pages yet" hint="Create your first content page to publish." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Slug</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-medium text-neutral-900">{r.title}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-neutral-500">/{r.slug}</td>
                    <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                    <td className="px-3 py-2 text-neutral-600" title={formatDateTime(r.updated_at)}>{formatRelative(r.updated_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setEditId(r.id)} className="mr-1 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px]"><Pencil className="h-3 w-3" /> Edit</button>
                      <button onClick={() => { if (confirm(`Delete "${r.title}"?`)) del.mutate(r.id); }} className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-1 text-[11px] text-white"><Trash2 className="h-3 w-3" /> Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={50} total={data?.total ?? 0} onPage={setPage} />
          </div>
        )}
      </Card>

      {editId && <ContentEditor id={editId === "new" ? null : editId} onClose={() => setEditId(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["admin", "content"] }); setEditId(null); }} />}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = { draft: "bg-neutral-100 text-neutral-700", published: "bg-emerald-50 text-emerald-700", archived: "bg-amber-50 text-amber-700" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[status] ?? "bg-neutral-100"}`}>{status}</span>;
}

function ContentEditor({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: () => void }) {
  const getFn = useServerFn(getContent);
  const saveFn = useServerFn(upsertContent);
  const { data: existing, isLoading } = useQuery({
    queryKey: ["admin", "content", id],
    queryFn: () => getFn({ data: { id: id! } }),
    enabled: !!id,
  });

  const [form, setForm] = useState<{ slug: string; title: string; body: string; status: "draft" | "published" | "archived"; seo_title: string; seo_description: string; publish_at: string }>({
    slug: "", title: "", body: "", status: "draft", seo_title: "", seo_description: "", publish_at: "",
  });
  const [hydrated, setHydrated] = useState(false);
  if (existing && !hydrated) {
    setForm({
      slug: existing.slug, title: existing.title, body: existing.body ?? "",
      status: existing.status as "draft" | "published" | "archived",
      seo_title: existing.seo_title ?? "", seo_description: existing.seo_description ?? "",
      publish_at: existing.publish_at ? new Date(existing.publish_at).toISOString().slice(0, 16) : "",
    });
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      id: id ?? undefined,
      slug: form.slug, title: form.title, body: form.body, status: form.status,
      seo_title: form.seo_title || null, seo_description: form.seo_description || null,
      publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null,
    } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">{id ? "Edit page" : "New page"}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900">✕</button>
        </div>
        {id && isLoading ? <LoadingRows /> : (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title"><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" /></Field>
              <Field label="Slug"><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="about-us" className="w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-sm" /></Field>
            </div>
            <Field label="Body (Markdown)"><textarea rows={10} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as "draft" | "published" | "archived" })} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <Field label="Publish at (optional)"><input type="datetime-local" value={form.publish_at} onChange={e => setForm({ ...form, publish_at: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" /></Field>
            </div>
            <Field label="SEO title"><input value={form.seo_title} onChange={e => setForm({ ...form, seo_title: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" /></Field>
            <Field label="SEO description"><textarea rows={2} value={form.seo_description} onChange={e => setForm({ ...form, seo_description: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" /></Field>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-neutral-100 px-6 py-4">
          <button onClick={onClose} className="rounded-full border border-neutral-200 px-4 py-2 text-xs">Cancel</button>
          <button disabled={!form.title || !form.slug || save.isPending} onClick={() => save.mutate()} className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs"><span className="mb-1 block text-neutral-600">{label}</span>{children}</label>;
}
