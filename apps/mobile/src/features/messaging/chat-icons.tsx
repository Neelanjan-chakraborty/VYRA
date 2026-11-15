import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type ChatIconName =
  | 'back'
  | 'more'
  | 'plus'
  | 'send'
  | 'emoji'
  | 'mic'
  | 'image'
  | 'calendar'
  | 'sparkle'
  | 'clock'
  | 'pin'
  | 'lock'
  | 'chevronRight'
  | 'chevronDown'
  | 'close'
  | 'reply'
  | 'edit'
  | 'copy'
  | 'forward'
  | 'trash'
  | 'flag'
  | 'check'
  | 'checkDouble'
  | 'play'
  | 'pause'
  | 'location';

const STROKE = 1.6;

interface ChatIconProps {
  readonly name: ChatIconName;
  readonly color: string;
  readonly size?: number;
}

/**
 * Chat's line set, drawn on the same 24pt grid and hairline stroke as the tab
 * icons. Decorative by default: the control around it carries the label.
 */
export function ChatIcon({ name, color, size = 24 }: ChatIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: STROKE,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {name === 'back' && <Path d="M14.5 5.5L8 12l6.5 6.5" {...stroke} />}
        {name === 'more' &&
          [6, 12, 18].map((cx) => <Circle key={cx} cx={cx} cy={12} r={1.6} fill={color} />)}
        {name === 'plus' && <Path d="M12 5v14M5 12h14" {...stroke} />}
        {name === 'send' && <Path d="M12 19V5M6.5 10.5L12 5l5.5 5.5" {...stroke} />}
        {name === 'emoji' && (
          <>
            <Circle cx="12" cy="12" r="8.6" {...stroke} />
            <Circle cx="9.2" cy="10.2" r="1" fill={color} />
            <Circle cx="14.8" cy="10.2" r="1" fill={color} />
            <Path d="M8.8 14c.9 1.3 1.9 1.9 3.2 1.9s2.3-.6 3.2-1.9" {...stroke} />
          </>
        )}
        {name === 'mic' && (
          <>
            <Rect x="9" y="4" width="6" height="10" rx="3" {...stroke} />
            <Path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3" {...stroke} />
          </>
        )}
        {name === 'image' && (
          <>
            <Rect x="4" y="5" width="16" height="14" rx="2.5" {...stroke} />
            <Circle cx="9" cy="10" r="1.4" {...stroke} />
            <Path d="M5.5 17l4.2-4 3 2.8 2.4-2.2 3.4 3.4" {...stroke} />
          </>
        )}
        {name === 'calendar' && (
          <>
            <Rect x="4" y="5.5" width="16" height="14" rx="2.5" {...stroke} />
            <Path d="M4 9.5h16M8.5 3.8v3.4M15.5 3.8v3.4" {...stroke} />
            <Circle cx="9" cy="13.5" r="1" fill={color} />
            <Circle cx="13" cy="13.5" r="1" fill={color} />
          </>
        )}
        {name === 'sparkle' && (
          <>
            <Path
              d="M12 3.8l1.6 4.8 4.8 1.6-4.8 1.6L12 16.6l-1.6-4.8L5.6 10.2l4.8-1.6z"
              {...stroke}
            />
            <Path d="M18.4 15.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" {...stroke} />
          </>
        )}
        {name === 'clock' && (
          <>
            <Circle cx="12" cy="12" r="8.4" {...stroke} />
            <Path d="M12 7.4V12l3.1 1.9" {...stroke} />
          </>
        )}
        {name === 'pin' && (
          <>
            <Path d="M9 4.5h6l-1 4 3 3v1.5H7V11.5l3-3z" {...stroke} />
            <Path d="M12 13v6.5" {...stroke} />
          </>
        )}
        {name === 'lock' && (
          <>
            <Rect x="6" y="10.5" width="12" height="9" rx="2.2" {...stroke} />
            <Path d="M8.8 10.5V8.2a3.2 3.2 0 0 1 6.4 0v2.3M12 14.2v2.2" {...stroke} />
          </>
        )}
        {name === 'chevronRight' && <Path d="M9.5 5.8L15.7 12l-6.2 6.2" {...stroke} />}
        {name === 'chevronDown' && <Path d="M6 9.5l6 6 6-6" {...stroke} />}
        {name === 'close' && <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...stroke} />}
        {name === 'reply' && (
          <Path d="M9.5 6L4 11.5 9.5 17M4.5 11.5H14a5.5 5.5 0 0 1 5.5 5.5v1.5" {...stroke} />
        )}
        {name === 'edit' && (
          <Path
            d="M4.5 19.5l.8-4.2L16.2 4.4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.7 18.7zM14.8 6l3.2 3.2"
            {...stroke}
          />
        )}
        {name === 'copy' && (
          <>
            <Rect x="8" y="8" width="11" height="11" rx="2" {...stroke} />
            <Path
              d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"
              {...stroke}
            />
          </>
        )}
        {name === 'forward' && <Path d="M14 6l5 5-5 5M19 11H9a5 5 0 0 0-5 5v2" {...stroke} />}
        {name === 'trash' && (
          <>
            <Path
              d="M4.8 7h14.4M9 7V4.8h6V7M6.6 7l.8 12.2h9.2L17.4 7M10 10.5v5.5M14 10.5v5.5"
              {...stroke}
            />
          </>
        )}
        {name === 'flag' && (
          <Path d="M6 20.5V4.5h8.5l-.8 3.2H19l-1.4 4.3H14l.7 3.2H6" {...stroke} />
        )}
        {name === 'check' && <Path d="M5.5 12.5l4 4 9-9" {...stroke} />}
        {name === 'checkDouble' && (
          <Path d="M2.8 12.5l3.5 3.5 7.4-7.4M9.3 15.2l.7.7 8.2-8.2" {...stroke} />
        )}
        {name === 'play' && <Path d="M8.5 5.8v12.4l10-6.2z" fill={color} />}
        {name === 'pause' && (
          <>
            <Rect x="7" y="5.5" width="3.8" height="13" rx="1" fill={color} />
            <Rect x="13.2" y="5.5" width="3.8" height="13" rx="1" fill={color} />
          </>
        )}
        {name === 'location' && (
          <>
            <Path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z" {...stroke} />
            <Circle cx="12" cy="10" r="2.2" {...stroke} />
          </>
        )}
      </Svg>
    </View>
  );
}
