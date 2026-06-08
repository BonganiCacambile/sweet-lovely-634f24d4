import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { DashboardKpi as Kpi } from "@/lib/admin-dashboard.functions";

function useCount(target: number, duration = 900) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);
  return { v, ref };
}

function format(n: number, decimals: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const decimals = kpi.suffix === "%" ? 1 : 0;
  const { v, ref } = useCount(kpi.value);
  const positive = kpi.delta >= 0;
  const data = kpi.spark.map((y, i) => ({ x: i, y }));

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_10px_40px_-24px_rgba(15,15,15,0.18)] backdrop-blur"
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{kpi.label}</p>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
            (positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")
          }
        >
          {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(kpi.delta).toFixed(1)}%
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tabular-nums text-neutral-900">
          {kpi.prefix}
          <span ref={ref}>{format(v, decimals)}</span>
          {kpi.suffix}
        </p>
        <div className="h-12 w-24 opacity-90 sm:w-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`g-${kpi.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff003c" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ff003c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="y" stroke="#ff003c" strokeWidth={2} fill={`url(#g-${kpi.key})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}