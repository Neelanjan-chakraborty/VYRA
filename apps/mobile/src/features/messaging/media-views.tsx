import { color, MIN_TOUCH_TARGET, radius, space } from '@vyra/design-system';
import type { MessageView } from '@vyra/validation';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { clock } from './voice';

const KIND_WORD: Readonly<Record<string, string>> = {
  image: 'a photo',
  video: 'a video',
  voice: 'a voice note',
};

/** "10 s", "1 min", "1 h", "24 h" for timer choices. */
export function timerLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

/** "Disappears in 3 h" style countdown text, or null once past. */
export function remaining(expiresAt: string | null, now = Date.now()): string | null {
  if (!expiresAt) return null;
  const left = Date.parse(expiresAt) - now;
  if (left <= 0) return null;
  if (left < 60_000) return `${Math.ceil(left / 1000)} s`;
  if (left < 3_600_000) return `${Math.ceil(left / 60_000)} min`;
  if (left < 86_400_000) return `${Math.ceil(left / 3_600_000)} h`;
  return `${Math.ceil(left / 86_400_000)} d`;
}

/** Ticks once a second while something is counting down. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Media from someone the viewer hasn't allowed yet: no picture, just what it
 * is. (The sender still sees their own media, with a note under it.)
 */
export function HeldMedia({
  message,
  otherName,
  onAllow,
}: {
  readonly message: MessageView;
  readonly otherName: string;
  readonly onAllow: (() => void) | null;
}) {
  const what = KIND_WORD[message.kind] ?? 'something';
  return (
    <View style={styles.held}>
      <Text>
        {otherName} sent {what}.
      </Text>
      <Text variant="caption" tone="textSecondary">
        Photos, videos and voice notes from {otherName} stay hidden until you allow them.
      </Text>
      {onAllow ? (
        <Button label={`Allow media from ${otherName}`} variant="secondary" onPress={onAllow} />
      ) : null}
    </View>
  );
}

/**
 * The blurred stand-in for protected or sensitive media. `label` says what a
 * tap does ("View once", "Tap to view").
 */
export function BlurredMedia({
  message,
  label,
  onPress,
}: {
  readonly message: MessageView;
  readonly label: string;
  readonly onPress: (() => void) | null;
}) {
  const media = message.media;
  const ratio = media?.width && media.height ? media.width / media.height : 0.8;
  return (
    <Pressable
      role="button"
      aria-label={label}
      disabled={!onPress}
      onPress={onPress ?? undefined}
      style={[styles.frame, { aspectRatio: message.kind === 'voice' ? undefined : ratio }]}
    >
      {media?.previewUrl ? (
        <Image
          draggable={false}
          source={{ uri: media.previewUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={24}
          cachePolicy="none"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.veil}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"
            stroke={color.textPrimary}
            strokeWidth={1.5}
            fill="none"
          />
          <Path
            d="M12 9.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 0 1 0-5.6z"
            stroke={color.textPrimary}
            strokeWidth={1.5}
            fill="none"
          />
        </Svg>
        <Text variant="bodyStrong">{label}</Text>
      </View>
    </Pressable>
  );
}

/** A video: poster first; the player loads only when someone presses play. */
export function VideoMessage({
  url,
  posterUrl,
  width,
  height,
  durationMs,
  label,
  autoPlay = false,
  cache = true,
}: {
  readonly url: string;
  readonly posterUrl: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationMs: number | null;
  readonly label: string;
  readonly autoPlay?: boolean;
  /** Protected media is never written to the disk cache. */
  readonly cache?: boolean;
}) {
  const [playing, setPlaying] = useState(autoPlay);
  const ratio = width && height ? width / height : 16 / 9;
  if (!playing)
    return (
      <Pressable
        role="button"
        aria-label={`Play ${label}${durationMs ? `, ${clock(durationMs)}` : ''}`}
        onPress={() => setPlaying(true)}
        style={[styles.frame, { aspectRatio: ratio }]}
      >
        {posterUrl ? (
          <Image
            draggable={false}
            source={{ uri: posterUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy={cache ? 'memory-disk' : 'none'}
          />
        ) : null}
        <View style={styles.play}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path d="M8 5.5v13l11-6.5z" fill={color.textPrimary} />
          </Svg>
        </View>
        {durationMs ? (
          <Text variant="caption" style={styles.duration}>
            {clock(durationMs)}
          </Text>
        ) : null}
      </Pressable>
    );
  return <Player url={url} ratio={ratio} />;
}

function Player({ url, ratio }: { readonly url: string; readonly ratio: number }) {
  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      allowsPictureInPicture={false}
      style={[styles.frame, { aspectRatio: ratio }]}
    />
  );
}

const styles = StyleSheet.create({
  held: { gap: space.s, paddingVertical: space.xs, maxWidth: 260 },
  frame: {
    width: 240,
    minHeight: MIN_TOUCH_TARGET * 2,
    borderRadius: radius.m,
    overflow: 'hidden',
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  veil: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
    borderRadius: radius.l,
    backgroundColor: color.scrim,
  },
  play: {
    width: MIN_TOUCH_TARGET + space.s,
    height: MIN_TOUCH_TARGET + space.s,
    borderRadius: (MIN_TOUCH_TARGET + space.s) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.scrim,
  },
  duration: {
    position: 'absolute',
    right: space.s,
    bottom: space.s,
    color: color.textPrimary,
  },
});
