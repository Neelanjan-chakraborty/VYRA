import { color, radius, space } from '@vyra/design-system';
import type { Recommendation } from '@vyra/validation';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { ModeSwitch } from '@/components/ui/mode-switch';
import { ErrorNotice } from '@/components/ui/notice';
import { PhotoPlaceholder } from '@/components/ui/photo-placeholder';
import {
  alignmentWords,
  useCriteriaImpact,
  usePass,
  useRecommendations,
  useSave,
} from '@/features/discovery/discovery-api';
import { errorMessage } from '@/lib/api';

function Notice({
  title,
  body,
  action,
  href,
}: {
  title: string;
  body: string;
  action: string;
  href: '/settings/location' | '/settings/matters';
}) {
  const router = useRouter();
  return (
    <View style={styles.notice} role="note">
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="caption" tone="textSecondary">
        {body}
      </Text>
      <Button
        label={action}
        variant="quiet"
        onPress={() => router.push(href)}
        style={styles.noticeAction}
      />
    </View>
  );
}

type Filter = 'all' | 'strong' | 'interests' | 'nearby';

const FILTERS: Readonly<Record<Filter, { label: string; test: (p: Recommendation) => boolean }>> = {
  all: { label: 'All', test: () => true },
  strong: { label: 'Strong', test: (p) => p.overall !== null && p.overall >= 0.75 },
  interests: { label: 'Shared', test: (p) => p.sharedInterests.length > 0 },
  nearby: { label: 'Nearby', test: (p) => p.distance !== null },
};

function PersonCard({
  person,
  lead,
  onDone,
}: {
  person: Recommendation;
  lead: boolean;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const save = useSave();
  const pass = usePass();
  const meta = [person.age, person.city, person.distance].filter(Boolean).join(' · ');
  return (
    <View style={styles.cardWrap}>
      <Pressable
        role="link"
        aria-label={`${person.displayName}, ${meta}. ${alignmentWords(person.overall)}. Open profile`}
        onPress={() => router.push(`/person/${person.userId}`)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      >
        {person.photoUrl ? (
          <Image
            source={{ uri: person.photoUrl }}
            style={[styles.photo, lead && styles.leadPhoto]}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`Photo of ${person.displayName}`}
          />
        ) : (
          <PhotoPlaceholder
            name={person.displayName}
            style={{ ...styles.photo, ...(lead ? styles.leadPhoto : {}) }}
          />
        )}
        <View style={styles.cardCopy}>
          <Text variant={lead ? 'displayL' : 'displayM'}>{person.displayName}</Text>
          <Text variant="caption" tone="textSecondary">
            {meta}
            {person.distance === null && person.city ? ' · distance not shared' : ''}
          </Text>
          <Text variant="bodyStrong" tone="chemistryText" style={styles.alignment}>
            {alignmentWords(person.overall)}
          </Text>
          {person.highlights.slice(0, lead ? 3 : 2).map((line) => (
            <Text key={line} variant="caption" tone="textSecondary">
              — {line}
            </Text>
          ))}
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        <Button
          label="Pass"
          variant="quiet"
          aria-label={`Pass on ${person.displayName}`}
          loading={pass.isPending}
          onPress={() =>
            pass.mutate(person.userId, {
              onSuccess: () =>
                onDone(`You passed on ${person.displayName}. They won’t appear for 30 days.`),
            })
          }
        />
        <Button
          label="Save"
          variant="secondary"
          aria-label={`Save ${person.displayName}`}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              { userId: person.userId, saved: true },
              { onSuccess: () => onDone(`${person.displayName} is saved in Connections.`) },
            )
          }
        />
      </View>
      {save.isError || pass.isError ? (
        <ErrorNotice message={errorMessage(save.error ?? pass.error)} />
      ) : null}
    </View>
  );
}

export default function DiscoverScreen() {
  const recommendations = useRecommendations();
  const impact = useCriteriaImpact();
  const list = recommendations.data;
  const [filter, setFilter] = useState<Filter>('all');
  const [status, setStatus] = useState<string | null>(null);
  const all = list?.recommendations ?? [];
  const anyDistance = all.some((p) => p.distance !== null);
  const filters = (Object.keys(FILTERS) as Filter[]).filter((f) => f !== 'nearby' || anyDistance);
  const active = filters.includes(filter) ? filter : 'all';
  const shown = all.filter(FILTERS[active].test);

  return (
    <Screen eyebrow="Discover" title="Read people, don’t flick past them.">
      <Text tone="textSecondary" style={styles.intro}>
        Ordered by estimated alignment — a starting point for getting to know someone, not a
        prediction.
      </Text>

      {list?.distanceFilter === 'no_location' ? (
        <Notice
          title="Distance isn’t being used"
          body="You’ve chosen a distance limit, but there’s no location to measure from, so people from anywhere can appear."
          action="Set my location"
          href="/settings/location"
        />
      ) : null}
      {impact.data?.significant ? (
        <Notice
          title="Your must-haves are narrowing things a lot"
          body={`About ${impact.data.withMustHaves} of ${impact.data.withoutMustHaves} people who otherwise fit remain.`}
          action="Review what matters to you"
          href="/settings/matters"
        />
      ) : null}

      {recommendations.isPending ? (
        <ActivityIndicator color={color.textSecondary} style={styles.loading} />
      ) : null}
      {recommendations.isError ? (
        <View>
          <ErrorNotice message={errorMessage(recommendations.error)} />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void recommendations.refetch()}
          />
        </View>
      ) : null}
      {all.length > 0 ? (
        <View style={styles.filters}>
          <ModeSwitch
            label="Show"
            value={active}
            options={filters.map((f) => ({
              value: f,
              label: `${FILTERS[f].label} ${all.filter(FILTERS[f].test).length}`,
            }))}
            onChange={(f) => {
              setFilter(f);
              setStatus(null);
            }}
          />
        </View>
      ) : null}
      {status ? (
        <Text variant="caption" tone="textSecondary" role="status" style={styles.status}>
          {status}
        </Text>
      ) : null}
      {all.length > 0 && shown.length === 0 ? (
        <Text tone="textSecondary">No one here matches that filter right now.</Text>
      ) : null}
      {list && list.recommendations.length === 0 ? (
        <Text tone="textSecondary">
          Nobody fits your choices right now. Widening your age range, distance or must-haves will
          show more people.
        </Text>
      ) : null}
      {shown.map((person, index) => (
        <PersonCard key={person.userId} person={person} lead={index === 0} onDone={setStatus} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: space.xl },
  loading: { marginTop: space.xl },
  notice: {
    borderLeftWidth: 2,
    borderLeftColor: color.border,
    paddingLeft: space.m,
    marginBottom: space.xl,
    gap: space.xs,
  },
  noticeAction: { alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 36 },
  filters: { marginBottom: space.l },
  status: { marginBottom: space.m },
  cardWrap: {
    paddingVertical: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  card: { flexDirection: 'row', gap: space.l },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.s },
  photo: { width: 112, aspectRatio: 0.8, borderRadius: radius.m, backgroundColor: color.surface },
  leadPhoto: { width: 150 },
  cardCopy: { flex: 1, gap: space.xxs },
  alignment: { marginTop: space.s, marginBottom: space.xs },
});
