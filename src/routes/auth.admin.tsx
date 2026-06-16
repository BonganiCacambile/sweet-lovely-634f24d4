import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Eye, EyeOff, LifeBuoy, KeyRound, LogOut, ArrowRight, ArrowLeft, Crown, Users } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AdminAuthLayout } from "@/components/admin/admin-auth-layout";
import { Field, fieldCls } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/social-buttons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { getCallerScope } from "@/lib/admin/scope.functions";
import { MapPin } from "lucide-react";

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
  const [kind, setKind] = useState<"main" | "zone" | null>(null);
  const fetchScope = useServerFn(getCallerScope);
  const [zoneConfirm, setZoneConfirm] = useState<
    | null
    | { email: string; zoneName: string | null }
  >(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<
    | { state: "loading" }
    | { state: "none" }
    | { state: "signed-in"; email: string; isMainAdmin: boolean; isZoneAdmin: boolean }
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
      .select("role, assigned_zone_id")
      .eq("user_id", u.id);
    const rows = roles ?? [];
    const isMainAdmin = rows.some((r: { role: string }) => r.role === "admin");
    const isZoneAdmin = !isMainAdmin && rows.some((r: { assigned_zone_id: string | null }) => r.assigned_zone_id);
    setExisting({ state: "signed-in", email: u.email ?? "", isMainAdmin, isZoneAdmin });
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
    if (!kind) return;
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
      .select("role, assigned_zone_id")
      .eq("user_id", data.user.id);
    setLoading(false);
    const rows = roles ?? [];
    const isMainAdmin = rows.some((r: { role: string }) => r.role === "admin");
    const isZoneAdmin = !isMainAdmin && rows.some((r: { assigned_zone_id: string | null }) => r.assigned_zone_id);
    if (!isMainAdmin && !isZoneAdmin) {
      await supabase.auth.signOut();
      toast.error("Access denied", { description: "This account isn't an administrator." });
      return;
    }
    if (kind === "main" && !isMainAdmin) {
      await supabase.auth.signOut();
      toast.error("Wrong sign-in type", { description: "This account is an Admin Employee, not a Main Admin." });
      return;
    }
    if (kind === "zone" && !isZoneAdmin) {
      await supabase.auth.signOut();
      toast.error("Wrong sign-in type", { description: "This account is a Main Admin. Choose Main Admin to continue." });
      return;
    }
    if (kind === "zone") {
      // Prompt zone admin to confirm/access their assigned delivery zone.
      let zoneName: string | null = null;
      try {
        const scope = await fetchScope();
        zoneName = scope.assignedZoneName ?? null;
      } catch { /* fall through with null */ }
      setZoneConfirm({ email: data.user.email ?? email, zoneName });
      return;
    }
    toast.success("Credentials verified", { description: "Welcome back, Administrator." });
    proceedToConsole(data.user.email ?? email);
  };

  const useThisAccount = async () => {
    if (existing.state !== "signed-in") return;
    if (!existing.isMainAdmin && !existing.isZoneAdmin) {
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

  // Step 3 (zone admin only): confirm/access assigned delivery zone before entering console.
  if (zoneConfirm) {
    return (
      <AdminAuthLayout
        eyebrow="Employee Admin"
        title="Access your delivery zone"
        subtitle="You'll only see orders, inventory and analytics for the zone assigned to you."
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-600 text-white">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Your assigned zone</p>
              <p className="mt-0.5 text-lg font-semibold text-neutral-900">
                {zoneConfirm.zoneName ?? "Unassigned"}
              </p>
              <p className="mt-0.5 truncate text-xs text-neutral-500">{zoneConfirm.email}</p>
            </div>
          </div>
          {!zoneConfirm.zoneName ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              No delivery zone is assigned to this account yet. Ask a Main Admin to assign one.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!zoneConfirm.zoneName}
              onClick={() => proceedToConsole(zoneConfirm.email)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)] transition-all hover:scale-[1.01] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#171717,#404040)" }}
            >
              Enter {zoneConfirm.zoneName ?? "zone"} dashboard <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setZoneConfirm(null);
                setKind(null);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </AdminAuthLayout>
    );
  }

  // Step 1: ask which kind of admin is signing in (unless already signed in).
  if (existing.state !== "signed-in" && !kind) {
    return (
      <AdminAuthLayout
        eyebrow="Restricted area"
        title="How are you signing in?"
        subtitle="Choose the type of admin account you'll use. You can switch back any time."
      >
        <KindChooser onPick={setKind} />
        <div className="mt-6 flex items-center justify-between text-xs text-neutral-500">
          <Link to="/auth" className="inline-flex items-center gap-1 hover:text-neutral-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <Link to="/" className="hover:text-neutral-700">Home</Link>
        </div>
      </AdminAuthLayout>
    );
  }

  return (
    <AdminAuthLayout
      eyebrow="Restricted area"
      title={kind === "zone" ? "Admin Employee sign-in" : "Main Admin sign-in"}
      subtitle={
        kind === "zone"
          ? "Restricted access for delivery-zone admins. You'll only see data for your assigned zone."
          : "Elevated access to the Sweet & Lovely control center. Every sign-in is verified, encrypted and logged."
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {existing.state !== "signed-in" && kind && (
          <button
            type="button"
            onClick={() => setKind(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Change admin type
          </button>
        )}
        {existing.state === "signed-in" ? (
          <div className="space-y-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
              <div className="min-w-0">
                <p className="font-semibold">You&rsquo;re signed in as</p>
                <p className="truncate text-xs text-emerald-800/80">{existing.email}</p>
                {existing.isMainAdmin && (
                  <p className="mt-1 text-xs text-emerald-800/80">Main Admin · full access</p>
                )}
                {existing.isZoneAdmin && (
                  <p className="mt-1 text-xs text-emerald-800/80">Admin Employee · zone-scoped access</p>
                )}
                {!existing.isMainAdmin && !existing.isZoneAdmin && (
                  <p className="mt-1 text-xs text-rose-700">
                    This account isn&rsquo;t an administrator.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(existing.isMainAdmin || existing.isZoneAdmin) && (
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

function KindChooser({ onPick }: { onPick: (k: "main" | "zone") => void }) {
  const options = [
    {
      id: "main" as const,
      title: "Main Admin",
      desc: "Full access across all delivery zones, products, users and settings.",
      icon: Crown,
      accent: "from-[#ff003c] to-[#ff5a36]",
    },
    {
      id: "zone" as const,
      title: "Admin Employee",
      desc: "Zone-restricted access to orders and operations for your assigned area.",
      icon: Users,
      accent: "from-neutral-800 to-neutral-600",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o, i) => {
        const Icon = o.icon;
        return (
          <motion.button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-all hover:border-neutral-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${o.accent} text-white shadow-sm`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-neutral-900">{o.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{o.desc}</p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-700" />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}