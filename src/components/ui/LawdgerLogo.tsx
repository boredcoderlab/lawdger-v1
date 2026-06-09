import Image, { type ImageProps } from "next/image";

/**
 * Logo asset is a single-color black silhouette on transparent. In dark mode it
 * would otherwise be invisible against the warm-dark canvas — so we flip it to
 * near-white via `dark:invert`. One source of truth so every consumer (sidebar
 * brand anchor, dashboard chatbot tile, etc.) stays mode-correct without each
 * recomputing the dark-mode parity hack.
 */
type Props = Omit<ImageProps, "src" | "alt"> & {
  alt?: string;
};

export default function LawdgerLogo({
  alt = "Lawdger",
  className = "",
  ...rest
}: Props) {
  return (
    <Image
      src="/lawdger-logo-transparent.png"
      alt={alt}
      unoptimized
      {...rest}
      className={`${className} dark:invert`.trim()}
    />
  );
}
