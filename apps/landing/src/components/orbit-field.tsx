/**
 * VYRA's orbit motif at page scale: three tilted paths and one point in motion.
 * The same drawing as the empty Orbit screen in the app. Decorative.
 */
export function OrbitField({
  className,
  animated = true,
}: {
  readonly className?: string;
  readonly animated?: boolean;
}) {
  const rings = [
    { rx: 232, rotate: -24, dashed: false },
    { rx: 384, rotate: -15, dashed: false },
    { rx: 536, rotate: -6, dashed: true },
  ];
  // The middle ring as a path, for the point to travel along.
  const track = 'M176 560a384 176.6 0 1 0 768 0a384 176.6 0 1 0 -768 0';
  return (
    <svg
      viewBox="0 0 1120 1120"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      {rings.map((ring) => (
        <ellipse
          key={ring.rx}
          cx="560"
          cy="560"
          rx={ring.rx}
          ry={ring.rx * 0.46}
          transform={`rotate(${ring.rotate} 560 560)`}
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          {...(ring.dashed
            ? { strokeDasharray: '2 9' }
            : animated
              ? { pathLength: 1, className: 'orbit-draw' }
              : {})}
        />
      ))}
      <g transform="rotate(-15 560 560)">
        <circle
          r="7"
          fill="var(--vyra-cherry)"
          className={animated ? 'orbit-dot' : undefined}
          style={{ offsetPath: `path('${track}')`, offsetDistance: '8%' }}
        />
      </g>
      <circle cx="560" cy="560" r="5" fill="var(--fg)" />
      <circle cx="560" cy="560" r="15" stroke="var(--vyra-cherry)" strokeWidth="1" />
    </svg>
  );
}
