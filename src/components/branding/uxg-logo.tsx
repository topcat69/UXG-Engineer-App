/**
 * The real UXG wordmark, provided by the user (public/branding/uxg-logo.png,
 * transparent PNG). A plain <img> rather than next/image — this is a
 * small, static, always-rendered brand asset with no responsive
 * source-set or lazy-loading need, so next/image's extra machinery
 * wouldn't earn its place here.
 */
export function UxgLogo({ className }: { className?: string }) {
  return <img src="/branding/uxg-logo.png" alt="UXG" className={className} />;
}
