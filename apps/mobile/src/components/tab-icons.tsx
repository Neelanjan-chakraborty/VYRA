import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

export type TabIconName = 'orbit' | 'discover' | 'connections' | 'messages' | 'you' | 'search';

interface TabIconProps {
  readonly name: TabIconName;
  readonly color: string;
  readonly size?: number;
}

const STROKE = 1.6;

/** VYRA's own line icons, drawn on a 24pt grid with a consistent hairline stroke. */
export function TabIcon({ name, color, size = 24 }: TabIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: STROKE,
    fill: 'none',
    strokeLinecap: 'round',
  } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'orbit' && (
        <>
          <Ellipse cx="12" cy="12" rx="9.5" ry="4.6" transform="rotate(-28 12 12)" {...stroke} />
          <Circle cx="12" cy="12" r="2.4" fill={color} />
          <Circle cx="19.6" cy="7.4" r="1.4" fill={color} />
        </>
      )}
      {name === 'discover' && (
        <>
          <Circle cx="12" cy="12" r="9" {...stroke} />
          <Path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z" {...stroke} strokeLinejoin="round" />
        </>
      )}
      {name === 'search' && (
        <>
          <Circle cx="10.5" cy="10.5" r="6.5" {...stroke} />
          <Path d="M15.4 15.4L20 20" {...stroke} />
        </>
      )}
      {name === 'connections' && (
        <>
          <Circle cx="8.8" cy="12" r="5.8" {...stroke} />
          <Circle cx="15.2" cy="12" r="5.8" {...stroke} />
        </>
      )}
      {name === 'messages' && (
        <Path d="M4 6.5h16v10.5h-8.6L7 20.5v-3.5H4z" {...stroke} strokeLinejoin="round" />
      )}
      {name === 'you' && (
        <>
          <Circle cx="12" cy="8.4" r="3.6" {...stroke} />
          <Path d="M4.8 20c.9-3.6 3.8-5.6 7.2-5.6s6.3 2 7.2 5.6" {...stroke} />
        </>
      )}
    </Svg>
  );
}
