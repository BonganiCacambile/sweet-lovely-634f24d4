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
  getSupportEmailSettings,
  listSupportEmailZones,
  resetSupportEmailSettings,
  saveSupportEmailSettings,
} from "@/lib/admin/support-email-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/support-email-settings")({
  beforeLoad: requireMainAdminGuard,
  head: () => ({
    meta: [
      { title: "Support Email Recipients | Sweet 'n Lovely Admin" },
      {
        name: "description",
        content:
          "Choose which main admins and delivery-zone admins receive support request email alerts per zone.",
      },
      { property: "og:title", content: "Support Email Recipients | Sweet 'n Lovely Admin" },
      {
        property: "og:description",
        content: "Per-zone email alert recipients for new support requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <MainAdminGuard>
      <SupportEmailSettingsPage />
    </MainAdminGuard>
  ),
});

function SupportEmailSettingsPage() {
  const qc = useQueryClient();
  const listZonesFn = useServerFn(listSupportEmailZones);
  const getFn = useServerFn(getSupportEmailSettings);
  const saveFn = useServerFn(saveSupportEmailSettings);
  const resetFn = useServerFn(resetSupportEmailSettings);

  const [zoneId, setZoneId] = useState<string | null>(null);

  const zonesQuery = useQuery({
    queryKey: ["admin", "support-email", "zones"],
    queryFn: () => listZonesFn({ data: {} }),
  });

  const settingsQuery = useQuery({
    queryKey: ["admin", "support-email", "settings", zoneId ?? "default"],
    queryFn: () => getFn({ data: { zoneId } }),
  });

  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<"all" | "custom">("all");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [extraEmails, setExtraEmails] = useState("");

  useEffect(() => {
    const c = settingsQuery.data?.config;
    if (!c) return;
    setEnabled(c.enabled);
    setMode(c.mode);
    setUserIds(c.userIds);
    setExtraEmails(c.extraEmails.join(", "));
  }, [settingsQuery.data]);

  const parsedExtras = extraEmails
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { zoneId, enabled, mode, userIds, extraEmails: parsedExtras } }),
    onSuccess: () => {
      toast.success(zoneId ? "Zone recipients saved" : "Default recipients saved");
      qc.invalidateQueries({ queryKey: ["admin", "support-email"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: { zoneId: zoneId as string } }),
    onSuccess: () => {
      toast.success("Zone override removed — using the default");
      qc.invalidateQueries({ queryKey: ["admin", "support-email"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const candidates = settingsQuery.data?.candidates ?? [];
  const recipients = settingsQuery.data?.recipients ?? [];

  function toggleUser(id: string) {
    setUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-6" data-testid="support-email-settings-page">
      <PageHeader
        title="Support Email Recipients"
        description="Pick which main admins and delivery-zone admins get an email when a new support request arrives."
      />

      <Card className="p-5">
        <label className="text-[11px] uppercase tracking-wider text-neutral-500">
          Configuration for
        </label>
        <select
          data-testid="support-email-zone"
          value={zoneId ?? ""}
          onChange={(e) => setZoneId(e.target.value || null)}
          className="mt-1 block w-full max-w-md rounded-full border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-neutral-400"
        >
          <option value="">Default (all zones without an override)</option>
          {(zonesQuery.data?.zones ?? []).map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
              {z.hasOverride ? " — custom" : ""}
              {z.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </Card>

      <Card className="p-5">
        {settingsQuery.isLoading ? (
          <p className="text-sm text-neutral-500">Loading recipients…</p>
        ) : (
          <div className="space-y-5">
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                data-testid="support-email-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Send email alerts for new support requests
            </label>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Recipients</p>
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="radio"
                  name="support-email-mode"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                />
                All main admins and this zone&apos;s admins
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="radio"
                  name="support-email-mode"
                  data-testid="support-email-mode-custom"
                  checked={mode === "custom"}
                  onChange={() => setMode("custom")}
                />
                Only the admins I select
              </label>
            </div>

            {mode === "custom" ? (
              <div className="rounded-2xl border border-neutral-200 p-3">
                {candidates.length === 0 ? (
                  <p className="text-xs text-neutral-500">
                    No admins found for this selection. Assign a zone admin first.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {candidates.map((c) => (
                      <li key={c.userId}>
                        <label className="flex items-center gap-2 text-sm text-neutral-800">
                          <input
                            type="checkbox"
                            data-testid={`support-email-user-${c.userId}`}
                            checked={userIds.includes(c.userId)}
                            onChange={() => toggleUser(c.userId)}
                          />
                          <span>{c.email}</span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-600">
                            {c.isMain ? "Main admin" : "Zone admin"}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div>
              <label className="text-[11px] uppercase tracking-wider text-neutral-500">
                Additional email addresses
              </label>
              <input
                type="text"
                data-testid="support-email-extras"
                value={extraEmails}
                onChange={(e) => setExtraEmails(e.target.value)}
                placeholder="ops@example.com, manager@example.com"
                className="mt-1 w-full max-w-xl rounded-full border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-neutral-400"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Comma separated. These always receive the alert for this selection.
              </p>
            </div>

            <div
              className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-600"
              data-testid="support-email-preview"
            >
              <p className="font-medium text-neutral-800">Currently emailed ({recipients.length})</p>
              <p className="mt-0.5 break-words">
                {recipients.length ? recipients.join(", ") : "Nobody — no alerts will be sent."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="support-email-save"
                disabled={save.isPending}
                onClick={() => save.mutate()}
                className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save recipients"}
              </button>
              {zoneId ? (
                <button
                  type="button"
                  data-testid="support-email-reset"
                  disabled={reset.isPending}
                  onClick={() => reset.mutate()}
                  className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {reset.isPending ? "Removing…" : "Use default instead"}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
