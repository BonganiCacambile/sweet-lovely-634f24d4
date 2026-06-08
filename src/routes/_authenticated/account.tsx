import { createFileRoute } from "@tanstack/react-router";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle2, ShieldCheck, MapPin, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Your account — Pepper" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user, profile } = useAuth();
  const verified = Boolean(user?.email_confirmed_at);

  return (
    <AccountShell title="Overview">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Profile</p>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Full name" value={profile?.full_name || "—"} />
            <Row label="Email" value={user?.email ?? "—"} />
            <Row label="Phone" value={profile?.phone || "—"} />
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-wider text-neutral-500">Status</p>
          <ul className="mt-3 space-y-3 text-sm">
            <Status ok={verified} label={verified ? "Email verified" : "Email not verified"} />
            <Status ok={true} label="Account in good standing" />
            <Status ok={true} label="Member of Pepper Rewards" />
          </ul>
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0f3] text-[#ff003c]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-neutral-900">Boost your account security</p>
              <p className="mt-1 text-sm text-neutral-600">
                Turn on two-factor authentication for an extra layer of protection.
              </p>
            </div>
            <a
              href="/account/security"
              className="inline-flex items-center rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
            >
              Enable 2FA
            </a>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">No saved addresses</p>
              <p className="mt-1 text-xs text-neutral-500">Add one at checkout for faster orders.</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
              <Star className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">0 Pepper points</p>
              <p className="mt-1 text-xs text-neutral-500">Earn 1 point per R10 spent.</p>
            </div>
          </div>
        </Card>
      </div>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-1.5 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className={"h-4 w-4 " + (ok ? "text-emerald-500" : "text-neutral-300")} />
      <span className={ok ? "text-neutral-800" : "text-neutral-500"}>{label}</span>
    </li>
  );
}