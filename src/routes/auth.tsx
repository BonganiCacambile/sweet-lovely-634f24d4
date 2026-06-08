import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ShieldCheck, UserRound, ArrowLeft, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

type Tab = "signin" | "signup";
type Role = "customer" | "admin" | null;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create an account — Sweet & Lovely" },
      { name: "description", content: "Sign in or create your Sweet & Lovely account to order faster, track deliveries, and unlock member deals." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tab, setTab] = useState<Tab>("signin");
  const [role, setRole] = useState<Role>(null);

  if (pathname !== "/auth") return <Outlet />;

  if (!role) {
    return (
      <AuthLayout
        eyebrow="Welcome"
        title="How are you signing in?"
        subtitle="Choose how you'd like to continue. You can switch anytime."
      >
        <RoleChooser
          onPick={(r) => {
            if (r === "admin") {
              navigate({ to: "/auth/admin" });
              return;
            }
            setRole(r);
          }}
        />
        <div className="mt-6 text-center text-xs text-neutral-500">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-neutral-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow={tab === "signup" ? "Get started" : "Welcome back"}
      title={tab === "signup" ? "Create your Sweet & Lovely account" : "Sign in to Sweet & Lovely"}
      subtitle={
        tab === "signup"
          ? "Free to join. Save your favorites, get faster checkout, and unlock perks."
          : "Order faster, track deliveries, and unlock member-only deals."
      }
    >
      <button
        type="button"
        onClick={() => setRole(null)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Change account type
      </button>

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
        <button
          type="button"
          onClick={() => navigate({ to: "/auth/admin" })}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-neutral-100"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin sign-in
        </button>
        <Link to="/" className="hover:text-neutral-700">
          ← Back to home
        </Link>
      </div>
    </AuthLayout>
  );
}

function RoleChooser({ onPick }: { onPick: (r: Exclude<Role, null>) => void }) {
  const options = [
    {
      id: "customer" as const,
      title: "I'm a customer",
      desc: "Order pizza, track deliveries, and earn rewards.",
      icon: UserRound,
      accent: "from-pink-500 to-rose-500",
    },
    {
      id: "admin" as const,
      title: "I'm an admin",
      desc: "Manage menu, orders, and store operations.",
      icon: ShieldCheck,
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