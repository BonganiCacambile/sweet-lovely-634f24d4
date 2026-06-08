import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  title,
  description,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#ff003c]">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-600">{description}</p>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/80 p-10 text-center shadow-[0_10px_40px_-24px_rgba(15,15,15,0.18)] backdrop-blur"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,0,60,0.18), transparent 60%)" }}
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-neutral-900">Module in the next release</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
          The {title.toLowerCase()} workspace is wired up and ready. We&rsquo;ll roll out the full
          experience in the next phase so we can keep quality high.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-[11px] font-medium text-neutral-600">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Planned · Phase 2
        </div>
      </motion.div>
    </div>
  );
}