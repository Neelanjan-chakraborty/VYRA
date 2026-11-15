import { color, radius } from '@vyra/design-system';
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Modules of empty margin scanners need around a code. */
const QUIET_ZONE = 4;

/** Dark modules as one path: a run of horizontal rectangles per row. */
function modulesPath(data: string): { path: string; count: number } {
  const code = qrcode(0, 'M');
  code.addData(data);
  code.make();
  const count = code.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row += 1) {
    let start = -1;
    for (let column = 0; column <= count; column += 1) {
      const dark = column < count && code.isDark(row, column);
      if (dark && start < 0) start = column;
      if (!dark && start >= 0) {
        path += `M${start + QUIET_ZONE} ${row + QUIET_ZONE}h${column - start}v1h${start - column}z`;
        start = -1;
      }
    }
  }
  return { path, count };
}

/**
 * A QR code for `value`. Dark modules on a light plate in both themes, because
 * scanners need the contrast; the plate and ink come from the design tokens.
 */
export function QrCode({ value, size, label }: { value: string; size: number; label: string }) {
  const { path, count } = useMemo(() => modulesPath(value), [value]);
  const box = count + QUIET_ZONE * 2;
  return (
    <View style={[styles.plate, { width: size, height: size }]} role="img" aria-label={label}>
      <View aria-hidden>
        <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`}>
          <Path d={path} fill={color.background} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { backgroundColor: color.textPrimary, borderRadius: radius.m, overflow: 'hidden' },
});
