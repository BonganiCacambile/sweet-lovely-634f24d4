const LOGO_URL = "/__l5e/assets-v1/e8de6399-e42e-450d-8b68-d75c9fceea0c/logo.png";

export function LogoImage({
  height = 54,
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
