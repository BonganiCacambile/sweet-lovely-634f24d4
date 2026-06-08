import { createFileRoute } from "@tanstack/react-router";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/account/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Sweet & Lovely" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [prefs, setPrefs] = useState({
    orders: true,
    deals: true,
    security: true,
    marketing: false,
  });
  return (
    <AccountShell title="Notifications">
      <Card>
        <ul className="divide-y divide-neutral-100">
          {Object.entries({
            orders: "Order updates",
            deals: "Member-only deals",
            security: "Security alerts",
            marketing: "Marketing emails",
          }).map(([k, label]) => (
            <li key={k} className="flex items-center justify-between py-3">
              <span className="text-sm text-neutral-800">{label}</span>
              <Toggle
                on={(prefs as any)[k]}
                onChange={(v) => setPrefs((p) => ({ ...p, [k]: v }))}
              />
            </li>
          ))}
        </ul>
      </Card>
    </AccountShell>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
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