import { useEffect, useRef } from "react";

export function MfaInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (value.length === length) onComplete?.(value);
  }, [value, length, onComplete]);

  const setAt = (i: number, ch: string) => {
    const next = (value.padEnd(length, " ").substring(0, i) + ch + value.substring(i + 1))
      .replace(/\s+$/g, "")
      .slice(0, length);
    onChange(next);
  };

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3" role="group" aria-label="One-time code">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (!raw) {
              setAt(i, "");
              return;
            }
            const ch = raw[raw.length - 1];
            setAt(i, ch);
            if (i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              refs.current[i - 1]?.focus();
              setAt(i - 1, "");
              e.preventDefault();
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (!text) return;
            e.preventDefault();
            onChange(text);
            const last = Math.min(text.length, length - 1);
            refs.current[last]?.focus();
          }}
          aria-label={`Digit ${i + 1}`}
          className="h-14 w-full max-w-[3.25rem] rounded-2xl border border-neutral-200 bg-white text-center text-xl font-semibold text-neutral-900 shadow-sm outline-none transition focus:border-[#ff003c] focus:ring-4 focus:ring-[#ff003c]/15 disabled:opacity-50 sm:h-16"
        />
      ))}
    </div>
  );
}