import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { supabase } from "@/integrations/supabase/client";

type Tab = "signin" | "signup";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create an account — Pepper" },
      { name: "description", content: "Sign in or create your Pepper account to order faster, track deliveries, and unlock member deals." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/account" });
    });
  }, [navigate]);

  return (
    <AuthLayout
      eyebrow={tab === "signup" ? "Get started" : "Welcome back"}
      title={tab === "signup" ? "Create your Pepper account" : "Sign in to Pepper"}
      subtitle={
        tab === "signup"
          ? "Free to join. Save your favorites, get faster checkout, and unlock perks."
          : "Order faster, track deliveries, and unlock member-only deals."
      }
    >
      <Tabs tab={tab} setTab={setTab} />

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === "signin" ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === "signin" ? 8 : -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "signin" ? <LoginForm /> : <RegisterForm />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs text-neutral-500">
        <Link
          to="/auth/admin"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-neutral-100"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Admin sign-in
        </Link>
        <Link to="/" className="hover:text-neutral-700">
          ← Back to home
        </Link>
      </div>
    </AuthLayout>
  );
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1 text-sm font-medium">
      {(["signin", "signup"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          className={
            "relative z-10 rounded-full px-4 py-2 transition-colors " +
            (tab === t ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700")
          }
        >
          {tab === t && (
            <motion.span
              layoutId="auth-tab-pill"
              className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          {t === "signin" ? "Sign in" : "Create account"}
        </button>
      ))}
    </div>
  );
}