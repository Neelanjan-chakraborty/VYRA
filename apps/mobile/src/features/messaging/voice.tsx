import { color, MIN_TOUCH_TARGET, space } from '@vyra/design-system';
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
import { Text } from '@/components/text';
import { ChatIcon } from './chat-icons';
import type { PickedMedia } from './messaging-api';

export function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const SEGMENTS = 24;

/**
 * Play / pause for one voice note. The track is a time ruler rather than a
 * synthetic waveform: every segment is one equal slice of the recording, so
 * what it shows is real playback progress.
 */
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
  const [played, setPlayed] = useState(false);
  const total = durationMs ?? Math.round((status.duration || 0) * 1000);
  const elapsed = Math.round((status.currentTime || 0) * 1000);
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
  const filled = Math.round(progress * SEGMENTS);
  const tint = themeTint ?? (mine ? color.textOnAccent : color.textPrimary);

  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish, player]);

  function toggle() {
    setPlayed(true);
    if (status.playing) player.pause();
    else player.play();
  }

  return (
    <Pressable
      role="button"
      aria-label={`${status.playing ? 'Pause' : 'Play'} voice note, ${clock(total)}`}
      onPress={toggle}
      style={({ pressed }) => [styles.note, pressed && styles.pressed]}
    >
      <View style={[styles.playButton, { borderColor: tint }]} aria-hidden>
        <ChatIcon name={status.playing ? 'pause' : 'play'} color={tint} size={16} />
      </View>
      <View style={styles.body}>
        <View style={styles.ruler} aria-hidden>
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor: tint,
                  opacity: index < filled ? 1 : 0.26,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.legend}>
          <Text variant="caption" style={{ color: tint }}>
            {clock(status.playing ? elapsed : total)}
          </Text>
          {!mine && !played ? (
            <View style={styles.unplayed} aria-label="Not played yet">
              <View style={styles.unplayedDot} />
              <Text variant="caption" style={{ color: tint }}>
                New
              </Text>
            </View>
          ) : null}
        </View>
      </View>
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

export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: 196,
    paddingVertical: space.xxs,
  },
  pressed: { opacity: 0.82 },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: space.xs },
  ruler: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 16 },
  segment: { width: 3, height: 10, borderRadius: 1.5 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unplayed: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  unplayedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.chemistryText,
  },
});
