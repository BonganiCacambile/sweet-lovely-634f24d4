import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { PageHeader } from "@/components/admin/page-header";
import { Card, EmptyState, LoadingRows } from "@/components/admin/data-shell";
import { listSupportReplyAudit } from "@/lib/admin/support-reply-audit.functions";

export const Route = createFileRoute("/_authenticated/admin/support-reply-audit")({
  beforeLoad: requireMainAdminGuard,
  head: () => ({
    meta: [
      { title: "Support Reply Audit | Sweet 'n Lovely Admin" },
      { name: "description", content: "Audit trail of support replies and test sends." },
    ],
  }),
  component: () => (
    <MainAdminGuard>
      <ReplyAuditPage />
    </MainAdminGuard>
  ),
});

function ReplyAuditPage() {
  const listFn = useServerFn(listSupportReplyAudit);
  const [kind, setKind] = useState<"" | "sent" | "test">("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "support-reply-audit", kind, search, from, to, page],
    queryFn: () => listFn({ data: { kind, search, from, to, page, pageSize } }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6" data-testid="support-reply-audit-page">
      <PageHeader
        title="Support Reply Audit"
        description="Every reply sent to a customer and every test send, with who sent it and where it went."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            data-testid="reply-audit-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by request ID, customer or admin email…"
            className="min-w-[260px] flex-1 rounded-full border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-neutral-400"
          />
          <select
            data-testid="reply-audit-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as "" | "sent" | "test");
              setPage(1);
            }}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
          >
            <option value="">All sends</option>
            <option value="sent">Customer replies</option>
            <option value="test">Test sends</option>
          </select>
          <input
            type="date"
            data-testid="reply-audit-from"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
          />
          <input
            type="date"
            data-testid="reply-audit-to"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
          />
          {kind || search || from || to ? (
            <button
              type="button"
              data-testid="reply-audit-reset"
              onClick={() => {
                setKind("");
                setSearch("");
                setFrom("");
                setTo("");
                setPage(1);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800"
            >
              Reset
            </button>
          ) : null}
        </div>

        {isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState title="No reply activity" hint="Replies and test sends will appear here." />
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-neutral-200 p-3" data-testid="reply-audit-row">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.kind === "test"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {r.kind === "test" ? "Test send" : "Customer reply"}
                  </span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  <span>· by {r.actor_email ?? "unknown admin"}</span>
                  {r.channel ? <span>· {r.channel === "in_app" ? "in-app" : "email"}</span> : null}
                  {r.delivered_in_app !== null ? (
                    <span>· {r.delivered_in_app ? "delivered in-app" : "email handoff"}</span>
                  ) : null}
                  {r.status ? <span>· request {r.status}</span> : null}
                </div>
                <p className="mt-1.5 text-sm text-neutral-800">
                  To <span className="font-medium">{r.target_email ?? "unknown"}</span>
                  {r.request_name ? ` · ${r.request_name}` : ""} · ref{" "}
                  <span className="font-mono text-xs">{r.request_id.slice(0, 8)}</span>
                </p>
                {r.body ? (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-neutral-600">{r.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
          <span data-testid="reply-audit-total">{total} record{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-neutral-200 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-neutral-200 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
