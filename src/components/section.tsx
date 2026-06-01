import { type ReactNode } from "react";

interface SectionProps {
  id?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

/** Generic page section wrapper used by the home / menu / locations pages. */
export function Section({ id, title, subtitle, children, className = "" }: SectionProps) {
  return (
    <section id={id} className={`w-full px-4 py-12 md:px-8 md:py-20 ${className}`}>
      <div className="mx-auto max-w-7xl">
        {(title || subtitle) && (
          <header className="mb-8 md:mb-12">
            {title && (
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-2 max-w-2xl text-sm text-neutral-600 md:text-base">{subtitle}</p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}