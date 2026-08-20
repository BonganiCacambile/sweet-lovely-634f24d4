import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { requireMainAdminGuard } from "@/lib/admin/route-guards";
import { MainAdminGuard } from "@/components/admin/main-admin-guard";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/admin/data-shell";
import {
  getAuditRetentionSettings,
  previewAuditRetentionCleanup,
  runAuditRetentionCleanup,
  saveAuditRetentionSettings,
} from "@/lib/admin/audit-retention.functions";

export const Route = createFileRoute("/_authenticated/admin/audit-retention")({
  beforeLoad: requireMainAdminGuard,
  head: () => ({
    meta: [
      { title: "Audit Retention | Sweet 'n Lovely Admin" },
      {
        name: "description",
        content: "Configure how long support reply audit entries are kept and schedule automatic cleanup.",
      },
      { property: "og:title", content: "Audit Retention | Sweet 'n Lovely Admin" },
      {
        property: "og:description",
        content: "Retention window and scheduled cleanup for support reply audit logs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <MainAdminGuard>
      <AuditRetentionPage />
    </MainAdminGuard>
  ),
});

function AuditRetentionPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAuditRetentionSettings);
  const saveFn = useServerFn(saveAuditRetentionSettings);
  const previewFn = useServerFn(previewAuditRetentionCleanup);
  const runFn = useServerFn(runAuditRetentionCleanup);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-retention"],
    queryFn: () => getFn({ data: {} }),
  });

  const [enabled, setEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(365);
  const [keepCustomerReplies, setKeepCustomerReplies] = useState(true);
  const [preview, setPreview] = useState<{ deleted: number; cutoff: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setRetentionDays(data.retentionDays);
    setKeepCustomerReplies(data.keepCustomerReplies);
  }, [data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { enabled, retentionDays, keepCustomerReplies } }),
    onSuccess: () => {
      toast.success("Retention settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "audit-retention"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewRun = useMutation({
    mutationFn: () => previewFn({ data: { retentionDays, keepCustomerReplies } }),
    onSuccess: (r) => {
      setPreview(r);
      toast.message(`${r.deleted} entr${r.deleted === 1 ? "y" : "ies"} older than the window`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: () => runFn({ data: { retentionDays, keepCustomerReplies } }),
    onSuccess: (r) => {
      setPreview(null);
      toast.success(`Deleted ${r.deleted} audit entr${r.deleted === 1 ? "y" : "ies"}`);
      qc.invalidateQueries({ queryKey: ["admin", "audit-retention"] });
      qc.invalidateQueries({ queryKey: ["admin", "support-reply-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6" data-testid="audit-retention-page">
      <PageHeader
        title="Audit Retention"
        description="Control how long support reply audit entries are kept and run or schedule automatic cleanup."
      />

      <Card className="p-5">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading settings…</p>
        ) : (
          <div className="space-y-5">
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                data-testid="retention-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enable scheduled cleanup
            </label>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-neutral-500">
                Retention window (days)
              </label>
              <input
                type="number"
                min={7}
                max={3650}
                data-testid="retention-days"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value) || 0)}
                className="mt-1 w-40 rounded-full border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-neutral-400"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Entries older than this are removed. Minimum 7 days, maximum 10 years.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                data-testid="retention-keep-customer-replies"
                checked={keepCustomerReplies}
                onChange={(e) => setKeepCustomerReplies(e.target.checked)}
              />
              <span>
                Keep customer reply records forever
                <span className="block text-xs text-neutral-500">
                  Only test sends and export records are purged. Recommended for dispute history.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="retention-save"
                disabled={save.isPending}
                onClick={() => save.mutate()}
                className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save settings"}
              </button>
              <button
                type="button"
                data-testid="retention-preview"
                disabled={previewRun.isPending}
                onClick={() => previewRun.mutate()}
                className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                {previewRun.isPending ? "Checking…" : "Preview cleanup"}
              </button>
              <button
                type="button"
                data-testid="retention-run"
                disabled={runNow.isPending}
                onClick={() => {
                  if (window.confirm("Permanently delete audit entries older than the retention window?")) {
                    runNow.mutate();
                  }
                }}
                className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {runNow.isPending ? "Cleaning…" : "Run cleanup now"}
              </button>
            </div>

            {preview ? (
              <p className="text-xs text-neutral-600" data-testid="retention-preview-result">
                {preview.deleted} entr{preview.deleted === 1 ? "y" : "ies"} logged before{" "}
                {new Date(preview.cutoff).toLocaleString()} would be deleted.
              </p>
            ) : null}

            <div className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-600" data-testid="retention-last-run">
              <p className="font-medium text-neutral-800">Last cleanup</p>
              <p className="mt-0.5">
                {data?.lastRunAt
                  ? `${new Date(data.lastRunAt).toLocaleString()} · ${data.lastRunDeleted} deleted · ${data.lastRunSource ?? "manual"}`
                  : "No cleanup has run yet."}
              </p>
              <p className="mt-2">
                Scheduler endpoint:{" "}
                <code className="font-mono">POST /api/public/audit-retention-cleanup</code> with header{" "}
                <code className="font-mono">x-cleanup-token</code> set to the AUDIT_CLEANUP_TOKEN secret.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
