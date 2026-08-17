import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field, fieldCls } from "@/components/auth/login-form";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, isValidEmail } from "@/lib/auth-validation";
import { logAuthEvent } from "@/lib/auth-events";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Sweet & Lovely" },
      { name: "description", content: "Reset your Sweet & Lovely account password securely." },
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
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setLoading(true);
    logAuthEvent("password_reset_request", "started");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + "/auth/reset-password",
      });
      if (error) {
        logAuthEvent("password_reset_request", "failed", { status: error.status ?? null });
        toast.error("Couldn't send reset link", { description: authErrorMessage(error, "Please wait a moment and try again.") });
        return;
      }
      logAuthEvent("password_reset_request", "succeeded");
      setSent(true);
      setStep(1);
      toast.success("If an account exists for that email, a reset link has been sent.");
    } catch {
      logAuthEvent("password_reset_request", "failed", { reason: "unexpected" });
      toast.error("Couldn't send reset link", { description: "Please try again." });
    } finally {
      setLoading(false);
    }
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
            data-testid="forgot-password-form"
            aria-label="Forgot password"
            className="space-y-4"
          >
            <Field label="Account email">
              <input
                type="email"
                required
                data-testid="forgot-password-email"
                aria-label="Account email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldCls}
                placeholder="you@sweetandlovely.pizza"
              />
            </Field>
            <button
              type="submit"
              data-testid="forgot-password-submit"
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
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="forgot-password-sent"
            className="space-y-4"
          >
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
              data-testid="forgot-password-resend"
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
