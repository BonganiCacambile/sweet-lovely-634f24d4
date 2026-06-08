import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Field, fieldCls } from "@/components/auth/login-form";
import { supabase } from "@/integrations/supabase/client";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoading(false);
      toast.error("Sign-in failed", { description: error?.message ?? "Unknown error" });
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
    toast.success("Admin access granted");
    navigate({ to: "/admin" });
  };

  return (
    <AuthLayout
      eyebrow="Restricted area"
      title="Sweet & Lovely Admin Portal"
      subtitle="Elevated access. All sign-ins are logged and protected by additional verification."
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
          <p>
            This portal is for authorized administrators only. Unauthorized access
            attempts will be reported.
          </p>
        </div>

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
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all hover:scale-[1.01] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? "Verifying…" : "Continue securely"}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-500">
          Not an admin?{" "}
          <Link to="/auth" className="font-medium text-[#ff003c] hover:underline">
            Back to sign-in
          </Link>
        </p>
      </motion.div>
    </AuthLayout>
  );
}