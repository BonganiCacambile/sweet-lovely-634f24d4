import { Link } from "@tanstack/react-router";

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="Sweet & Lovely home">
      <span
        style={{
          fontFamily: '"Cherry Bomb One", sans-serif',
          color: "rgb(255, 0, 60)",
          fontSize: `${size}px`,
          lineHeight: 1,
        }}
      >
        Sweet &amp; Lovely
      </span>
    </Link>
  );
}