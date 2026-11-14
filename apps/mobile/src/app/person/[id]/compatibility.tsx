import { color, radius, space } from '@vyra/design-system';
import {
  COMPATIBILITY_DIMENSIONS,
  type CompatibilityDimension,
  SCENARIO_TITLES,
} from '@vyra/validation';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import {
  alignmentWords,
  confidenceWords,
  useCompatibility,
  usePublicProfile,
} from '@/features/discovery/discovery-api';
import { errorMessage } from '@/lib/api';

const DIMENSION_TITLES: Readonly<Record<CompatibilityDimension, string>> = {
  emotional: 'Emotional rhythm',
  communication: 'How you talk',
  lifestyle: 'Everyday life',
  relationshipAlignment: 'What you’re looking for',
  intellectual: 'Curiosity and ideas',
  mutualPreferences: 'What you each asked for',
};

function scenarioWords(alignment: number | null): string {
  if (alignment === null) return 'Not enough to say';
  if (alignment >= 0.75) return 'Likely easy';
  if (alignment >= 0.55) return 'Mostly in step';
  if (alignment >= 0.4) return 'Some give and take';
  return 'Could take effort';
}

/** A labelled bar. The fill length is the estimate; a missing estimate draws no bar at all. */
function DimensionBar({ title, score }: { title: string; score: number | null }) {
  const percent = score === null ? null : Math.round(score * 100);
  return (
    <View
      style={styles.dimension}
      role="meter"
      aria-label={`${title}: ${score === null ? 'not enough to say' : alignmentWords(score)}`}
      {...(percent === null ? {} : { 'aria-valuenow': percent })}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <View style={styles.dimensionHead}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="textSecondary">
          {score === null ? 'Not enough to say' : alignmentWords(score).replace(' estimated', '')}
        </Text>
      </View>
      <View style={styles.track}>
        {percent === null ? null : <View style={[styles.fill, { width: `${percent}%` }]} />}
      </View>
    </View>
  );
}

/** The whole estimate between you and one person, in words first and numbers never. */
export default function CompatibilityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = usePublicProfile(id);
  const compatibility = useCompatibility(id);
  const result = compatibility.data?.result;
  const name = profile.data?.displayName ?? 'them';

  if (compatibility.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.textSecondary} />
      </View>
    );
  }
  if (!result) {
    return (
      <FormScreen title="This isn’t available." eyebrow="Compatibility">
        <ErrorNotice message={errorMessage(compatibility.error)} />
        <Button
          label="Try again"
          variant="secondary"
          onPress={() => void compatibility.refetch()}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen eyebrow="Compatibility" title={`You and ${name}`}>
      <Text variant="displayM" tone="chemistryText">
        {alignmentWords(result.overall)}
      </Text>
      <Text tone="textSecondary" style={styles.caveat}>
        {confidenceWords(result.confidence)}. This is estimated alignment from what you’ve each
        approved — a starting point for getting to know someone, not a prediction.
      </Text>
      {result.sufficiency === 'INSUFFICIENT' ? (
        <Text tone="textSecondary" style={styles.caveat}>
          There isn’t enough yet to say much. Adding to your persona helps, and so does theirs.
        </Text>
      ) : null}

      <Text variant="eyebrow" tone="textSecondary" style={styles.heading}>
        Six ways of looking at it
      </Text>
      {COMPATIBILITY_DIMENSIONS.map((key) => {
        const dimension = result.dimensions[key];
        return (
          <View key={key} style={styles.block}>
            <DimensionBar title={DIMENSION_TITLES[key]} score={dimension.score} />
            {dimension.aligned.map((line) => (
              <Text key={line} variant="caption" style={styles.line}>
                — {line}
              </Text>
            ))}
            {dimension.different.map((line) => (
              <Text key={line} variant="caption" tone="textSecondary" style={styles.line}>
                — {line}
              </Text>
            ))}
          </View>
        );
      })}

      <Text variant="eyebrow" tone="textSecondary" style={styles.heading}>
        In practice
      </Text>
      {result.scenarios.map((scenario) => (
        <View key={scenario.key} style={styles.scenario}>
          <Text style={styles.scenarioTitle}>{SCENARIO_TITLES[scenario.key]}</Text>
          <Text
            variant="caption"
            tone={scenario.alignment === null ? 'textDisabled' : 'textSecondary'}
          >
            {scenarioWords(scenario.alignment)}
          </Text>
        </View>
      ))}

      {result.sharedInterests.length > 0 ? (
        <>
          <Text variant="eyebrow" tone="textSecondary" style={styles.heading}>
            You both chose
          </Text>
          <Text>{result.sharedInterests.join(' · ')}</Text>
        </>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background,
  },
  caveat: { marginTop: space.s },
  heading: { marginTop: space.xxl, marginBottom: space.s },
  block: { paddingVertical: space.m, gap: space.xxs },
  dimension: { gap: space.s, marginBottom: space.xs },
  dimensionHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.m },
  track: { height: 4, borderRadius: radius.s, backgroundColor: color.surfaceRaised },
  fill: { height: 4, borderRadius: radius.s, backgroundColor: color.chemistryText },
  line: { marginTop: space.xxs },
  scenario: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.m,
    paddingVertical: space.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  scenarioTitle: { flex: 1 },
});
