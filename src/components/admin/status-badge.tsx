const STYLES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-700",
  preparing: "bg-amber-50 text-amber-700",
  processing: "bg-sky-50 text-sky-700",
  out_for_delivery: "bg-sky-50 text-sky-700",
  completed: "bg-emerald-50 text-emerald-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700",
  refunded: "bg-violet-50 text-violet-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-neutral-100 text-neutral-600",
};

const LABELS: Record<string, string> = {
  out_for_delivery: "Out for delivery",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? "bg-neutral-100 text-neutral-700";
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}>{label}</span>;
}