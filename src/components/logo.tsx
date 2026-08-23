/**
 * Shared brand logo image.
 *
 * The source artwork is a 1024x1024 PNG (~1.2 MB) which is far larger than any
 * render size on the site. We ship pre-resized WebP/PNG variants and let the
 * browser pick the smallest suitable one.
 */

const WIDTHS = [128, 256, 512] as const;

const webpSrcSet = WIDTHS.map((w) => `/logo-transparent-${w}.webp ${w}w`).join(", ");
const pngSrcSet = WIDTHS.map((w) => `/logo-transparent-${w}.png ${w}w`).join(", ");

export function LogoImage({
  height = 64,
  className = "",
  loading = "eager",
}: {
  height?: number;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  // The logo is square, so the rendered width equals the rendered height.
  const sizes = `${height}px`;
  return (
    <picture>
      <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
      <img
        src="/logo-transparent-256.png"
        srcSet={pngSrcSet}
        sizes={sizes}
        alt="Sweet & Lovely"
        width={height}
        height={height}
        loading={loading}
        decoding="async"
        className={className}
        style={{ height, width: "auto" }}
      />
    </picture>
  );
}
