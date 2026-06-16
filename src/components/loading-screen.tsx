import { motion } from "framer-motion";
import splashAsset from "@/assets/sweet-n-lovely-splash.png.asset.json";

export function LoadingScreen() {
  return (
    <div
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-black"
      role="status"
      aria-label="Loading Sweet 'N Lovely"
    >
      {/* Splash image — displayed exactly as uploaded, preserving every visual element */}
      <motion.img
        src={splashAsset.url}
        alt="Sweet 'N Lovely"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Cinematic vignette — subtle edge darkening for premium depth */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.3 }}
        style={{
          boxShadow: "inset 0 0 120px 40px rgba(0,0,0,0.45)",
        }}
      />

      {/* Ultra-subtle ambient breathing for cinematic life */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0, 0.03, 0] }}
        transition={{
          duration: 4,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(255,180,60,0.25) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}
