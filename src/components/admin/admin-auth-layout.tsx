import { motion } from "framer-motion";
import { ShieldCheck, Lock, Activity, KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "./brand-mark";

export function AdminAuthLayout({
  children,
  eyebrow = "Restricted access",
  title = "Admin Control",
  subtitle = "Sign in to the Sweet & Lovely admin console.",
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-white">
      {/* Animated soft-gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full opacity-70 blur-3xl animate-float-slow"
          style={{ background: "radial-gradient(circle, rgba(255,0,60,0.18), transparent 60%)" }}
        />
        <div
          className="absolute -right-24 top-1/3 h-[420px] w-[420px] rounded-full opacity-70 blur-3xl animate-float"
          style={{ background: "radial-gradient(circle, rgba(255,153,0,0.16), transparent 60%)" }}
        />
        <div
          className="absolute bottom-[-160px] left-1/3 h-[420px] w-[420px] rounded-full opacity-60 blur-3xl animate-float-slow animate-float-delay"
          style={{ background: "radial-gradient(circle, rgba(120,80,255,0.12), transparent 60%)" }}
        />
      </div>

      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Left brand panel */}
        <section className="relative hidden flex-col justify-between p-10 lg:flex">
          <div className="flex items-center gap-3">
            <BrandMark size={28} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-600 backdrop-blur">
              <ShieldCheck className="h-3 w-3 text-[#ff003c]" /> Admin portal
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-[#ff003c]">{eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">{subtitle}</p>

            <ul className="mt-8 space-y-3 text-sm text-neutral-700">
              {[
                { icon: ShieldCheck, label: "SOC 2-aligned controls and full audit logging" },
                { icon: Lock, label: "Mandatory multi-factor authentication" },
                { icon: Activity, label: "Real-time anomaly detection on every session" },
                { icon: KeyRound, label: "Hardware key & passkey-ready" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-2">
              {["ISO 27001", "PCI-DSS", "GDPR", "POPIA"].map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-[11px] font-medium text-neutral-700 backdrop-blur"
                >
                  {b}
                </span>
              ))}
            </div>
          </motion.div>

          <p className="text-xs text-neutral-500">
            © {new Date().getFullYear()} Sweet &amp; Lovely · Authorised personnel only
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
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <BrandMark size={24} />
              <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-[#ff003c]">{eyebrow}</p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-600">{subtitle}</p>
            </div>

            <div
              className="rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_30px_80px_-30px_rgba(15,15,15,0.22)] backdrop-blur-xl sm:p-8"
              style={{ backdropFilter: "blur(20px)" }}
            >
              {children}
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}