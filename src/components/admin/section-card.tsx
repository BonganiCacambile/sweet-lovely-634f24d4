import type { ReactNode } from "react";

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        "rounded-3xl border border-neutral-200/70 bg-white/80 p-5 shadow-[0_10px_40px_-24px_rgba(15,15,15,0.18)] backdrop-blur sm:p-6 " +
        className
      }
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-neutral-900">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}