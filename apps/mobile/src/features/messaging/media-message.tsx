import { color, radius, space } from '@vyra/design-system';
import type { MessageMedia } from '@vyra/validation';
import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/text';
import { ChatIcon } from './chat-icons';

interface MediaMessageProps {
  readonly media: MessageMedia;
  readonly mine: boolean;
  readonly otherName: string;
  readonly tint: string;
}

/** A photo in the conversation, with the states the API actually has. */
export function MediaMessage({ media, mine, otherName, tint }: MediaMessageProps) {
  const window = useWindowDimensions();
  // Leave room for the list gutter and, for incoming messages, the avatar column.
  const width = Math.min(268, window.width - 112);
  const ratio = media.width && media.height ? media.width / media.height : 0.8;
  const ready = media.status === 'ready';

  return (
    <View style={styles.frame}>
      <View style={[styles.stage, { width, aspectRatio: ratio }]}>
        {media.url ? (
          <Image
            source={{ uri: media.thumbUrl ?? media.url }}
            style={[StyleSheet.absoluteFill, !ready && styles.checking]}
            contentFit="cover"
            transition={180}
            accessibilityLabel={mine ? 'Photo you sent' : `Photo from ${otherName}`}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <ChatIcon name="image" color={color.textDisabled} size={28} />
          </View>
        )}
        {!ready ? (
          <View
            style={[StyleSheet.absoluteFill, styles.stateScrim]}
            aria-label={
              media.status === 'checking' ? 'Photo being checked' : 'Photo could not be sent'
            }
          >
            <ChatIcon
              name={media.status === 'checking' ? 'clock' : 'flag'}
              color={color.textPrimary}
              size={20}
            />
            <Text variant="captionStrong" style={styles.stateLabel}>
              {media.status === 'checking' ? 'Photo being checked' : 'Could not be sent'}
            </Text>
          </View>
        ) : null}
      </View>

      {ready ? (
        <View style={styles.privacy} aria-label="Shared only in this conversation">
          <ChatIcon name="lock" color={color.textSecondary} size={12} />
          <Text variant="caption" tone="textSecondary">
            Private to this chat
          </Text>
        </View>
      ) : (
        <Text variant="caption" style={[styles.note, { color: tint }]}>
          {media.status === 'checking'
            ? 'It appears for both of you once a quick safety check clears.'
            : 'This photo couldn’t be sent. Try another.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { gap: space.xs },
  stage: {
    borderRadius: radius.m,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  checking: { opacity: 0.45 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  stateScrim: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: color.scrim,
    padding: space.m,
  },
  stateLabel: { color: color.textPrimary, textAlign: 'center' },
  note: { paddingHorizontal: space.xs, paddingTop: space.xxs },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    paddingHorizontal: space.xs,
    paddingTop: space.xxs,
  },
});
