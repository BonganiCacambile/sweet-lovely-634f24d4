import { Link } from "@tanstack/react-router";

const LOGO_URL = "/__l5e/assets-v1/e8de6399-e42e-450d-8b68-d75c9fceea0c/logo.png";

export function BrandMark({ size = 22 }: { size?: number }) {
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
