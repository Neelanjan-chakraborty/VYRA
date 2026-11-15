import { color, MIN_TOUCH_TARGET, radius, space } from '@vyra/design-system';
import { VOICE_MAX_MS } from '@vyra/validation';
import {
  type RecordingOptions,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text } from '@/components/text';
import type { PickedMedia } from './messaging-api';

export function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Play / pause for one voice note, with elapsed and total time. */
export function VoiceNote({
  url,
  durationMs,
  mine,
  tint: themeTint,
}: {
  readonly url: string;
  readonly durationMs: number | null;
  readonly mine: boolean;
  /** Text colour of the bubble it sits in (chat themes). */
  readonly tint?: string;
}) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);
  const total = durationMs ?? Math.round((status.duration || 0) * 1000);
  const elapsed = Math.round((status.currentTime || 0) * 1000);
  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish, player]);
  const tint = themeTint ?? (mine ? color.textOnAccent : color.textPrimary);
  return (
    <Pressable
      role="button"
      aria-label={`${status.playing ? 'Pause' : 'Play'} voice note, ${clock(total)}`}
      onPress={() => (status.playing ? player.pause() : player.play())}
      style={styles.note}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        {status.playing ? (
          <>
            <Rect x={6} y={5} width={4} height={14} rx={1} fill={tint} />
            <Rect x={14} y={5} width={4} height={14} rx={1} fill={tint} />
          </>
        ) : (
          <Path d="M8 5.5v13l11-6.5z" fill={tint} />
        )}
      </Svg>
      <View style={[styles.track, { backgroundColor: color.border }]}>
        <View
          style={[
            styles.progress,
            {
              backgroundColor: tint,
              width: `${total > 0 ? Math.min(100, (elapsed / total) * 100) : 0}%`,
            },
          ]}
        />
      </View>
      <Text variant="caption" style={{ color: tint }}>
        {clock(status.playing ? elapsed : total)}
      </Text>
    </Pressable>
  );
}

/**
 * Speech doesn't need music quality: mono at 64 kbps (32 kbps WebM/Opus in
 * browsers) keeps uploads small. The server re-encodes to 24 kbps Opus anyway.
 */
const VOICE_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64_000,
  web: { mimeType: 'audio/webm', bitsPerSecond: 32_000 },
};

export interface Recording {
  readonly audio: PickedMedia;
  readonly durationMs: number;
}

/**
 * Records one voice note of up to a minute. The microphone is used only
 * between start and stop; permission is asked the first time.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [denied, setDenied] = useState(false);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setRecording(false);
    setElapsedMs(0);
  }, []);

  const stop = useCallback(async (): Promise<Recording | null> => {
    if (!startedAt.current) return null;
    const durationMs = Math.min(VOICE_MAX_MS, Date.now() - startedAt.current);
    startedAt.current = 0;
    clear();
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri || durationMs < 500) return null;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      return { audio: { uri, file: blob, mimeType: blob.type || 'audio/webm' }, durationMs };
    }
    return { audio: { uri, mimeType: 'audio/mp4' }, durationMs };
  }, [recorder, clear]);

  const start = useCallback(async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setDenied(true);
      return false;
    }
    setDenied(false);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setRecording(true);
    ticker.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setElapsedMs(elapsed);
    }, 250);
    return true;
  }, [recorder]);

  const cancel = useCallback(async () => {
    startedAt.current = 0;
    clear();
    await recorder.stop().catch(() => undefined);
  }, [recorder, clear]);

  useEffect(
    () => () => {
      if (ticker.current) clearInterval(ticker.current);
    },
    [],
  );

  return { start, stop, cancel, recording, elapsedMs, denied, atLimit: elapsedMs >= VOICE_MAX_MS };
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: 180,
  },
  track: { flex: 1, height: 3, borderRadius: radius.s, overflow: 'hidden' },
  progress: { height: 3 },
});
