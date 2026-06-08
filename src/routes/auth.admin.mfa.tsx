import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, MessageSquare, Mail, KeyRound, ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AdminAuthLayout } from "@/components/admin/admin-auth-layout";
import { MfaInput } from "@/components/admin/mfa-input";

export const Route = createFileRoute("/auth/admin/mfa")({
  head: () => ({
    meta: [
      { title: "Two-factor verification — Sweet & Lovely Admin" },
      { name: "description", content: "Verify your identity to access the Sweet & Lovely admin console." },
    ],
  }),
  component: AdminMfa,
});

type Method = "authenticator" | "sms" | "email" | "recovery";

const METHODS: Array<{ id: Method; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "authenticator", label: "Authenticator app", description: "Open Google Authenticator, 1Password or Authy.", icon: Smartphone },
  { id: "sms", label: "SMS code", description: "Sent to the phone on file ending ••42.", icon: MessageSquare },
  { id: "email", label: "Email code", description: "Sent to your administrator inbox.", icon: Mail },
  { id: "recovery", label: "Recovery code", description: "Use one of your saved backup codes.", icon: KeyRound },
];

function AdminMfa() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("authenticator");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [remember, setRemember] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sl_admin_mfa_pending");
      if (raw) {
        const parsed = JSON.parse(raw) as { email?: string };
        if (parsed.email) setPendingEmail(parsed.email);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // Reset code when changing method
  useEffect(() => { setCode(""); }, [method]);

  const verify = async (value?: string) => {
    const final = value ?? code;
    const required = method === "recovery" ? 8 : 6;
    if (final.length < required) {
      toast.error("Code incomplete", { description: `Enter all ${required} characters.` });
      return;
    }
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 700));
    setVerifying(false);
    try { sessionStorage.removeItem("sl_admin_mfa_pending"); } catch { /* ignore */ }
    toast.success("Identity verified", { description: "Welcome to the admin console." });
    navigate({ to: "/admin" });
  };

  const resend = () => {
    setSecondsLeft(45);
    toast.success("New code sent");
  };

  const isRecovery = method === "recovery";

  return (
    <AdminAuthLayout
      eyebrow="Two-factor verification"
      title="One more step"
      subtitle="Choose how you'd like to verify your identity. Your admin session will only start once a valid code is confirmed."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
          <Link to="/auth/admin" className="inline-flex items-center gap-1 hover:text-neutral-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          {pendingEmail && <span className="truncate">{pendingEmail}</span>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={
                  "flex items-start gap-2 rounded-2xl border p-3 text-left text-xs transition " +
                  (active
                    ? "border-[#ff003c] bg-[#fff0f3] text-[#ff003c]"
                    : "border-neutral-200 bg-white/70 text-neutral-700 hover:bg-white")
                }
              >
                <span
                  className={
                    "flex h-7 w-7 flex-none items-center justify-center rounded-xl " +
                    (active ? "bg-white text-[#ff003c]" : "bg-neutral-100 text-neutral-700")
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{m.label}</span>
                  <span className={"mt-0.5 block text-[11px] " + (active ? "text-[#ff003c]/80" : "text-neutral-500")}>
                    {m.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={method}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                {isRecovery ? "8-character recovery code" : "6-digit code"}
              </p>
              <MfaInput
                value={code}
                onChange={setCode}
                onComplete={(v) => verify(v)}
                length={isRecovery ? 8 : 6}
                disabled={verifying}
              />
            </div>

            {!isRecovery && (
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>
                  {secondsLeft > 0 ? (
                    <>Code expires in <span className="font-medium text-neutral-700">{secondsLeft}s</span></>
                  ) : (
                    "Your code has expired."
                  )}
                </span>
                <button
                  type="button"
                  onClick={resend}
                  disabled={secondsLeft > 0}
                  className="font-medium text-[#ff003c] hover:underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
                >
                  Resend code
                </button>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 bg-white/70 p-3 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-[#ff003c] focus:ring-[#ff003c]"
              />
              <span>
                <span className="font-semibold text-neutral-900">Trust this device.</span>{" "}
                Skip 2FA on this browser for 30 days.
              </span>
            </label>

            <button
              type="button"
              onClick={() => verify()}
              disabled={verifying}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_-16px_rgba(255,0,60,0.55)] transition-all hover:scale-[1.01] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {verifying ? "Verifying…" : "Verify & enter console"}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </AdminAuthLayout>
  );
}