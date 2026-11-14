import { space } from '@vyra/design-system';
import {
  GENDER_CATEGORIES,
  GENDER_IDENTITIES,
  GENDER_LABELS,
  PROFILE_LIMITS,
  SHOW_GENDER_LABELS,
  type GenderCategory,
  type GenderIdentity,
} from '@vyra/validation';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { SelectRow } from '@/components/ui/select-row';
import { Tag } from '@/components/ui/tag';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';

export interface GenderValue {
  readonly identity: GenderIdentity | null;
  readonly selfDescription: string;
  readonly discoverableAs: readonly GenderCategory[];
  readonly visible: boolean;
}

interface GenderFieldProps {
  readonly value: GenderValue;
  readonly onChange: (value: GenderValue) => void;
  readonly error?: string | undefined;
}

/** Gender as the person states it. Optional, private unless they choose to show it. */
export function GenderField({ value, onChange, error }: GenderFieldProps) {
  const set = (patch: Partial<GenderValue>) => onChange({ ...value, ...patch });
  const toggleSearch = (category: GenderCategory) =>
    set({
      discoverableAs: value.discoverableAs.includes(category)
        ? value.discoverableAs.filter((c) => c !== category)
        : [...value.discoverableAs, category],
    });

  return (
    <View style={styles.root}>
      <Text variant="eyebrow" tone="textSecondary">
        Gender (optional)
      </Text>
      <Text variant="caption" tone="textSecondary" style={styles.note}>
        Used privately to match your “show me” choices with other people’s. It’s only on your
        profile if you turn that on.
      </Text>
      <View role="radiogroup" aria-label="Gender">
        {GENDER_IDENTITIES.map((identity) => (
          <SelectRow
            key={identity}
            kind="radio"
            label={GENDER_LABELS[identity]}
            selected={value.identity === identity}
            onPress={() => set({ identity: value.identity === identity ? null : identity })}
          />
        ))}
      </View>

      {value.identity === 'SELF_DESCRIBE' ? (
        <View style={styles.describe}>
          <TextField
            label="In your words"
            value={value.selfDescription}
            onChangeText={(selfDescription) => set({ selfDescription })}
            maxLength={PROFILE_LIMITS.short}
            error={error}
          />
          <Text variant="caption" tone="textSecondary" style={styles.note}>
            Include me when people look for (optional)
          </Text>
          <View style={styles.tags}>
            {GENDER_CATEGORIES.map((category) => (
              <Tag
                key={category}
                label={SHOW_GENDER_LABELS[category]}
                selected={value.discoverableAs.includes(category)}
                onPress={() => toggleSearch(category)}
              />
            ))}
          </View>
          <Text variant="caption" tone="textSecondary" style={styles.note}>
            If you choose none, you’re shown to people who include everyone.
          </Text>
        </View>
      ) : null}

      {value.identity && value.identity !== 'PREFER_NOT_TO_SAY' ? (
        <View style={styles.visible}>
          <View style={styles.visibleCopy}>
            <Text variant="bodyStrong">Show on my profile</Text>
            <Text variant="caption" tone="textSecondary">
              Off: nobody sees it. On: people you’re suggested to can see it.
            </Text>
          </View>
          <Toggle
            label="Show gender on my profile"
            value={value.visible}
            onChange={(visible) => set({ visible })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.l, marginBottom: space.xl },
  note: { marginTop: space.xs, marginBottom: space.s },
  describe: { marginTop: space.l },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginBottom: space.xs },
  visible: { flexDirection: 'row', alignItems: 'center', gap: space.l, marginTop: space.l },
  visibleCopy: { flex: 1, gap: space.xxs },
});
