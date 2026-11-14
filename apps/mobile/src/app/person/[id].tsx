import { color, radius, space } from '@vyra/design-system';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import {
  alignmentWords,
  useCompatibility,
  usePublicProfile,
} from '@/features/discovery/discovery-api';
import { errorMessage } from '@/lib/api';

/** Another person's profile as VYRA is allowed to show it. Only approved photos ever arrive here. */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
        <ErrorNotice message={errorMessage(profile.error)} />
        <Button label="Try again" variant="secondary" onPress={() => void profile.refetch()} />
      </FormScreen>
    );
  }

  const meta = [person.age, person.gender, person.city, person.distance]
    .filter(Boolean)
    .join(' · ');
  const aligned = result
    ? Object.values(result.dimensions)
        .flatMap((d) => d.aligned)
        .slice(0, 4)
    : [];
  const different = result
    ? Object.values(result.dimensions)
        .flatMap((d) => d.different)
        .slice(0, 3)
    : [];

  return (
    <FormScreen eyebrow="Profile" title={person.displayName}>
      <Text tone="textSecondary" style={styles.meta}>
        {meta}
      </Text>
      <View style={styles.photos}>
        {person.photos.length === 0 ? (
          <PhotoPlaceholder name={person.displayName} style={styles.lead} />
        ) : (
          person.photos.map((photo, index) => (
            <Image
              key={photo.id}
              source={{ uri: photo.url }}
              style={index === 0 ? styles.lead : styles.more}
              contentFit="cover"
              accessibilityLabel={`Photo ${index + 1} of ${person.displayName}`}
            />
          ))
        )}
      </View>

      {person.bio ? <Text style={styles.section}>{person.bio}</Text> : null}
      {person.occupation ? <Text tone="textSecondary">{person.occupation}</Text> : null}

      <View style={styles.section}>
        <Text variant="eyebrow" tone="textSecondary">
          Estimated alignment
        </Text>
        <Text variant="displayM" tone="chemistryText" style={styles.alignment}>
          {result ? alignmentWords(result.overall) : '…'}
        </Text>
        {aligned.map((line) => (
          <Text key={line} tone="textSecondary">
            — {line}
          </Text>
        ))}
        {different.length > 0 ? (
          <>
            <Text variant="eyebrow" tone="textSecondary" style={styles.subheading}>
              Where you differ
            </Text>
            {different.map((line) => (
              <Text key={line} tone="textSecondary">
                — {line}
              </Text>
            ))}
          </>
        ) : null}
      </View>

      {person.interests.length > 0 ? (
        <View style={styles.section}>
          <Text variant="eyebrow" tone="textSecondary">
            Interests
          </Text>
          <Text style={styles.interests}>{person.interests.join(' · ')}</Text>
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
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  lead: { width: '100%', aspectRatio: 0.8, borderRadius: radius.m, backgroundColor: color.surface },
  more: {
    width: '48.5%',
    aspectRatio: 0.8,
    borderRadius: radius.m,
    backgroundColor: color.surface,
  },
  section: { marginTop: space.xl },
  alignment: { marginTop: space.xs, marginBottom: space.s },
  subheading: { marginTop: space.l, marginBottom: space.xs },
  interests: { marginTop: space.xs },
});
