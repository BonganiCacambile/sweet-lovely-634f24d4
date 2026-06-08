import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function AuthLayout({
  children,
  eyebrow = "Welcome",
  title = "Sign in to Sweet & Lovely",
  subtitle = "Order faster, track deliveries, and unlock member-only deals.",
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden bg-white">
      {/* Soft brand gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 500px at -10% -10%, rgba(255,0,60,0.10), transparent 60%), radial-gradient(700px 500px at 110% 110%, rgba(255,153,0,0.08), transparent 60%), #ffffff",
        }}
      />
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 lg:grid-cols-2">
        {/* Left brand panel */}
        <section className="relative hidden flex-col justify-between p-10 lg:flex">
          <Link to="/" className="inline-flex items-center">
            <span
              style={{
                fontFamily: '"Cherry Bomb One", sans-serif',
                color: "rgb(255, 0, 60)",
                fontSize: "28px",
                lineHeight: 1,
              }}
            >
              Sweet &amp; Lovely
            </span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md"
          >
            <p className="text-sm uppercase tracking-[0.18em] text-[#ff003c]">{eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900">
              {title}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">{subtitle}</p>

            <ul className="mt-8 space-y-3 text-sm text-neutral-700">
              {[
                { icon: ShieldCheck, label: "Bank-grade encryption · TLS 1.3" },
                { icon: Lock, label: "Two-factor authentication ready" },
                { icon: Sparkles, label: "One-tap reorders for members" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff0f3] text-[#ff003c]">
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>

          <p className="text-xs text-neutral-500">
            © {new Date().getFullYear()} Sweet &amp; Lovely. Crafted with care.
          </p>
        </section>

        {/* Right card */}
        <section className="flex items-center justify-center px-4 py-8 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md"
          >
            {/* Mobile brand header */}
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <Link to="/" className="inline-flex items-center">
                <span
                  style={{
                    fontFamily: '"Cherry Bomb One", sans-serif',
                    color: "rgb(255, 153, 0)",
                    fontSize: "26px",
                    lineHeight: 1,
                  }}
                >
                  Sweet &amp; Lovely
                </span>
              </Link>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#ff003c]">
                {eyebrow}
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900">
                {title}
              </h1>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-600">
                {subtitle}
              </p>
            </div>
            <div
              className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_30px_80px_-30px_rgba(15,15,15,0.18)] backdrop-blur-xl sm:p-8"
              style={{ backdropFilter: "blur(20px)" }}
            >
              {children}
            </div>
            <p className="mt-6 text-center text-xs text-neutral-500">
              By continuing you agree to our{" "}
              <a className="underline underline-offset-2 hover:text-neutral-700" href="#">Terms</a> and{" "}
              <a className="underline underline-offset-2 hover:text-neutral-700" href="#">Privacy Policy</a>.
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}