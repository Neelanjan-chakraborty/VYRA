import { color, space } from '@vyra/design-system';
import {
  PERSONA_ATTRIBUTE_KEYS,
  PERSONA_ATTRIBUTES,
  type PersonaAttributeKey,
  type PersonaAttributeView,
  type PersonaVersionView,
} from '@vyra/validation';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { describeValue, sourceLabel } from './format';

interface PersonaReviewProps {
  readonly version: PersonaVersionView;
  readonly onEdit: (key: PersonaAttributeKey) => void;
  readonly onConfirm: (key: PersonaAttributeKey) => void;
  readonly onRemove: (key: PersonaAttributeKey) => void;
}

function Action({ label, name, onPress }: { label: string; name: string; onPress: () => void }) {
  return (
    <Pressable
      role="button"
      aria-label={`${label} ${name}`}
      onPress={onPress}
      hitSlop={8}
      style={styles.action}
    >
      <Text variant="caption" tone="textPrimary" style={styles.actionText}>
        {label}
      </Text>
    </Pressable>
  );
}

function AttributeRow({
  attributeKey,
  view,
  props,
}: {
  attributeKey: PersonaAttributeKey;
  view: PersonaAttributeView;
  props: PersonaReviewProps;
}) {
  const name = PERSONA_ATTRIBUTES[attributeKey].label;
  const stated = view.evidenceCategory === 'USER_STATED';
  return (
    <View style={styles.row} role="group" aria-label={name}>
      <Text variant="eyebrow" tone="textSecondary">
        {name}
      </Text>
      <Text variant="title" style={styles.value}>
        {describeValue(attributeKey, view.value)}
      </Text>
      {stated ? null : <ConfidenceMeter confidence={view.confidence} />}
      {view.needsReview ? (
        <Text variant="caption" tone="chemistryText" style={styles.note}>
          Your sources disagree on this one. Check it’s right.
        </Text>
      ) : null}
      {view.evidence
        .filter((e) => e.sourceType !== 'USER_CORRECTION')
        .map((e, index) => (
          <Text key={index} variant="caption" tone="textSecondary" style={styles.note}>
            {e.summary} — from {sourceLabel(e.sourceType, e.sourceDetail)}
          </Text>
        ))}
      <View style={styles.actions}>
        {stated ? null : (
          <Action label="That’s right" name={name} onPress={() => props.onConfirm(attributeKey)} />
        )}
        <Action label="Change" name={name} onPress={() => props.onEdit(attributeKey)} />
        <Action label="Remove" name={name} onPress={() => props.onRemove(attributeKey)} />
      </View>
    </View>
  );
}

/**
 * The persona split the way the person should read it: what they told us,
 * what was inferred (with confidence and why), and what is still unknown.
 */
export function PersonaReview(props: PersonaReviewProps) {
  const entries = PERSONA_ATTRIBUTE_KEYS.flatMap((key) => {
    const view = props.version.attributes[key];
    return view ? [[key, view] as const] : [];
  });
  const stated = entries.filter(([, v]) => v.evidenceCategory === 'USER_STATED');
  const inferred = entries.filter(([, v]) => v.evidenceCategory !== 'USER_STATED');

  return (
    <View>
      <Section title="You told us" empty="Nothing yet. Anything you change or confirm moves here.">
        {stated.map(([key, view]) => (
          <AttributeRow key={key} attributeKey={key} view={view} props={props} />
        ))}
      </Section>
      <Section title="We inferred" empty="Nothing inferred.">
        {inferred.map(([key, view]) => (
          <AttributeRow key={key} attributeKey={key} view={view} props={props} />
        ))}
      </Section>
      <Section title="Not known yet" empty="">
        <View style={styles.unknownList}>
          {props.version.unknown.map((key) => (
            <Pressable
              key={key}
              role="button"
              aria-label={`Add ${PERSONA_ATTRIBUTES[key].label}`}
              onPress={() => props.onEdit(key)}
              style={styles.unknown}
            >
              <Text>{PERSONA_ATTRIBUTES[key].label}</Text>
              <Text variant="caption" tone="textSecondary">
                Add
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
    </View>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : children !== null;
  return (
    <View style={styles.section}>
      <Text variant="displayM" accessibilityRole="header">
        {title}
      </Text>
      {hasChildren ? (
        children
      ) : empty ? (
        <Text tone="textSecondary" style={styles.empty}>
          {empty}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.xxl },
  empty: { marginTop: space.s },
  row: {
    paddingVertical: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
    gap: space.xs,
  },
  value: { marginBottom: space.xs },
  note: { marginTop: space.xxs },
  actions: { flexDirection: 'row', gap: space.xl, marginTop: space.s },
  action: { minHeight: 32, justifyContent: 'center' },
  actionText: { textDecorationLine: 'underline' },
  unknownList: { marginTop: space.s },
  unknown: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
});
