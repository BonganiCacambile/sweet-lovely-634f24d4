import { Link } from "@tanstack/react-router";

const LOGO_URL = "/__l5e/assets-v1/9da0083b-bffb-4e22-9eb3-92650381c94b/logo.png";

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
