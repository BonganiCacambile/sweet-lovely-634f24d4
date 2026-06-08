import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export function OtpVerification({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    if (value.length === length) onComplete?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const setAt = (i: number, ch: string) => {
    const arr = value.split("");
    arr[i] = ch;
    onChange(arr.join("").slice(0, length));
  };

  return (
    <div className="flex items-center justify-between gap-2">
      {Array.from({ length }).map((_, i) => {
        const v = value[i] ?? "";
        const active = focused === i;
        return (
          <motion.div
            key={i}
            animate={{ scale: active ? 1.04 : 1 }}
            className="relative flex-1"
          >
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              inputMode="numeric"
              maxLength={1}
              disabled={disabled}
              value={v}
              onFocus={() => setFocused(i)}
              onChange={(e) => {
                const ch = e.target.value.replace(/\D/g, "").slice(-1);
                setAt(i, ch);
                if (ch && i < length - 1) refs.current[i + 1]?.focus();
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !v && i > 0) refs.current[i - 1]?.focus();
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
                if (text) {
                  e.preventDefault();
                  onChange(text.padEnd(value.length, "").slice(0, length));
                  const next = Math.min(text.length, length - 1);
                  refs.current[next]?.focus();
                }
              }}
              className={
                "h-14 w-full rounded-xl border bg-white text-center text-xl font-semibold tabular-nums shadow-sm transition-all focus:outline-none " +
                (v
                  ? "border-[#ff003c]/40 text-neutral-900 ring-4 ring-[#ff003c]/10"
                  : "border-neutral-200 text-neutral-500 focus:border-[#ff003c]/40 focus:ring-4 focus:ring-[#ff003c]/10")
              }
            />
          </motion.div>
        );
      })}
    </div>
  );
}