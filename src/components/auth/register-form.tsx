import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Field, fieldCls } from "./login-form";
import { GoogleButton } from "./social-buttons";
import { authErrorMessage, isValidEmail, normalizeSouthAfricanPhone, registrationDestination } from "@/lib/auth-validation";
import { logAuthEvent } from "@/lib/auth-events";

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export function RegisterForm() {
  const navigate = useNavigate();
  const { setAuthTransition } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const score = useMemo(() => strength(password), [password]);
  const labels = ["Too weak", "Weak", "Okay", "Strong", "Excellent"];
  const colors = ["#e5e5e5", "#ef4444", "#f59e0b", "#10b981", "#059669"];

  const checks = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
    { ok: /[0-9]/.test(password), label: "One number" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "One special character" },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeSouthAfricanPhone(phone);
    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!normalizedPhone) {
      toast.error(phone.trim() ? "Enter a valid South African cell number" : "Cell number is required", {
        description: "Use a mobile number such as 071 234 5678 or +27 71 234 5678.",
      });
      logAuthEvent("phone_verification", "failed", { reason: phone.trim() ? "invalid_format" : "missing" });
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (!accepted) {
      toast.error("Please accept the terms");
      return;
    }
    if (score < 4) {
      toast.error("Password does not meet all requirements");
      return;
    }
    setLoading(true);
    logAuthEvent("registration", "started");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin + "/auth",
          data: { full_name: fullName.trim(), phone: normalizedPhone },
        },
      });
      if (error) {
        logAuthEvent("registration", "failed", { status: error.status ?? null });
        toast.error("Couldn't create account", {
          description: authErrorMessage(error, "Please check your details and try again."),
        });
        return;
      }
      logAuthEvent("phone_verification", "succeeded", { mode: "format_only" });
      logAuthEvent("profile_creation", "succeeded", { source: "database_trigger" });
      logAuthEvent("registration", "succeeded", { confirmationRequired: !data.session });
      if (registrationDestination(Boolean(data.session)) === "sign_in") {
        toast.success("Account created. Check your email to verify.");
        logAuthEvent("redirect", "succeeded", { destination: "sign_in" });
        window.dispatchEvent(new CustomEvent("auth:show-signin"));
        navigate({ to: "/auth", replace: true });
        return;
      }
      toast.success("Account created");
      setAuthTransition("signing-in");
      logAuthEvent("redirect", "succeeded", { destination: "home" });
      navigate({ to: "/", replace: true });
    } catch {
      logAuthEvent("registration", "failed", { reason: "unexpected" });
      toast.error("Couldn't create account", { description: "Please try again. Your account details were not lost." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Create your account</h2>
        <p className="mt-1 text-sm text-neutral-500">Join Sweet & Lovely in less than a minute.</p>
      </div>

      <GoogleButton label="Sign up with Google" />

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs uppercase tracking-wider text-neutral-400">or</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={fieldCls}
            placeholder="Ada Lovelace"
            autoComplete="name"
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldCls}
            placeholder="+27 71 234 5678"
            autoComplete="tel"
            inputMode="tel"
          />
        </Field>
      </div>

      <Field label="Email">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldCls}
          placeholder="you@sweetandlovely.pizza"
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
            placeholder="Create a strong password"
            autoComplete="new-password"
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
        <div className="mt-2 flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all"
              style={{ background: i < score ? colors[score] : "#eee" }}
            />
          ))}
          <span className="ml-2 w-20 text-right text-xs text-neutral-500">
            {password ? labels[score] : ""}
          </span>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-neutral-500">
          {checks.map((c) => (
            <li key={c.label} className={"flex items-center gap-1.5 " + (c.ok ? "text-emerald-600" : "")}>
              <Check className={"h-3 w-3 " + (c.ok ? "opacity-100" : "opacity-30")} />
              {c.label}
            </li>
          ))}
        </ul>
      </Field>

      <Field label="Confirm password">
        <input
          type={show ? "text" : "password"}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={fieldCls}
          placeholder="Repeat your password"
          autoComplete="new-password"
        />
      </Field>

      <label className="flex select-none items-start gap-2 text-xs text-neutral-600">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-[#ff003c] focus:ring-[#ff003c]"
        />
        <span>
          I agree to Sweet &amp; Lovely's <a href="#" className="underline">Terms of Service</a> and{" "}
          <a href="#" className="underline">Privacy Policy</a>.
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(255,0,60,0.6)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Creating account…" : "Create account"}
      </button>
    </motion.form>
  );
}