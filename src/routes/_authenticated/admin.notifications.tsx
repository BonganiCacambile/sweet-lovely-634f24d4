import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import {
  broadcastNotification, deleteNotifications, listNotifications, markNotifications, notificationStats,
} from "@/lib/admin/notifications.functions";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: () => (
    <MainAdminGuard>
      <NotificationsPage />
    </MainAdminGuard>
  ),
});

function NotificationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [read, setRead] = useState<"all" | "unread" | "read">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState(false);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listNotifications);
  const statsFn = useServerFn(notificationStats);
  const markFn = useServerFn(markNotifications);
  const delFn = useServerFn(deleteNotifications);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "notifications", { debounced, category, read, page }],
    queryFn: () => listFn({ data: { search: debounced, category, read, page, pageSize: 50 } }),
  });
  const { data: stats } = useQuery({ queryKey: ["admin", "notifications", "stats"], queryFn: () => statsFn() });

  useRealtimeTable("notifications", [["admin", "notifications"], ["admin", "notifications", "stats"]], (e) => {
    if (e.eventType === "INSERT") toast("New notification");
  });

  const mark = useMutation({
    mutationFn: (vars: { ids: string[]; read: boolean }) => markFn({ data: vars }),
    onSuccess: () => {
      toast.success("Updated");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const del = useMutation({
    mutationFn: (ids: string[]) => delFn({ data: { ids } }),
    onSuccess: () => {
      toast.success("Deleted");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = data?.rows ?? [];
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));

  const exportCols = useMemo(() => ([
    { key: "created_at", label: "When", map: (r: { created_at: string }) => formatDateTime(r.created_at) },
    { key: "category", label: "Category" },
    { key: "title", label: "Title" },
    { key: "body", label: "Body" },
    { key: "user_id", label: "User ID" },
    { key: "read", label: "Read", map: (r: { read: boolean }) => r.read ? "yes" : "no" },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Notifications"
        description="Broadcast updates and monitor delivery across your audience."
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu rows={rows} columns={exportCols} filename="notifications" title="Notifications" />
            <button onClick={() => setComposer(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#ff003c] px-3 py-2 text-xs font-semibold text-white hover:bg-[#e6002f]">
              <Send className="h-3.5 w-3.5" /> Broadcast
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total notifications" value={(stats?.total ?? 0).toLocaleString()} />
        <Stat label="Unread" value={(stats?.unread ?? 0).toLocaleString()} />
        <Stat label="Categories" value={(stats?.categories.length ?? 0).toLocaleString()} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <input value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} placeholder="Search title or body…" className="flex-1 min-w-[200px] rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs" />
          <select value={category} onChange={e => { setPage(1); setCategory(e.target.value); }} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs">
            <option value="">All categories</option>
            {(stats?.categories ?? []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={read} onChange={e => { setPage(1); setRead(e.target.value as "all" | "unread" | "read"); }} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs">
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs">
              <span>{selected.size} selected</span>
              <button onClick={() => mark.mutate({ ids: Array.from(selected), read: true })} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1"><CheckCheck className="h-3 w-3" /> Mark read</button>
              <button onClick={() => mark.mutate({ ids: Array.from(selected), read: false })} className="rounded-full bg-white px-2 py-1">Mark unread</button>
              <button onClick={() => { if (confirm(`Delete ${selected.size} notifications?`)) del.mutate(Array.from(selected)); }} className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-1 text-white"><Trash2 className="h-3 w-3" /> Delete</button>
            </div>
          )}
        </div>

        {error ? <ErrorPanel error={error} onRetry={() => refetch()} /> : null}
        {isLoading ? <LoadingRows /> : rows.length === 0 ? (
          <EmptyState icon={<Bell className="h-5 w-5" />} title="No notifications" hint="Try a different filter or broadcast a new one." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="w-8 px-3 py-2"><input type="checkbox" checked={allSelected} onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} /></th>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Body</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={`border-t border-neutral-100 ${r.read ? "" : "bg-rose-50/30"}`}>
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.id)} onChange={e => setSelected(s => { const n = new Set(s); e.target.checked ? n.add(r.id) : n.delete(r.id); return n; })} /></td>
                    <td className="px-3 py-2 whitespace-nowrap text-neutral-600" title={formatDateTime(r.created_at)}>{formatRelative(r.created_at)}</td>
                    <td className="px-3 py-2"><span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">{r.category}</span></td>
                    <td className="px-3 py-2 font-medium text-neutral-900">{r.title}</td>
                    <td className="px-3 py-2 max-w-[320px] truncate text-neutral-600">{r.body ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-neutral-500">{(r.user_id as string).slice(0, 8)}…</td>
                    <td className="px-3 py-2">{r.read ? <span className="text-neutral-500">Read</span> : <span className="font-semibold text-rose-600">Unread</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={50} total={data?.total ?? 0} onPage={setPage} />
          </div>
        )}
      </Card>

      {composer && <BroadcastDialog onClose={() => setComposer(false)} categories={stats?.categories ?? []} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_10px_40px_-24px_rgba(15,15,15,0.18)]">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function BroadcastDialog({ onClose, categories }: { onClose: () => void; categories: string[] }) {
  const qc = useQueryClient();
  const fn = useServerFn(broadcastNotification);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [audience, setAudience] = useState<"all" | "admins" | "user">("all");
  const [userId, setUserId] = useState("");

  const send = useMutation({
    mutationFn: () => fn({ data: { title, body, category, audience, userId: audience === "user" ? userId : undefined } }),
    onSuccess: (r) => {
      toast.success(`Sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-neutral-900">Broadcast notification</h2>
        <p className="text-xs text-neutral-500">Delivered in-app instantly. Email/SMS requires connected providers.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs"><span className="text-neutral-600">Title</span>
            <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" placeholder="System update available" /></label>
          <label className="block text-xs"><span className="text-neutral-600">Body</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs"><span className="text-neutral-600">Category</span>
              <input value={category} onChange={e => setCategory(e.target.value)} list="cat-list" className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="block text-xs"><span className="text-neutral-600">Audience</span>
              <select value={audience} onChange={e => setAudience(e.target.value as "all" | "admins" | "user")} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                <option value="all">All users</option>
                <option value="admins">Admins only</option>
                <option value="user">Specific user</option>
              </select>
            </label>
          </div>
          {audience === "user" && (
            <label className="block text-xs"><span className="text-neutral-600">User ID (UUID)</span>
              <input value={userId} onChange={e => setUserId(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs" /></label>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-neutral-200 px-4 py-2 text-xs">Cancel</button>
          <button disabled={!title || send.isPending} onClick={() => send.mutate()} className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{send.isPending ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}