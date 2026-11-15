import { color, radius, space } from '@vyra/design-system';
import type { Me } from '@vyra/validation';
import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '@/components/screen';
import { ServiceStatus } from '@/components/service-status';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { Toggle } from '@/components/ui/toggle';
import { signOut } from '@/features/auth/auth-api';
import { useBlocked } from '@/features/discovery/discovery-api';
import { usePersona } from '@/features/persona/persona-api';
import { useDeleteAccount, useMe, useUpdateProfile } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/api';

const INTENT_LABELS = {
  serious: 'Something serious',
  casual: 'Something casual',
  exploring: 'Still working it out',
  companionship: 'Companionship',
  other: 'Something else',
} as const;

function intentSummary(me: Me): string {
  return (
    me.relationshipIntents.map((i) => i.customLabel ?? INTENT_LABELS[i.kind]).join(' · ') ||
    'Not set'
  );
}

function preferenceSummary(me: Me): string {
  const prefs = me.discoveryPreferences;
  if (!prefs) return 'Not set';
  const distance =
    prefs.maxDistanceKm === null
      ? 'anywhere'
      : me.location?.distanceAvailable
        ? `within ${prefs.maxDistanceKm} km`
        : `within ${prefs.maxDistanceKm} km (needs a location)`;
  return `Ages ${prefs.minAge}–${prefs.maxAge}, ${distance}`;
}

function personaSummary(view: ReturnType<typeof usePersona>['data']): string {
  if (!view) return 'Loading…';
  if (view.generation.status === 'queued' || view.generation.status === 'generating')
    return 'Being prepared…';
  if (view.draft) return 'New suggestions to review';
  if (view.current) {
    const n = Object.keys(view.current.attributes).length;
    return `${n} ${n === 1 ? 'thing' : 'things'} approved`;
  }
  return 'Not set up';
}

function criteriaSummary(me: Me): string {
  const criteria = me.discoveryPreferences?.criteria ?? [];
  const must = criteria.filter((c) => c.mode === 'must').length;
  const prefer = criteria.filter((c) => c.mode === 'prefer').length;
  if (must + prefer === 0) return 'Open to everything';
  return [
    must ? `${must} must-have${must > 1 ? 's' : ''}` : null,
    prefer ? `${prefer} preference${prefer > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function blockedSummary(count: number | undefined): string {
  if (count === undefined) return '…';
  if (count === 0) return 'Nobody';
  return `${count} ${count === 1 ? 'person' : 'people'}`;
}

function LinkRow(props: { label: string; value: string; href: Href }) {
  const router = useRouter();
  return (
    <Pressable
      role="link"
      aria-label={`${props.label}: ${props.value}`}
      onPress={() => router.push(props.href)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.surface }]}
    >
      <View style={styles.rowCopy}>
        <Text variant="bodyStrong">{props.label}</Text>
        <Text variant="caption" tone="textSecondary" numberOfLines={1} style={styles.rowValue}>
          {props.value}
        </Text>
      </View>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M9.5 5.5L16 12l-6.5 6.5"
          stroke={color.textSecondary}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

export default function YouScreen() {
  const me = useMe().data;
  const persona = usePersona().data;
  const blocked = useBlocked();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  if (!me?.profile) return null;
  const { profile } = me;
  const lead = me.photos[0];

  return (
    <Screen eyebrow="You" title={`${profile.displayName}, ${me.age}`}>
      <View style={styles.hero}>
        {lead ? (
          <Image
            source={{ uri: lead.url }}
            style={styles.photo}
            contentFit="cover"
            accessibilityLabel="Your first photo"
          />
        ) : null}
        <View style={styles.heroCopy}>
          {profile.city ? <Text tone="textSecondary">{profile.city}</Text> : null}
          {profile.occupation ? <Text tone="textSecondary">{profile.occupation}</Text> : null}
          {profile.bio ? (
            <Text style={styles.bio} numberOfLines={6}>
              {profile.bio}
            </Text>
          ) : null}
        </View>
      </View>

      <Text variant="eyebrow" tone="textSecondary" style={styles.section}>
        Profile
      </Text>
      <LinkRow
        label="About you"
        value={profile.bio ?? 'Add a few lines'}
        href="/settings/profile"
      />
      <LinkRow label="Photos" value={`${me.photos.length} of 6`} href="/settings/photos" />
      <LinkRow
        label="Interests"
        value={me.interests.map((i) => i.label).join(', ') || 'None chosen'}
        href="/settings/interests"
      />
      <LinkRow label="Looking for" value={intentSummary(me)} href="/settings/intention" />
      <LinkRow label="Your persona" value={personaSummary(persona)} href="/settings/persona" />

      <Text variant="eyebrow" tone="textSecondary" style={styles.section}>
        Discovery
      </Text>
      <LinkRow
        label="Where you are"
        value={
          me.location
            ? [me.location.area, me.location.city].filter(Boolean).join(', ') || 'Set'
            : 'Not set — distance isn’t used'
        }
        href="/settings/location"
      />
      <LinkRow label="Who you see" value={preferenceSummary(me)} href="/settings/preferences" />
      <LinkRow label="What matters to you" value={criteriaSummary(me)} href="/settings/matters" />
      <LinkRow
        label="Blocked people"
        value={blockedSummary(blocked.data?.blocked.length)}
        href="/settings/blocked"
      />
      <View style={styles.row}>
        <View style={styles.rowCopy}>
          <Text variant="bodyStrong">Visible to others</Text>
          <Text variant="caption" tone="textSecondary" style={styles.rowValue}>
            {profile.isDiscoverable
              ? 'You can be suggested to people.'
              : 'Hidden. Nobody new will see you.'}
          </Text>
        </View>
        <Toggle
          label="Visible to others"
          value={profile.isDiscoverable}
          disabled={updateProfile.isPending}
          onChange={(isDiscoverable) => updateProfile.mutate({ isDiscoverable })}
        />
      </View>
      <Text variant="eyebrow" tone="textSecondary" style={styles.section}>
        Notifications
      </Text>
      {(
        [
          ['notifyMessages', 'New messages', 'Who wrote to you — never what they said.'],
          ['notifyRequests', 'Connection requests', 'When someone asks to connect or says yes.'],
        ] as const
      ).map(([key, label, description]) => (
        <View key={key} style={styles.row}>
          <View style={styles.rowCopy}>
            <Text variant="bodyStrong">{label}</Text>
            <Text variant="caption" tone="textSecondary" style={styles.rowValue}>
              {description}
            </Text>
          </View>
          <Toggle
            label={`Notifications for ${label.toLowerCase()}`}
            value={profile[key]}
            disabled={updateProfile.isPending}
            onChange={(value) => updateProfile.mutate({ [key]: value })}
          />
        </View>
      ))}
      <ErrorNotice
        message={updateProfile.isError ? errorMessage(updateProfile.error) : undefined}
      />

      <Text variant="eyebrow" tone="textSecondary" style={styles.section}>
        Account
      </Text>
      <View style={styles.row}>
        <View style={styles.rowCopy}>
          <Text variant="bodyStrong">Signed in as</Text>
          <Text variant="caption" tone="textSecondary" style={styles.rowValue}>
            {me.emailMasked ?? me.phoneMasked}
          </Text>
        </View>
      </View>
      <View style={styles.accountActions}>
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        <Button label="Delete account" variant="quiet" onPress={() => setConfirmingDelete(true)} />
      </View>

      {__DEV__ && <ServiceStatus />}

      <BottomSheet
        visible={confirmingDelete}
        title="Delete your account?"
        onClose={() => setConfirmingDelete(false)}
      >
        <Text tone="textSecondary" style={styles.sheetBody}>
          Your profile, photos and preferences are removed straight away. This can’t be undone.
        </Text>
        <ErrorNotice
          message={deleteAccount.isError ? errorMessage(deleteAccount.error) : undefined}
        />
        <View style={styles.sheetActions}>
          <Button
            label="Delete everything"
            variant="danger"
            loading={deleteAccount.isPending}
            onPress={() => deleteAccount.mutate()}
          />
          <Button
            label="Keep my account"
            variant="quiet"
            onPress={() => setConfirmingDelete(false)}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: space.l, marginBottom: space.l },
  photo: { width: 132, aspectRatio: 0.8, borderRadius: radius.m, backgroundColor: color.surface },
  heroCopy: { flex: 1, justifyContent: 'flex-end', gap: space.xs },
  bio: { marginTop: space.s },
  section: { marginTop: space.xl, marginBottom: space.xs },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowCopy: { flex: 1, paddingRight: space.l },
  rowValue: { marginTop: space.xxs },
  accountActions: { marginTop: space.l, gap: space.s },
  sheetBody: { marginBottom: space.l },
  sheetActions: { gap: space.m },
});
