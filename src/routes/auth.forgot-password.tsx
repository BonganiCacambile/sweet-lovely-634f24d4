import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field, fieldCls } from "@/components/auth/login-form";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Pepper" },
      { name: "description", content: "Reset your Pepper account password securely." },
    ],
  }),
  component: ForgotPasswordPage,
});

const STEPS = ["Email", "Verify", "New password"];

function ForgotPasswordPage() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth/reset-password",
    });
    setLoading(false);
    if (error) {
      toast.error("Couldn't send reset link", { description: error.message });
      return;
    }
    setSent(true);
    setStep(1);
    toast.success("Reset link sent");
  };

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="We'll email you a secure link to set a new password."
    >
      <Stepper step={step} />
      <div className="mt-6">
        {step === 0 && (
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={sendLink}
            className="space-y-4"
          >
            <Field label="Account email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldCls}
                placeholder="you@pepper.com"
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send reset link
            </button>
          </motion.form>
        )}
        {step === 1 && sent && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
              <div>
                <p className="font-medium">Check your inbox</p>
                <p className="mt-1 text-emerald-800/80">
                  We sent a secure reset link to <span className="font-semibold">{email}</span>. Open it
                  on this device to continue.
                </p>
              </div>
            </div>
            <button
              onClick={() => sendLink()}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {loading ? "Resending…" : "Resend email"}
            </button>
          </motion.div>
        )}
      </div>
      <div className="mt-6 text-center text-xs text-neutral-500">
        Remembered it?{" "}
        <Link to="/auth" className="font-medium text-[#ff003c] hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const active = i <= step;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={
                "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-all " +
                (active ? "bg-[#ff003c] text-white" : "bg-neutral-100 text-neutral-400")
              }
            >
              {i + 1}
            </div>
            <span
              className={
                "text-xs font-medium " + (active ? "text-neutral-900" : "text-neutral-400")
              }
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="ml-1 h-px flex-1 bg-neutral-200" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// keep effect import used somewhere to avoid TS unused warning if not needed
void useEffect;