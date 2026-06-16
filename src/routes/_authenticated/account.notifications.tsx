import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  updatePreferences,
} from "@/lib/account/account.functions";
import { useAuth } from "@/lib/auth-context";
import { Bell, Check, Loader2, Trash2, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Sweet & Lovely" }] }),
  component: NotificationsPage,
});

type Channel = "email" | "sms" | "push";
type Kind = "orders" | "security" | "promotions" | "account";
type Prefs = Record<Channel, Record<Kind, boolean>>;

const DEFAULT_PREFS: Prefs = {
  email: { orders: true, security: true, promotions: false, account: true },
  sms: { orders: false, security: true, promotions: false, account: false },
  push: { orders: true, security: true, promotions: false, account: true },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "order", label: "Orders" },
  { key: "security", label: "Security" },
  { key: "promotion", label: "Promotions" },
  { key: "account", label: "Account" },
] as const;

function NotificationsPage() {
  const qc = useQueryClient();
  const { profile, refreshProfile } = useAuth();
  const fetchList = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const del = useServerFn(deleteNotification);
  const savePrefs = useServerFn(updatePreferences);

  const { data, isLoading } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => fetchList(),
  });
  useRealtimeInvalidate(["notifications"], [["my-notifications"], ["account-overview"]]);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const items = data?.notifications ?? [];

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter === "all") return true;
      if (filter === "unread") return !n.read;
      return String(n.category).toLowerCase().includes(filter);
    });
  }, [items, filter]);

  const toggleRead = useMutation({
    mutationFn: (v: { id: string; read: boolean }) => markRead({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const removeOne = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const allRead = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const prefs: Prefs = (profile as any)?.notification_prefs ?? DEFAULT_PREFS;

  const togglePref = async (ch: Channel, kind: Kind) => {
    const next: Prefs = {
      ...prefs,
      [ch]: { ...prefs[ch], [kind]: !prefs[ch][kind] },
    } as Prefs;
    try {
      await savePrefs({ data: { notification_prefs: next } });
      await refreshProfile();
      toast.success("Preferences saved");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save");
    }
  };

  return (
    <AccountShell title="Notifications">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-semibold " +
                  (filter === f.key
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => allRead.mutate()}
            disabled={allRead.isPending || items.every((i) => i.read)}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-8 text-neutral-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
              <Bell className="h-6 w-6" />
            </span>
            <p className="text-base font-semibold text-neutral-900">You're all caught up</p>
            <p className="mt-1 text-sm text-neutral-500">New activity will appear here in real time.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={"text-sm " + (n.read ? "text-neutral-700" : "font-semibold text-neutral-900")}>{n.title}</p>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                      {n.category}
                    </span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-[#ff003c]" />}
                  </div>
                  {n.body && <p className="mt-1 text-sm text-neutral-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-neutral-400">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleRead.mutate({ id: n.id, read: !n.read })}
                    title={n.read ? "Mark unread" : "Mark read"}
                    className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeOne.mutate(n.id)}
                    className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preferences */}
      <Card>
        <p className="text-sm font-semibold text-neutral-900">Delivery preferences</p>
        <p className="mt-1 text-xs text-neutral-500">Choose how you want to hear from us.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="py-2 pr-3">Type</th>
                <th className="px-3">Email</th>
                <th className="px-3">SMS</th>
                <th className="px-3">Push</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(["orders", "security", "account", "promotions"] as Kind[]).map((kind) => (
                <tr key={kind}>
                  <td className="py-3 pr-3 font-medium capitalize text-neutral-800">{kind}</td>
                  {(["email", "sms", "push"] as Channel[]).map((ch) => (
                    <td key={ch} className="px-3">
                      <Toggle on={Boolean(prefs[ch]?.[kind])} onChange={() => togglePref(ch, kind)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AccountShell>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
        (on ? "bg-[#ff003c]" : "bg-neutral-200")
      }
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
          (on ? "translate-x-5" : "translate-x-0.5")
        }
      />
    </button>
  );
}