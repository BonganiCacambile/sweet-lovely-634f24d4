import { motion } from "framer-motion";
import { LogoImage } from "./logo";

export function LoadingScreen({
  message = "Preparing something delicious",
}: {
  message?: string;
}) {
  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-white">
      {/* Soft brand gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(800px 500px at 50% -20%, rgba(255,0,60,0.08), transparent 60%), radial-gradient(600px 400px at 50% 120%, rgba(255,153,0,0.06), transparent 60%)",
        }}
      />

      <div className="flex flex-col items-center text-center px-4">
        {/* Logo with breathing animation */}
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{
            duration: 2.4,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          <LogoImage height={80} className="drop-shadow-[0_8px_24px_rgba(255,0,60,0.15)]" />
        </motion.div>

        {/* Brand name */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-6 text-2xl font-semibold tracking-tight text-neutral-900"
        >
          Sweet &amp; Lovely
        </motion.h1>

        {/* Loading message with animated dots */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-2 text-sm text-neutral-500"
        >
          <AnimatedDots text={message} />
        </motion.p>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-neutral-100 origin-left"
        >
          <motion.div
            className="h-full rounded-full bg-[#ff003c]"
            initial={{ width: "0%" }}
            animate={{ width: ["0%", "40%", "70%", "100%"] }}
            transition={{
              duration: 3.5,
              ease: "easeInOut",
              repeat: Infinity,
              times: [0, 0.4, 0.7, 1],
            }}
          />
        </motion.div>

        {/* Floating ingredient decorations */}
        <FloatingIngredients />
      </div>
    </div>
  );
}

function AnimatedDots({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {text}
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
        className="inline-block w-1"
      >
        .
      </motion.span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
        className="inline-block w-1"
      >
        .
      </motion.span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
        className="inline-block w-1"
      >
        .
      </motion.span>
    </span>
  );
}

function FloatingIngredients() {
  const items = [
    {
      src: "https://framerusercontent.com/images/kP2NqpJxzs3mxd89TNdxyZvyms.png?scale-down-to=512",
      alt: "basil",
      className: "left-[6%] top-[20%] h-16 w-16 md:h-20 md:w-20",
      delay: 0,
    },
    {
      src: "https://framerusercontent.com/images/4PC0Gy5LJt9gx1LT596KEeOxVk0.png?scale-down-to=512",
      alt: "mushroom",
      className: "right-[8%] top-[15%] h-14 w-14 md:h-16 md:w-16",
      delay: 0.6,
    },
    {
      src: "https://framerusercontent.com/images/Oh7T6jN4XYvDVriZHd3zwKwGrUs.png?scale-down-to=512",
      alt: "jalapeño",
      className: "left-[8%] bottom-[18%] h-16 w-16 md:h-20 md:w-20 rotate-[-12deg]",
      delay: 1.2,
    },
    {
      src: "https://framerusercontent.com/images/bvrc0x9pG8w1OtGBtKBKRFnW4cM.png?scale-down-to=512",
      alt: "cherry tomato",
      className: "right-[6%] bottom-[22%] h-14 w-14 md:h-18 md:w-18",
      delay: 0.8,
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {items.map((it, i) => (
        <motion.img
          key={i}
          src={it.src}
          alt=""
          className={`absolute select-none object-contain opacity-40 ${it.className}`}
          animate={{ y: [0, -12, 0] }}
          transition={{
            duration: 4 + i * 0.5,
            ease: "easeInOut",
            repeat: Infinity,
            delay: it.delay,
          }}
        />
      ))}
    </div>
  );
}
