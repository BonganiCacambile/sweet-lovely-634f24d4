import { Link } from "@tanstack/react-router";
import { LogoImage } from "@/components/logo";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="Sweet & Lovely home">
      <LogoImage height={size} />
    </Link>
  );
}
