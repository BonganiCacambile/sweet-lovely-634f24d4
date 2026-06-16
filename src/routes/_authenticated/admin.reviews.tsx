import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Search, Check, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, EmptyState, ErrorPanel, LoadingRows, Pagination } from "@/components/admin/data-shell";
import { ExportMenu } from "@/components/admin/export-menu";
import { useDebounced } from "@/hooks/use-debounced";
import { formatRelative } from "@/lib/admin/format";
import { listReviews, moderateReview, deleteReview, reviewStats } from "@/lib/admin/reviews.functions";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: () => (
    <MainAdminGuard>
      <ReviewsPage />
    </MainAdminGuard>
  ),
});

function ReviewsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"" | "pending" | "approved" | "rejected">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search, 300);

  const listFn = useServerFn(listReviews);
  const statsFn = useServerFn(reviewStats);
  const moderateFn = useServerFn(moderateReview);
  const deleteFn = useServerFn(deleteReview);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin","reviews","list",{ status, search: debounced, page }],
    queryFn: () => listFn({ data: { status, search: debounced, page, pageSize: 25 } }),
  });
  const { data: stats } = useQuery({ queryKey: ["admin","reviews","stats"], queryFn: () => statsFn() });

  const moderate = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" | "pending" }) => moderateFn({ data: v }),
    onSuccess: () => { toast.success("Review updated"); qc.invalidateQueries({ queryKey: ["admin","reviews"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Review deleted"); qc.invalidateQueries({ queryKey: ["admin","reviews"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCols = useMemo(() => ([
    { key: "product_slug", label: "Product" },
    { key: "author_name", label: "Author" },
    { key: "rating", label: "Rating" },
    { key: "status", label: "Status" },
    { key: "comment", label: "Comment" },
    { key: "created_at", label: "Created" },
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Reviews"
        description="Moderate customer reviews and surface trending feedback."
        actions={<ExportMenu rows={data?.rows ?? []} columns={exportCols as never} filename="reviews" />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="Total" value={stats?.total ?? 0} />
        <StatBlock label="Pending" value={stats?.byStatus.pending ?? 0} />
        <StatBlock label="Approved" value={stats?.byStatus.approved ?? 0} />
        <StatBlock label="Avg rating" value={(stats?.avgRating ?? 0).toFixed(2)} suffix={<Star className="h-3.5 w-3.5 text-amber-500" />} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search by author, product, comment…" className="h-9 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm" />
          </div>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as never); }} className="h-9 rounded-full border border-neutral-200 bg-white px-3 text-sm">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {error ? <div className="p-4"><ErrorPanel error={error} onRetry={() => void refetch()} /></div>
          : isLoading ? <LoadingRows />
          : (data?.rows.length ?? 0) === 0 ? <div className="p-6"><EmptyState icon={<Star className="h-5 w-5" />} title="No reviews" /></div>
          : (
            <>
              <ul className="divide-y divide-neutral-100">
                {data!.rows.map((r) => (
                  <li key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-medium text-neutral-900">{r.author_name}</span>
                          <span className="text-xs text-neutral-500">on <span className="font-medium">{r.product_slug}</span></span>
                          <StatusBadge status={r.status} />
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`} />
                            ))}
                          </div>
                        </div>
                        {r.comment && <p className="text-sm text-neutral-700">{r.comment}</p>}
                        <p className="mt-1 text-[11px] text-neutral-500">{formatRelative(r.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {r.status !== "approved" && <button onClick={() => moderate.mutate({ id: r.id, status: "approved" })} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"><Check className="h-3 w-3" /> Approve</button>}
                        {r.status !== "rejected" && <button onClick={() => moderate.mutate({ id: r.id, status: "rejected" })} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50"><Ban className="h-3 w-3" /> Reject</button>}
                        <button onClick={() => { if (confirm("Delete this review?")) remove.mutate(r.id); }} className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-100"><Trash2 className="h-3 w-3" /> Delete</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pageSize={data!.pageSize} total={data!.total} onPage={setPage} />
            </>
          )}
      </Card>
    </div>
  );
}

function StatBlock({ label, value, suffix }: { label: string; value: number | string; suffix?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200/70 bg-white/80 p-4">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold text-neutral-900">{value} {suffix}</p>
    </div>
  );
}