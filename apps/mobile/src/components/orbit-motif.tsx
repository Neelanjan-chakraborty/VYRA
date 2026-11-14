import { color } from '@vyra/design-system';
import Svg, { Circle, Ellipse } from 'react-native-svg';

/**
 * Static illustration for the empty Orbit: three tilted paths around a centre
 * with no one on them yet. Decorative, so hidden from assistive technology.
 */
export function OrbitMotif({ size = 280 }: { readonly size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      {[58, 96, 134].map((rx, index) => (
        <Ellipse
          key={rx}
          cx="140"
          cy="140"
          rx={rx}
          ry={rx * 0.46}
          transform={`rotate(${-24 + index * 9} 140 140)`}
          stroke={color.border}
          strokeWidth={1}
          strokeDasharray={index === 2 ? '2 7' : undefined}
          fill="none"
        />
      ))}
      <Circle cx="140" cy="140" r="5" fill={color.textPrimary} />
      <Circle cx="140" cy="140" r="13" stroke={color.accent} strokeWidth={1} fill="none" />
    </Svg>
  );
}
