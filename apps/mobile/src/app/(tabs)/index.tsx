import { color, space } from '@vyra/design-system';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { OrbitMotif } from '@/components/orbit-motif';
import { Screen } from '@/components/screen';
import { SearchButton } from '@/components/search-button';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { useRecommendations } from '@/features/discovery/discovery-api';
import { OrbitCanvas } from '@/features/discovery/orbit-canvas';
import { errorMessage } from '@/lib/api';

const MAX_CANVAS = 520;

export default function OrbitScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const recommendations = useRecommendations();
  const people = recommendations.data?.recommendations ?? [];
  const size = Math.min(MAX_CANVAS, width - space.xl * 2);

  if (recommendations.data && people.length === 0) {
    return (
      <Screen eyebrow="Orbit" title="Your orbit is still empty." action={<SearchButton />}>
        <Text tone="textSecondary">
          People appear here once someone fits what you’re both looking for. The closer someone sits
          to your centre, the more aligned you are estimated to be.
        </Text>
        <View
          style={styles.motif}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <OrbitMotif />
        </View>
      </Screen>
    );
  }

  return (
    <Screen eyebrow="Orbit" title="Who’s near your centre." action={<SearchButton />}>
      <Text tone="textSecondary" style={styles.intro}>
        Closer means more estimated alignment. The dashed outer ring holds people VYRA doesn’t know
        enough about yet. Tap anyone to read their profile.
      </Text>
      {recommendations.isPending ? (
        <ActivityIndicator color={color.textSecondary} style={styles.loading} />
      ) : null}
      {recommendations.isError ? (
        <>
          <ErrorNotice message={errorMessage(recommendations.error)} />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void recommendations.refetch()}
          />
        </>
      ) : null}
      {people.length > 0 ? <OrbitCanvas people={people} size={size} /> : null}
      {people.length > 0 ? (
        <Button
          label="Show as a list"
          variant="secondary"
          style={styles.list}
          onPress={() => router.push('/(tabs)/discover')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: space.l },
  loading: { marginTop: space.xl },
  list: { marginTop: space.l },
  // Offset from centre on purpose: the composition leans, like an orbit does.
  motif: { marginTop: space.xl, alignItems: 'flex-end', marginRight: -space.xl },
});
