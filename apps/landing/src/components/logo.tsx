/** The VYRA mark from the app icon: a V crossed by one tilted orbit. Decorative. */
export function LogoMark({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="11.5"
        transform="rotate(-27 32 32)"
        fill="none"
        stroke="var(--vyra-cherry)"
        strokeWidth="2.2"
      />
      <path d="M17 14h6.4L32 37.5 40.6 14H47L32 53z" fill="currentColor" />
      <circle cx="55.3" cy="20.4" r="3.4" fill="var(--vyra-cherry)" />
    </svg>
  );
}

export function Wordmark({ className }: { readonly className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark className="size-8" />
      <span className="font-display text-[1.75rem] leading-none tracking-[0.06em]">VYRA</span>
    </span>
  );
}
