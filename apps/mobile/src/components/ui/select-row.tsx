import { color, MIN_TOUCH_TARGET, space } from '@vyra/design-system';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../text';

interface SelectRowProps {
  readonly label: string;
  readonly description?: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  /** `checkbox` allows several in a group, `radio` exactly one. */
  readonly kind?: 'checkbox' | 'radio';
}

/** A full-width choice separated by hairlines rather than boxed in a card. */
export function SelectRow({
  label,
  description,
  selected,
  onPress,
  kind = 'checkbox',
}: SelectRowProps) {
  return (
    <Pressable
      role={kind}
      aria-checked={selected}
      aria-label={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.surface }]}
    >
      <View style={styles.copy}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" tone="textSecondary" style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.mark, kind === 'radio' && styles.round, selected && styles.markOn]}>
        {selected ? (
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path
              d="M2.5 7.4l3 3 6-6.6"
              stroke={color.background}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET + space.l,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  copy: { flex: 1, paddingRight: space.l },
  description: { marginTop: space.xxs },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: color.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: { borderRadius: 12 },
  markOn: { backgroundColor: color.textPrimary, borderColor: color.textPrimary },
});
