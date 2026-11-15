import { color, radius, space } from '@vyra/design-system';
import type { VaultItem } from '@vyra/validation';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { VideoMessage } from '@/features/messaging/media-views';
import { useRemoveFromVault, useVault } from '@/features/messaging/messaging-api';
import { errorMessage } from '@/lib/api';

/** Photos and videos you chose to keep. Only you can see them. */
export default function VaultScreen() {
  const vault = useVault();
  const remove = useRemoveFromVault();
  const [open, setOpen] = useState<VaultItem | null>(null);
  const items = vault.data?.items ?? [];

  return (
    <FormScreen
      eyebrow="Settings"
      title="Your vault"
      intro="Private copies of photos and videos — yours, or ones the sender let you keep. Nobody else can see them, and they’re deleted with your account."
    >
      {vault.isPending ? <ActivityIndicator color={color.textSecondary} /> : null}
      {vault.isError ? <ErrorNotice message={errorMessage(vault.error)} /> : null}
      {vault.data && items.length === 0 ? (
        <Text tone="textSecondary">
          Nothing saved yet. Long-press a photo or video in a conversation and choose “Save to your
          vault”.
        </Text>
      ) : null}
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            role="button"
            aria-label={`${item.kind === 'video' ? 'Video' : 'Photo'} saved ${new Date(item.createdAt).toLocaleDateString()}`}
            onPress={() => setOpen(item)}
            style={styles.tile}
          >
            <Image
              source={{ uri: item.thumbUrl ?? item.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {item.kind === 'video' ? (
              <Text variant="caption" style={styles.badge}>
                Video
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      <BottomSheet
        visible={open !== null}
        title={open?.kind === 'video' ? 'Video' : 'Photo'}
        onClose={() => setOpen(null)}
      >
        {open?.kind === 'video' ? (
          <VideoMessage
            url={open.url}
            posterUrl={open.thumbUrl}
            width={open.width}
            height={open.height}
            durationMs={open.durationMs}
            label="saved video"
          />
        ) : open ? (
          <Image
            source={{ uri: open.url }}
            style={[
              styles.full,
              { aspectRatio: open.width && open.height ? open.width / open.height : 1 },
            ]}
            contentFit="contain"
            accessibilityLabel="Saved photo"
          />
        ) : null}
        <ErrorNotice message={remove.isError ? errorMessage(remove.error) : undefined} />
        <Button
          label="Delete from vault"
          variant="danger"
          loading={remove.isPending}
          style={styles.delete}
          onPress={() => open && remove.mutate(open.id, { onSuccess: () => setOpen(null) })}
        />
      </BottomSheet>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  tile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.m,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  badge: {
    position: 'absolute',
    left: space.xs,
    bottom: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.s,
    backgroundColor: color.scrim,
    color: color.textPrimary,
  },
  full: { width: '100%', borderRadius: radius.m },
  delete: { marginTop: space.l },
});
