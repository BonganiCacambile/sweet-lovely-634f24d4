import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy, MapPin, MessageSquare, Loader2 } from "lucide-react";
import { AccountShell, Card } from "@/components/auth/account-shell";
import {
  getMySupportRequests,
  getMySupportRequestReplies,
  getMySupportRequestAttachments,
} from "@/lib/support.functions";
import { AttachmentList } from "@/components/support/attachment-list";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export const Route = createFileRoute("/_authenticated/account/support")({
  head: () => ({ meta: [{ title: "Your support requests — Sweet & Lovely" }] }),
  component: SupportHistoryPage,
});

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-50 text-amber-700",
  in_progress: "bg-sky-50 text-sky-700",
  waiting_customer: "bg-violet-50 text-violet-700",
  resolved: "bg-emerald-50 text-emerald-700",
  closed: "bg-neutral-100 text-neutral-600",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_customer: "Waiting for you",
  resolved: "Resolved",
  closed: "Closed",
};

function SupportHistoryPage() {
  const listFn = useServerFn(getMySupportRequests);
  const { data, isLoading } = useQuery({
    queryKey: ["account", "support-requests"],
    queryFn: () => listFn(),
  });
  useRealtimeInvalidate(["support_requests", "support_request_replies"], [
    ["account", "support-requests"],
  ]);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <AccountShell title="Support">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">My support requests</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Track the complaints and questions you&apos;ve sent us.
            </p>
          </div>
          <Link
            to="/contact"
            className="rounded-full bg-[#ff003c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e6003a]"
          >
            New request
          </Link>
        </div>

        <div className="mt-5 space-y-3" data-testid="my-support-list">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your requests…
            </p>
          ) : (data ?? []).length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/70 p-10 text-center">
              <LifeBuoy className="mx-auto h-6 w-6 text-neutral-400" />
              <p className="mt-2 text-sm font-medium text-neutral-700">No support requests yet</p>
              <p className="text-xs text-neutral-500">Anything gone wrong with an order? Let us know.</p>
            </div>
          ) : (
            data!.map((r) => (
              <div
                key={r.id}
                data-testid="my-support-item"
                className="rounded-3xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {r.reference}
                  </span>
                  {r.zone_name && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-700">
                      <MapPin className="h-3 w-3 text-[#ff003c]" /> {r.zone_name}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[r.status] ?? "bg-neutral-100 text-neutral-700"}`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <span className="ml-auto text-[11px] text-neutral-500">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 font-medium text-neutral-900">{r.subject}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{r.message}</p>
                {r.resolution && (
                  <p className="mt-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                    Resolution: {r.resolution}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff003c]"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {openId === r.id ? "Hide responses" : "View responses"}
                </button>
                {openId === r.id && (
                  <>
                    <Attachments requestId={r.id} />
                    <Replies requestId={r.id} />
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </AccountShell>
  );
}

function Replies({ requestId }: { requestId: string }) {
  const fn = useServerFn(getMySupportRequestReplies);
  const { data, isLoading } = useQuery({
    queryKey: ["account", "support-replies", requestId],
    queryFn: () => fn({ data: { requestId } }),
  });
  if (isLoading) return <p className="mt-2 text-xs text-neutral-500">Loading responses…</p>;
  if ((data?.rows.length ?? 0) === 0)
    return <p className="mt-2 text-xs text-neutral-500">No response yet — we&apos;ll be in touch soon.</p>;
  return (
    <div className="mt-2 space-y-2" data-testid="my-support-replies">
      {data!.rows.map((reply) => (
        <div key={reply.id} className="rounded-2xl bg-neutral-50 p-3">
          <p className="text-[11px] text-neutral-500">
            Sweet &apos;n Lovely support · {new Date(reply.created_at).toLocaleString()}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{reply.body}</p>
        </div>
      ))}
    </div>
  );
}

function Attachments({ requestId }: { requestId: string }) {
  const fn = useServerFn(getMySupportRequestAttachments);
  const { data, isLoading } = useQuery({
    queryKey: ["account", "support-attachments", requestId],
    queryFn: () => fn({ data: { requestId } }),
  });
  return <AttachmentList rows={data?.rows ?? []} loading={isLoading} title="Your attachments" />;
}
