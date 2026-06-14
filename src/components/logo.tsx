const LOGO_URL = "/__l5e/assets-v1/9da0083b-bffb-4e22-9eb3-92650381c94b/logo.png";

export function LogoImage({
  height = 84,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <img
      src={LOGO_URL}
      alt="Sweet & Lovely"
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
