/**
 * Approximation of the UXG wordmark provided by the user (a bold "UXG"
 * lockup in dark slate with a three-colour underline bar) — recreated as
 * an inline SVG rather than an embedded image, since the source was
 * supplied as inline chat content with no accessible file for this
 * session to read raw bytes from. This reproduces the palette and general
 * composition (bold wordmark + tri-colour bar); it does not attempt to
 * hand-trace the source's custom letterforms (the layered diagonal "X",
 * the rounded "G") without the real vector file, since a rough guess at
 * those would read as a worse copy rather than a faithful one. Swap this
 * component's contents for the real asset whenever the source file (SVG
 * preferred) is available.
 */
export function UxgLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 100" role="img" aria-label="UXG" className={className}>
      <text
        x="0"
        y="62"
        fontFamily="var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
        fontWeight={800}
        fontSize="64"
        letterSpacing="-2"
        fill="#454A54"
      >
        UXG
      </text>
      <rect x="0" y="82" width="73" height="7" fill="#1CA7E0" />
      <rect x="73" y="82" width="73" height="7" fill="#E31C5C" />
      <rect x="146" y="82" width="74" height="7" fill="#F5A623" />
    </svg>
  );
}
