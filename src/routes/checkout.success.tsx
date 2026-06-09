import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Download, ArrowRight, Truck } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (s) =>
    z.object({ ref: z.string().optional(), order: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Order confirmed — Sweet & Lovely" },
      { name: "description", content: "Thanks for your order!" },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { ref, order } = Route.useSearch();
  const orderNumber = order
    ? `#${order}`
    : ref
      ? `#${ref.slice(-8).toUpperCase()}`
      : `#${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const eta = new Date(Date.now() + 35 * 60_000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-neutral-100 bg-white p-8 text-center shadow-[0_20px_60px_-30px_rgba(0,0,0,0.2)] md:p-12"
        >
          {/* Success check */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, delay: 0.3 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white"
            >
              <Check className="h-7 w-7" strokeWidth={3} />
            </motion.div>
          </motion.div>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight md:text-4xl">
            Order confirmed!
          </h1>
          <p className="mt-3 text-neutral-600">
            Thanks — your payment was received and your order is being prepared.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="Order number" value={orderNumber} />
            <Info
              label="Estimated delivery"
              value={eta}
              icon={<Truck className="h-4 w-4" />}
            />
          </div>

          {ref && (
            <p className="mt-6 text-xs text-neutral-400">
              Payment reference: <span className="font-mono">{ref}</span>
            </p>
          )}

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/menu/full-menu"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff003c] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a]"
            >
              Continue shopping
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Download className="h-4 w-4" />
              Download receipt
            </button>
          </div>
        </motion.div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-[#fafafa] px-4 py-3 text-left">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-neutral-900">
        {icon}
        {value}
      </p>
    </div>
  );
}