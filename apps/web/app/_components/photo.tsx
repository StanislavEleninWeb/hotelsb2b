import type { CSSProperties } from "react";

// Modernist photography: printed black & white. Renders a real <img> only for a
// genuine URL; the seed's placeholder hosts (example.com) and empty slots fall back to
// an intentional B&W placeholder with a label, so a photo-less property reads as
// "awaiting photography", not broken.
function isRealImage(url?: string | null): url is string {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host !== "example.com" && !host.endsWith(".example.com") && host !== "localhost";
  } catch {
    return false;
  }
}

export function Photo({
  src,
  alt,
  label,
  height,
  style,
}: {
  src?: string | null;
  alt?: string | null;
  label: string;
  height?: number | string;
  style?: CSSProperties;
}) {
  const real = isRealImage(src);
  return (
    <div className="photo grayscale" style={{ height, ...style }}>
      {real ? (
        <img src={src} alt={alt ?? label} loading="lazy" />
      ) : (
        <div className="photo-ph">
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}
