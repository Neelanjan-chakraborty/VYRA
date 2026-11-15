import { type CSSProperties, useId } from 'react';

/**
 * Small pieces of drawn decoration. All are CSS or inline SVG: no extra
 * requests, no JavaScript, hidden from assistive technology, and still under
 * `prefers-reduced-motion`.
 */

/** A field of halftone dots that thins out towards one side. */
export function Halftone({
  className = '',
  fade = 'right',
  size = 11,
  dot = 1.5,
}: {
  readonly className?: string;
  readonly fade?: 'left' | 'right' | 'top' | 'bottom' | 'radial';
  readonly size?: number;
  readonly dot?: number;
}) {
  const mask =
    fade === 'radial'
      ? 'radial-gradient(closest-side, #000 25%, transparent)'
      : `linear-gradient(to ${fade === 'right' ? 'left' : fade === 'left' ? 'right' : fade === 'top' ? 'bottom' : 'top'}, #000, transparent 85%)`;
  const style: CSSProperties = {
    backgroundImage: `radial-gradient(circle, currentColor ${dot}px, transparent ${dot + 0.5}px)`,
    backgroundSize: `${size}px ${size}px`,
    maskImage: mask,
    WebkitMaskImage: mask,
  };
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute ${className}`} style={style} />
  );
}

/** A round cherry sticker with turning type: the brand line, set on a circle. */
export function RotatingBadge({
  className = '',
  text = 'Chemistry, decoded ✦ ',
}: {
  readonly className?: string;
  readonly text?: string;
}) {
  const id = useId();
  const ring = `badge-${id.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div aria-hidden="true" className={className}>
      <div className="relative size-full overflow-hidden rounded-full">
        <svg viewBox="0 0 200 200" className="badge-spin size-full" focusable="false">
          <defs>
            <path id={ring} d="M100 100m-76 0a76 76 0 1 1 152 0a76 76 0 1 1-152 0" />
          </defs>
          <circle cx="100" cy="100" r="99" fill="var(--vyra-cherry)" />
          <circle
            cx="100"
            cy="100"
            r="58"
            fill="none"
            stroke="var(--vyra-ivory)"
            strokeWidth="1"
            opacity=".5"
          />
          <text
            fill="var(--vyra-ivory)"
            fontFamily="var(--font-sans)"
            fontSize="15"
            fontWeight="700"
            letterSpacing="3"
            style={{ textTransform: 'uppercase' }}
          >
            <textPath href={`#${ring}`} textLength="476" lengthAdjust="spacing">
              {text.repeat(2)}
            </textPath>
          </text>
        </svg>
        {/* The orbit mark sits still while the type turns around it. */}
        <svg
          viewBox="0 0 64 64"
          className="absolute inset-[30%] size-[40%] text-ivory"
          focusable="false"
        >
          <ellipse
            cx="32"
            cy="32"
            rx="26"
            ry="11.5"
            transform="rotate(-27 32 32)"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            opacity=".7"
          />
          <path d="M17 14h6.4L32 37.5 40.6 14H47L32 53z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

/** Printer's registration cross, used at the corners of image frames. */
export function RegisterMark({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`size-5 text-accent ${className}`}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v22M1 12h22" />
    </svg>
  );
}

/**
 * A tilted orbit ring that crosses an image frame, with a point on it. The same
 * path as the empty Orbit screen in the app, drawn over a photograph.
 */
export function OrbitRing({
  className = '',
  rotate = -18,
  dot = '78%',
}: {
  readonly className?: string;
  readonly rotate?: number;
  readonly dot?: string;
}) {
  const track = 'M30 200a170 78 0 1 0 340 0a170 78 0 1 0-340 0';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 400"
      className={`pointer-events-none absolute ${className}`}
      focusable="false"
      fill="none"
    >
      <g transform={`rotate(${rotate} 200 200)`}>
        <path
          d={track}
          stroke="var(--vyra-cherry-bright)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          r="7"
          fill="var(--vyra-cherry)"
          style={{ offsetPath: `path('${track}')`, offsetDistance: dot }}
        />
      </g>
    </svg>
  );
}
