import { color, typography, type ColorToken, type TypographyToken } from '@vyra/design-system';
import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

type TextTone = Extract<
  ColorToken,
  | 'textPrimary'
  | 'textSecondary'
  | 'textDisabled'
  | 'accent'
  | 'chemistryText'
  | 'danger'
  | 'success'
>;

export interface TextProps extends NativeTextProps {
  readonly variant?: TypographyToken;
  readonly tone?: TextTone;
}

/** The only text primitive: every string on screen uses a type-scale token. */
export function Text({ variant = 'body', tone = 'textPrimary', style, ...rest }: TextProps) {
  return (
    <NativeText
      {...rest}
      style={[
        typography[variant],
        { color: color[tone] },
        variant === 'eyebrow' && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
