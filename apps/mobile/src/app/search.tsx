import { color, MIN_TOUCH_TARGET, radius, space, typography } from '@vyra/design-system';
import type { SearchResult } from '@vyra/validation';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon } from '@/components/tab-icons';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { PersonAvatar } from '@/features/discovery/person-avatar';
import { useMe } from '@/features/profile/profile-api';
import { useDebounced, useSearchPeople } from '@/features/search/search-api';
import { errorMessage } from '@/lib/api';
import { noBrowserFocusRing } from '@/lib/web-style';

const RELATION_WORDS: Readonly<Record<SearchResult['relation'], string | null>> = {
  none: null,
  connected: 'Connected',
  pending: 'Request pending',
};

function ResultRow({ result }: { result: SearchResult }) {
  const router = useRouter();
  const meta = [result.age, result.city].filter(Boolean).join(' · ');
  const relation = RELATION_WORDS[result.relation];
  return (
    <Pressable
      role="link"
      aria-label={`${result.displayName}${result.username ? `, @${result.username}` : ''}. View profile`}
      onPress={() => router.push(`/person/${result.userId}`)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <PersonAvatar name={result.displayName} photoUrl={result.photoUrl} size={48} round />
      <View style={styles.rowCopy}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {result.displayName}
        </Text>
        {result.username ? (
          <Text variant="caption" tone="textSecondary" numberOfLines={1}>
            @{result.username}
          </Text>
        ) : null}
        <Text variant="caption" tone="textSecondary" numberOfLines={1}>
          {[meta, relation].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

/** Find people by username or name. Only people a profile view would also show. */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe().data;
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 250);
  const search = useSearchPeople(query);
  const typing = text.trim() !== query;
  const results = query.length >= 2 ? (search.data?.results ?? []) : [];
  const needsUsername = me?.profile && me.profile.username === null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
        <Pressable
          role="button"
          aria-label="Back"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.icon}
        >
          <BackChevron />
        </Pressable>
        <View style={styles.field}>
          <TabIcon name="search" color={color.textSecondary} size={20} />
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            placeholder="Search by username or name"
            placeholderTextColor={color.textDisabled}
            selectionColor={color.accent}
            maxLength={40}
            aria-label="Search people"
            style={[styles.input, noBrowserFocusRing]}
          />
          {text.length > 0 ? (
            <Pressable
              role="button"
              aria-label="Clear search"
              onPress={() => setText('')}
              hitSlop={10}
            >
              <Text tone="textSecondary">Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space.xxl }]}
      >
        {needsUsername ? (
          <View style={styles.notice} role="note">
            <Text variant="bodyStrong">Choose a username</Text>
            <Text variant="caption" tone="textSecondary">
              People can search for you by name now. A username makes you easy to find and share.
            </Text>
            <Button
              label="Choose a username"
              variant="quiet"
              onPress={() => router.push('/settings/username')}
              style={styles.noticeAction}
            />
          </View>
        ) : null}

        {query.length < 2 && text.trim().length < 2 ? (
          <Text tone="textSecondary" style={styles.hint}>
            Type at least two letters. You can search a username like @asha.rao or a first name.
          </Text>
        ) : null}

        {search.isError && query.length >= 2 ? (
          <View style={styles.state}>
            <ErrorNotice message={errorMessage(search.error)} />
            <Button label="Try again" variant="secondary" onPress={() => void search.refetch()} />
          </View>
        ) : null}

        {(search.isFetching || typing) && results.length === 0 && query.length >= 2 ? (
          <ActivityIndicator color={color.textSecondary} style={styles.spinner} />
        ) : null}

        {!search.isError &&
        !search.isFetching &&
        !typing &&
        query.length >= 2 &&
        results.length === 0 ? (
          <View style={styles.state}>
            <Text variant="bodyStrong">No one found for “{query}”.</Text>
            <Text variant="caption" tone="textSecondary">
              Check the spelling. People who have hidden from discovery, or who you’ve blocked,
              don’t appear.
            </Text>
          </View>
        ) : null}

        {results.map((result) => (
          <ResultRow key={result.userId} result={result} />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BackChevron() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M14.5 5.5L8 12l6.5 6.5"
        stroke={color.textPrimary}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.l,
    paddingBottom: space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  icon: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, justifyContent: 'center' },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space.m,
    backgroundColor: color.surface,
    borderRadius: radius.m,
  },
  input: { flex: 1, ...typography.body, color: color.textPrimary, paddingVertical: space.s },
  list: { paddingHorizontal: space.l, paddingTop: space.m, gap: space.xs },
  hint: { paddingVertical: space.l },
  spinner: { paddingVertical: space.xl },
  state: { paddingVertical: space.l, gap: space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.m,
    minHeight: MIN_TOUCH_TARGET,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowPressed: { backgroundColor: color.surface },
  rowCopy: { flex: 1, gap: 2 },
  notice: {
    padding: space.l,
    gap: space.xs,
    borderRadius: radius.m,
    backgroundColor: color.surface,
    marginBottom: space.m,
  },
  noticeAction: { alignSelf: 'flex-start' },
});
