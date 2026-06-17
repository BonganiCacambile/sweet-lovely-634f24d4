import { Link } from "@tanstack/react-router";

const LOGO_URL = "/logo-transparent.png";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="Sweet & Lovely home">
      <img
        src={LOGO_URL}
        alt="Sweet & Lovely"
        style={{ height: size, width: "auto" }}
      />
    </Link>
  );
}
