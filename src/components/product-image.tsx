import { memo } from "react";

/**
 * Responsive product image with AVIF/WebP/PNG fallbacks and width-based srcset.
 *
 * Sizing strategy:
 * - framerusercontent.com already serves optimised PNGs and supports
 *   `?scale-down-to=N` for width-based scaling (no proxy needed).
 * - Anything else (github raw etc.) is routed through images.weserv.nl,
 *   a free image proxy that resizes and re-encodes to AVIF/WebP on demand.
 *
 * The browser then picks the smallest suitable width AND the best format
 * it supports, drastically cutting bytes on mobile/tablet.
 */

const WIDTHS = [200, 320, 480, 640, 800] as const;

type Fmt = "webp" | "png";

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, "");
}

function isFramer(url: string) {
  return /(^|\.)framerusercontent\.com\//i.test(url);
}

function framerSized(url: string, width: number) {
  // Framer accepts ?scale-down-to=<px>. Strip any existing scale-down-to.
  const clean = url.replace(/([?&])scale-down-to=\d+/g, "$1").replace(/[?&]$/, "");
  const sep = clean.includes("?") ? "&" : "?";
  return `${clean}${sep}scale-down-to=${width}`;
}

function weservSized(url: string, width: number, fmt: Fmt) {
  // images.weserv.nl expects the source URL without protocol.
  const src = encodeURIComponent(stripProtocol(url));
  const out = fmt === "png" ? "" : `&output=${fmt}`;
  return `https://images.weserv.nl/?url=${src}&w=${width}&fit=inside${out}`;
}

function buildSrcSet(url: string, fmt: Fmt): string {
  return WIDTHS.map((w) => {
    const variant =
      fmt === "png" && isFramer(url) ? framerSized(url, w) : weservSized(url, w, fmt);
    return `${variant} ${w}w`;
  }).join(", ");
}

export interface ProductImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}

function ProductImageImpl({
  src,
  alt,
  width = 280,
  height = 280,
  sizes = "(min-width: 768px) 260px, min(280px, 90vw)",
  className,
  loading = "lazy",
  fetchPriority = "auto",
}: ProductImageProps) {
  if (!src) {
    return <img alt={alt} width={width} height={height} className={className} />;
  }

  const webp = buildSrcSet(src, "webp");
  const fallback = buildSrcSet(src, "png");

  return (
    <picture>
      <source type="image/webp" srcSet={webp} sizes={sizes} />
      <img
        src={src}
        srcSet={fallback}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        className={className}
      />
    </picture>
  );
}

export const ProductImage = memo(ProductImageImpl);