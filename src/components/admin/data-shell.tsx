import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingRows({ rows = 5, height = 44 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="w-full rounded-xl" style={{ height }} />
      ))}
    </div>
  );
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-rose-800">Something went wrong</p>
          <p className="mt-1 text-sm text-rose-700">{msg}</p>
          {onRetry && (
            <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 p-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-400 shadow-sm">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/80 shadow-[0_8px_30px_-18px_rgba(15,15,15,0.18)] backdrop-blur ${className}`}>{children}</div>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-600">
      <p>Showing <span className="font-medium text-neutral-900">{from}-{to}</span> of <span className="font-medium text-neutral-900">{total}</span></p>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-full border border-neutral-200 bg-white px-3 py-1 disabled:opacity-50">Previous</button>
        <span className="px-2">Page {page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-full border border-neutral-200 bg-white px-3 py-1 disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}