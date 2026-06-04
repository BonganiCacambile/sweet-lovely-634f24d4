import { Children, useEffect, useRef, useState, type ReactNode, type CSSProperties, type ElementType } from "react";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  /** When true, all direct children are staggered. */
  stagger?: boolean;
  staggerStep?: number;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Fade + slide-up on scroll into view. Respects prefers-reduced-motion. */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
  style,
  stagger = false,
  staggerStep = 80,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const baseStyle: CSSProperties = {
    transition: "opacity 600ms ease-out, transform 600ms ease-out",
    transitionDelay: `${delay}ms`,
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    willChange: "opacity, transform",
    ...style,
  };

  if (!stagger) {
    return (
      <Tag ref={ref as never} className={className} style={baseStyle}>
        {children}
      </Tag>
    );
  }

  // Stagger: wrap each direct child with its own delay (flattens fragments/arrays)
  const items = Children.toArray(children);
  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{ ...style }}
    >
      {items.map((child, i) => (
        <div
          key={i}
          style={{
            transition: "opacity 600ms ease-out, transform 600ms ease-out",
            transitionDelay: `${delay + i * staggerStep}ms`,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            willChange: "opacity, transform",
          }}
        >
          {child}
        </div>
      ))}
    </Tag>
  );
}

/** Hook variant for cases where wrapping markup would change layout. */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const style: CSSProperties = {
    transition: "opacity 600ms ease-out, transform 600ms ease-out",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    willChange: "opacity, transform",
  };

  return { ref, style, visible };
}