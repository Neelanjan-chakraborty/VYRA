import { Platform, type TextStyle } from 'react-native';

/**
 * Removes the browser's own focus outline from a text input. Only for inputs
 * whose container already shows focus (a border change), so focus stays visible.
 * `outlineStyle: 'none'` is valid CSS but not in React Native's style types.
 */
export const noBrowserFocusRing: TextStyle =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {};
