/**
 * Diagonal, non-interactive watermark carrying the signed-in employee's
 * identity. Makes screenshots and photos of the admin panel traceable.
 */
export function ConfidentialWatermark({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div
      aria-hidden
      data-testid="confidential-watermark"
      className="pointer-events-none fixed inset-0 z-[60] select-none overflow-hidden print:block"
    >
      <div className="absolute inset-0 flex flex-wrap content-center justify-center gap-x-16 gap-y-24 opacity-[0.06]">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="-rotate-[28deg] whitespace-nowrap text-xs font-semibold uppercase tracking-[0.3em] text-neutral-900"
          >
            Confidential · {label}
          </span>
        ))}
      </div>
    </div>
  );
}
