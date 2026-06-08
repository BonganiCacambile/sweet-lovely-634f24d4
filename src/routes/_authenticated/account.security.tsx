import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, KeyRound, Smartphone, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { Field, fieldCls } from "@/components/auth/login-form";
import { OtpVerification } from "@/components/auth/otp-verification";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account/security")({
  head: () => ({ meta: [{ title: "Security — Pepper" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <AccountShell title="Security center">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChangePasswordCard />
        <TwoFactorCard />
        <SessionsCard />
        <RecoveryCard />
      </div>
    </AccountShell>
  );
}

function ChangePasswordCard() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Min 8 characters");
    if (pwd !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) return toast.error(error.message);
    setPwd("");
    setConfirm("");
    toast.success("Password changed");
  };
  return (
    <Card>
      <Header icon={KeyRound} title="Change password" subtitle="Use a unique, strong password." />
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="New password">
          <input type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)} className={fieldCls} />
        </Field>
        <Field label="Confirm password">
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldCls} />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Update password
        </button>
      </form>
    </Card>
  );
}

function TwoFactorCard() {
  const [factors, setFactors] = useState<Array<{ id: string; friendly_name?: string; status: string }>>([]);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Array<{ id: string; friendly_name?: string; status: string }>);
  };

  useEffect(() => {
    refresh();
  }, []);

  const startEnroll = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
    setLoading(false);
    if (error || !data) return toast.error(error?.message ?? "Could not start enrollment");
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verifyEnroll = async () => {
    if (!enrolling) return;
    setLoading(true);
    const { data: c } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (!c) {
      setLoading(false);
      return toast.error("Challenge failed");
    }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrolling.id, challengeId: c.id, code });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication enabled");
    setEnrolling(null);
    setCode("");
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return toast.error(error.message);
    toast.success("Authenticator removed");
    refresh();
  };

  return (
    <Card>
      <Header icon={ShieldCheck} title="Two-factor authentication" subtitle="Add a second step at sign-in." />
      <div className="mt-4">
        {factors.length > 0 && !enrolling && (
          <ul className="space-y-2">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-neutral-500" />
                  <span className="font-medium text-neutral-900">{f.friendly_name || "Authenticator"}</span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider " +
                      (f.status === "verified"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700")
                    }
                  >
                    {f.status}
                  </span>
                </span>
                <button onClick={() => remove(f.id)} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!enrolling && (
          <button
            onClick={startEnroll}
            disabled={loading}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Add authenticator app
          </button>
        )}

        {enrolling && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-3">
            <p className="text-sm text-neutral-600">
              Scan this QR code in your authenticator app, then enter the 6-digit code.
            </p>
            <div className="flex items-center gap-4">
              <img src={enrolling.qr} alt="MFA QR code" className="h-36 w-36 rounded-xl border border-neutral-200 bg-white p-2" />
              <div className="text-xs text-neutral-500">
                <p className="font-medium text-neutral-700">Or enter the secret manually:</p>
                <p className="mt-1 break-all font-mono text-[11px]">{enrolling.secret}</p>
              </div>
            </div>
            <OtpVerification value={code} onChange={setCode} />
            <div className="flex gap-2">
              <button
                onClick={verifyEnroll}
                disabled={loading || code.length < 6}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify and enable
              </button>
              <button
                onClick={() => {
                  if (enrolling) supabase.auth.mfa.unenroll({ factorId: enrolling.id });
                  setEnrolling(null);
                  setCode("");
                }}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
}

function SessionsCard() {
  return (
    <Card>
      <Header icon={Smartphone} title="Active sessions" subtitle="Sign out other devices if anything looks off." />
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-2xl border border-neutral-200 px-3 py-2.5">
          <div>
            <p className="font-medium text-neutral-900">This device</p>
            <p className="text-xs text-neutral-500">
              {typeof navigator !== "undefined" ? navigator.userAgent.split(") ")[0].split("(")[1] ?? "Browser" : "Browser"}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
            Current
          </span>
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut({ scope: "others" });
            toast.success("Other sessions signed out");
          }}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Sign out other devices
        </button>
      </div>
    </Card>
  );
}

function RecoveryCard() {
  return (
    <Card>
      <Header icon={KeyRound} title="Recovery codes" subtitle="Save a backup code in case you lose your device." />
      <p className="mt-3 text-sm text-neutral-500">
        Recovery codes will be available once two-factor authentication is fully verified.
      </p>
    </Card>
  );
}

function Header({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0f3] text-[#ff003c]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
    </div>
  );
}