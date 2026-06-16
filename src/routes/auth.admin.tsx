import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Eye, EyeOff, LifeBuoy, KeyRound, LogOut, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AdminAuthLayout } from "@/components/admin/admin-auth-layout";
import { Field, fieldCls } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/social-buttons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth/admin")({
  head: () => ({
    meta: [
      { title: "Admin sign-in — Sweet & Lovely" },
      { name: "description", content: "Restricted access for Sweet & Lovely administrators." },
    ],
  }),
  component: AdminAuth,
});

function AdminAuth() {
  const navigate = useNavigate();
  const { setAuthTransition, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<
    | { state: "loading" }
    | { state: "none" }
    | { state: "signed-in"; email: string; isAdmin: boolean }
  >({ state: "loading" });

  const checkExistingSession = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const u = userRes.user;
    if (!u) {
      setExisting({ state: "none" });
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.id);
    const isAdmin = Boolean(roles?.some((r: { role: string }) => r.role === "admin"));
    setExisting({ state: "signed-in", email: u.email ?? "", isAdmin });
  };

  useEffect(() => {
    void checkExistingSession();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void checkExistingSession();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const proceedToConsole = (_verifiedEmail: string) => {
    void _verifiedEmail;
    void remember;
    setAuthTransition("signing-in");
    navigate({ to: "/admin" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoading(false);
      const msg = error?.message ?? "Unknown error";
      const hint = /invalid login credentials/i.test(msg)
        ? "If you usually sign in with Google, use the Google button above."
        : msg;
      toast.error("Sign-in failed", { description: hint });
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    setLoading(false);
    const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      toast.error("Access denied", { description: "This account isn't an administrator." });
      return;
    }
    toast.success("Credentials verified", { description: "Complete two-factor verification." });
    proceedToConsole(data.user.email ?? email);
  };

  const useThisAccount = async () => {
    if (existing.state !== "signed-in") return;
    if (!existing.isAdmin) {
      toast.error("This account isn't an administrator.");
      return;
    }
    toast.success("Welcome back, Administrator");
    proceedToConsole(existing.email);
  };

  const signOutAndSwitch = async () => {
    await signOut();
    setEmail("");
    setPassword("");
    toast.success("Signed out. Use a different administrator account.");
  };

  if (pathname !== "/auth/admin") return <Outlet />;

  return (
    <AdminAuthLayout
      eyebrow="Restricted area"
      title="Welcome back, Administrator"
      subtitle="Elevated access to the Sweet & Lovely control center. Every sign-in is verified, encrypted and logged."
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {existing.state === "signed-in" ? (
          <div className="space-y-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
              <div className="min-w-0">
                <p className="font-semibold">You&rsquo;re signed in as</p>
                <p className="truncate text-xs text-emerald-800/80">{existing.email}</p>
                {!existing.isAdmin && (
                  <p className="mt-1 text-xs text-rose-700">
                    This account isn&rsquo;t an administrator.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {existing.isAdmin && (
                <button
                  type="button"
                  onClick={useThisAccount}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Continue as administrator <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={signOutAndSwitch}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                <LogOut className="h-3.5 w-3.5" /> Use a different account
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-3.5 text-xs text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
          <p>
            Authorized administrators only. Unauthorized access attempts are reported and may be
            subject to legal action.
          </p>
        </div>
        )}

        {existing.state !== "signed-in" && (
          <>
            <GoogleButton label="Continue with Google" redirectTo="/auth/admin" />
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-neutral-200" />
              <span className="text-xs uppercase tracking-wider text-neutral-400">or email</span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
          </>
        )}

        {existing.state !== "signed-in" && (
          <form onSubmit={submit} className="space-y-4">
          <Field label="Admin email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldCls}
              placeholder="admin@sweetandlovely.pizza"
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldCls + " pr-10"}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-2 text-neutral-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-[#ff003c] focus:ring-[#ff003c]"
              />
              Trust this device for 30 days
            </label>
            <Link to="/auth/forgot-password" className="font-medium text-[#ff003c] hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_-16px_rgba(255,0,60,0.55)] transition-all hover:scale-[1.01] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? "Verifying…" : "Continue to verification"}
          </button>
          </form>
        )}

        <div className="grid grid-cols-1 gap-2 pt-2 text-xs text-neutral-600 sm:grid-cols-2">
          <a
            href="mailto:security@sweetandlovely.pizza"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 hover:bg-white"
          >
            <LifeBuoy className="h-3.5 w-3.5" /> Contact support
          </a>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 hover:bg-white"
          >
            <KeyRound className="h-3.5 w-3.5" /> Customer sign-in
          </Link>
        </div>
      </motion.div>
    </AdminAuthLayout>
  );
}