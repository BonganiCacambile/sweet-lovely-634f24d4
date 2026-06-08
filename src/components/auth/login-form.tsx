import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GoogleButton } from "./social-buttons";

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Couldn't sign you in", { description: error.message });
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/account" });
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Sign in</h2>
        <p className="mt-1 text-sm text-neutral-500">Welcome back. Let's get you in.</p>
      </div>

      <GoogleButton />

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs uppercase tracking-wider text-neutral-400">or</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <Field label="Email">
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldCls}
          placeholder="you@pepper.com"
        />
      </Field>

      <Field
        label="Password"
        trailing={
          <Link
            to="/auth/forgot-password"
            className="text-xs font-medium text-[#ff003c] hover:underline"
          >
            Forgot?
          </Link>
        }
      >
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldCls + " pr-10"}
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

      <label className="flex select-none items-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-[#ff003c] focus:ring-[#ff003c]"
        />
        Remember me on this device
      </label>

      <button
        type="submit"
        disabled={loading}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(255,0,60,0.6)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </motion.form>
  );
}

export const fieldCls =
  "block w-full rounded-xl border border-neutral-200 bg-white/80 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:border-[#ff003c]/40 focus:outline-none focus:ring-4 focus:ring-[#ff003c]/10";

export function Field({
  label,
  trailing,
  children,
  hint,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {hint ? <div className="mt-1.5 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}