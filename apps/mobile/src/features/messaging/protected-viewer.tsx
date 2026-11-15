import { color, space } from '@vyra/design-system';
import type { MessageView } from '@vyra/validation';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/notice';
import { errorMessage } from '@/lib/api';
import { remaining, useNow, VideoMessage } from './media-views';
import { VoiceNote } from './voice';

/**
 * Shows view-once or timed media after "open". Nothing is cached to disk, and
 * a view-once item is erased as soon as this closes. A timed item closes by
 * itself when its time is up.
 */
export function ProtectedViewer({
  message,
  loading,
  error,
  otherName,
  onClose,
}: {
  /** The opened message (with one-minute URLs), or null while closed. */
  readonly message: MessageView | null;
  readonly loading: boolean;
  readonly error: unknown;
  readonly otherName: string;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const visible = message !== null || loading || Boolean(error);
  const now = useNow(visible && Boolean(message?.expiresAt));
  const left = message ? remaining(message.expiresAt, now) : null;
  useEffect(() => {
    if (message?.expiresAt && !left) onClose();
  }, [message?.expiresAt, left, onClose]);

  const media = message?.media;
  let content = null;
  if (message && media?.url) {
    if (message.kind === 'image')
      content = (
        <Image
          draggable={false}
          source={{ uri: media.url }}
          style={styles.image}
          contentFit="contain"
          cachePolicy="none"
          accessibilityLabel={`Photo from ${otherName}`}
        />
      );
    else if (message.kind === 'video')
      content = (
        <VideoMessage
          url={media.url}
          posterUrl={media.posterUrl}
          width={media.width}
          height={media.height}
          durationMs={media.durationMs}
          label={`video from ${otherName}`}
          autoPlay
          cache={false}
        />
      );
    else if (message.kind === 'voice')
      content = (
        <VoiceNote
          url={Platform.OS === 'ios' && media.altUrl ? media.altUrl : media.url}
          durationMs={media.durationMs}
          mine={false}
        />
      );
  }

  return (
    <Modal visible={visible} animationType="none" onRequestClose={onClose} transparent>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + space.m, paddingBottom: insets.bottom + space.m },
        ]}
        aria-label={message?.viewOnce ? 'View once' : 'Timed'}
      >
        <View style={styles.header}>
          <Text variant="eyebrow" tone="chemistryText">
            {message?.viewOnce ? 'View once' : left ? `Disappears in ${left}` : ' '}
          </Text>
          <Button label="Close" variant="quiet" onPress={onClose} />
        </View>
        <View style={styles.stage}>
          {loading ? <ActivityIndicator color={color.textSecondary} /> : content}
          {error ? <ErrorNotice message={errorMessage(error)} /> : null}
        </View>
        {message?.viewOnce ? (
          <Text variant="caption" tone="textSecondary" style={styles.note}>
            This is removed for both of you when you close it.
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background, paddingHorizontal: space.l },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.m },
  image: { width: '100%', height: '100%' },
  note: { textAlign: 'center' },
});
