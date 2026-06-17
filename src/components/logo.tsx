const LOGO_URL = "/logo-transparent.png";

export function LogoImage({
  height = 64,
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
