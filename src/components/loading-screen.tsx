import { motion } from "framer-motion";
import splashAsset from "@/assets/sweet-n-lovely-splash.png.asset.json";

export function LoadingScreen({
  message = "Fresh Ingredients. Perfectly Baked. Made with Love.",
}: {
  message?: string;
}) {
  return (
    <div
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-black"
      role="status"
      aria-label={message}
    >
      {/* Full-bleed background image — displayed exactly as uploaded */}
      <img
        src={splashAsset.url}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
      />
      {/* Subtle vignette for legibility */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 35%, transparent 0%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Glow + pulse ring radiating from logo (top portion) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[26%] -translate-x-1/2 -translate-y-1/2"
        animate={{ scale: [1, 1.15, 1], opacity: [0.45, 0.15, 0.45] }}
        transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
        style={{
          width: 520,
          height: 520,
          borderRadius: "9999px",
          background:
            "radial-gradient(circle, rgba(255,60,80,0.35) 0%, rgba(255,60,80,0.0) 60%)",
          filter: "blur(8px)",
        }}
      />
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff3c50]/40"
          style={{ width: 360, height: 360 }}
          animate={{ scale: [0.9, 1.35], opacity: [0.6, 0] }}
          transition={{
            duration: 3,
            ease: "easeOut",
            repeat: Infinity,
            delay: i * 1,
          }}
        />
      ))}
      {/* Sparkles around the logo */}
      <Sparkles />

      {/* Bottom HUD: progress bar + tagline */}
      <div className="absolute inset-x-0 bottom-[6%] flex flex-col items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-3 w-[min(420px,80vw)] overflow-hidden rounded-full border border-[#f3d9a4]/70 bg-black/60 shadow-[0_0_24px_rgba(255,60,80,0.35)]"
        >
          {/* Animated fill */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #ff3c50 0 10px, #e02338 10px 20px)",
              boxShadow: "0 0 18px rgba(255,60,80,0.7)",
            }}
            initial={{ width: "0%" }}
            animate={{ width: ["0%", "65%", "92%", "100%", "0%"] }}
            transition={{
              duration: 3.6,
              ease: "easeInOut",
              repeat: Infinity,
              times: [0, 0.45, 0.75, 0.95, 1],
            }}
          />
          {/* Shimmer sweep */}
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-1/3"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
              mixBlendMode: "overlay",
            }}
            animate={{ x: ["-50%", "350%"] }}
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-4 text-center text-sm italic tracking-wide text-[#ff8896] drop-shadow"
        >
          {message}
        </motion.p>
      </div>
    </div>
  );
}

function Sparkles() {
  const sparks = Array.from({ length: 14 }).map((_, i) => ({
    left: `${(i * 137) % 100}%`,
    top: `${10 + ((i * 53) % 45)}%`,
    size: 3 + (i % 4),
    delay: (i % 7) * 0.3,
    duration: 2.4 + (i % 5) * 0.4,
  }));
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-[#ffd27a]"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            boxShadow: "0 0 8px rgba(255,210,122,0.9)",
          }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.6] }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            delay: s.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
