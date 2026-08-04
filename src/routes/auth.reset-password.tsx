import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field, fieldCls } from "@/components/auth/login-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { authErrorMessage } from "@/lib/auth-validation";
import { logAuthEvent } from "@/lib/auth-events";
import { checkPasswordBreached } from "@/lib/password-safety.functions";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Sweet & Lovely" },
      { name: "description", content: "Choose a new password to secure your Sweet & Lovely account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const { setAuthTransition } = useAuth();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setChecking(false);
      logAuthEvent("session_initialization", "timed_out", { flow: "password_recovery" });
    }, 8000);
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      logAuthEvent("authentication_listener", "succeeded", { event });
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecking(false);
        window.clearTimeout(timer);
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        logAuthEvent("session_initialization", "failed", { flow: "password_recovery" });
        return;
      }
      if (data.session) {
        setReady(true);
        setChecking(false);
        window.clearTimeout(timer);
        logAuthEvent("session_initialization", "succeeded", { flow: "password_recovery" });
      }
    }).catch(() => {
      if (!active) return;
      logAuthEvent("session_initialization", "failed", { flow: "password_recovery" });
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (pwd !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    logAuthEvent("password_reset_confirmation", "started");
    try {
      try {
        const { breached } = await checkPasswordBreached({ data: { password: pwd } });
        if (breached) {
          logAuthEvent("password_reset_confirmation", "failed", { reason: "breached_password" });
          return toast.error("Choose a different password", {
            description: "This password has appeared in a known data breach. Please pick a unique one.",
          });
        }
      } catch {
        // Breach lookup unavailable — continue with the password update.
      }
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) {
        logAuthEvent("password_reset_confirmation", "failed", { status: error.status ?? null });
        return toast.error("Couldn't update password", { description: authErrorMessage(error, "Request a new reset link and try again.") });
      }
      await supabase.auth.signOut();
      logAuthEvent("password_reset_confirmation", "succeeded");
      toast.success("Password updated. Sign in with your new password.");
      setAuthTransition("idle");
      navigate({ to: "/auth", replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Almost done"
      title="Choose a new password"
      subtitle="Use at least 8 characters with a mix of letters, numbers, and symbols."
    >
      {checking ? (
        <div
          data-testid="reset-password-verifying"
          className="flex items-center justify-center py-8 text-sm text-neutral-600"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying your reset link…
        </div>
      ) : !ready ? (
        <div
          data-testid="reset-password-invalid-link"
          className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900"
        >
          This page must be opened from the reset link we emailed you. If the link expired, request a new
          one from the forgot-password page.
        </div>
      ) : (
        <form onSubmit={submit} data-testid="reset-password-form" aria-label="Set a new password" className="space-y-4">
          <Field label="New password">
            <input
              type="password"
              required
              data-testid="reset-password-new"
              aria-label="New password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className={fieldCls}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              required
              data-testid="reset-password-confirm"
              aria-label="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldCls}
              autoComplete="new-password"
            />
          </Field>
          <button
            type="submit"
            data-testid="reset-password-submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Update password
          </button>
        </form>
      )}
    </AuthLayout>
  );
}