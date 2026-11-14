import { color, radius, space } from '@vyra/design-system';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import {
  alignmentWords,
  confidenceWords,
  useCompatibility,
  usePublicProfile,
} from '@/features/discovery/discovery-api';
import { PersonActions } from '@/features/discovery/person-actions';
import { errorMessage } from '@/lib/api';

/**
 * Deep Discover: another person's profile as VYRA is allowed to show it, read
 * slowly. Only approved photos ever arrive here.
 */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = usePublicProfile(id);
  const compatibility = useCompatibility(id);
  const person = profile.data;
  const result = compatibility.data?.result;

  if (profile.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.textSecondary} />
      </View>
    );
  }
  if (!person) {
    return (
      <FormScreen title="This profile isn’t available." eyebrow="Profile">
        <Text tone="textSecondary" style={styles.meta}>
          They may have paused their profile, or no longer fit what either of you is looking for.
        </Text>
        <ErrorNotice message={errorMessage(profile.error)} />
        <Button label="Try again" variant="secondary" onPress={() => void profile.refetch()} />
      </FormScreen>
    );
  }

  const meta = [person.age, person.gender, person.city, person.distance]
    .filter(Boolean)
    .join(' · ');
  const dimensions = result ? Object.values(result.dimensions) : [];
  const aligned = dimensions.flatMap((d) => d.aligned).slice(0, 4);
  const different = dimensions.flatMap((d) => d.different).slice(0, 3);
  const otherInterests = person.interests.filter((i) => !person.sharedInterests.includes(i));
  const [lead, ...more] = person.photos;

  return (
    <FormScreen
      eyebrow="Profile"
      title={person.displayName}
      footer={<PersonActions userId={person.userId} name={person.displayName} />}
    >
      <Text tone="textSecondary" style={styles.meta}>
        {meta}
      </Text>
      {lead ? (
        <Image
          source={{ uri: lead.url }}
          style={styles.lead}
          contentFit="cover"
          accessibilityLabel={`Photo 1 of ${person.displayName}`}
        />
      ) : (
        <PhotoPlaceholder name={person.displayName} style={styles.lead} />
      )}

      {person.bio ? (
        <Text variant="title" style={styles.bio}>
          {person.bio}
        </Text>
      ) : null}
      {person.occupation ? <Text tone="textSecondary">{person.occupation}</Text> : null}

      <View style={styles.section}>
        <Text variant="eyebrow" tone="textSecondary">
          Estimated alignment
        </Text>
        <Text variant="displayM" tone="chemistryText" style={styles.alignment}>
          {result ? alignmentWords(result.overall) : '…'}
        </Text>
        {result ? (
          <Text variant="caption" tone="textSecondary">
            {confidenceWords(result.confidence)} · a starting point, not a prediction
          </Text>
        ) : null}
        {aligned.length > 0 ? (
          <>
            <Text variant="eyebrow" tone="textSecondary" style={styles.subheading}>
              Why you might connect
            </Text>
            {aligned.map((line) => (
              <Text key={line} style={styles.line}>
                — {line}
              </Text>
            ))}
          </>
        ) : null}
        {different.length > 0 ? (
          <>
            <Text variant="eyebrow" tone="textSecondary" style={styles.subheading}>
              Where you differ
            </Text>
            {different.map((line) => (
              <Text key={line} tone="textSecondary" style={styles.line}>
                — {line}
              </Text>
            ))}
          </>
        ) : null}
        <Button
          label="See the full picture"
          variant="secondary"
          style={styles.more}
          onPress={() => router.push(`/person/${person.userId}/compatibility`)}
        />
      </View>

      {more.length > 0 ? (
        <View style={[styles.section, styles.photos]}>
          {more.map((photo, index) => (
            <Image
              key={photo.id}
              source={{ uri: photo.url }}
              style={styles.morePhoto}
              contentFit="cover"
              accessibilityLabel={`Photo ${index + 2} of ${person.displayName}`}
            />
          ))}
        </View>
      ) : null}

      {person.interests.length > 0 ? (
        <View style={styles.section}>
          <Text variant="eyebrow" tone="textSecondary">
            Interests
          </Text>
          <View style={styles.tags}>
            {person.sharedInterests.map((label) => (
              <View key={label} style={[styles.chip, styles.chipShared]}>
                <Text variant="caption" tone="chemistryText">
                  {label} · shared
                </Text>
              </View>
            ))}
            {otherInterests.map((label) => (
              <View key={label} style={styles.chip}>
                <Text variant="caption">{label}</Text>
              </View>
            ))}
          </View>
        </View>
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
  meta: { marginTop: -space.s, marginBottom: space.l },
  lead: { width: '100%', aspectRatio: 0.8, borderRadius: radius.m, backgroundColor: color.surface },
  bio: { marginTop: space.xl },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  morePhoto: {
    width: '48.5%',
    aspectRatio: 0.8,
    borderRadius: radius.m,
    backgroundColor: color.surface,
  },
  section: { marginTop: space.xxl },
  alignment: { marginTop: space.xs, marginBottom: space.xs },
  subheading: { marginTop: space.xl, marginBottom: space.xs },
  line: { marginTop: space.xxs },
  more: { marginTop: space.xl, alignSelf: 'flex-start' },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.s,
    paddingHorizontal: space.s,
    paddingVertical: space.xs,
  },
  chipShared: { borderColor: color.chemistry },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s },
});
