import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** 24 kbps mono Opus tuned for speech: about 180 KB per minute. */
export const VOICE_BITRATE = '24k';
const TIMEOUT_MS = 20_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

export interface TranscodedVoice {
  /** Ogg Opus: Android, browsers. */
  readonly ogg: Buffer;
  /** The same Opus stream in CAF (no re-encode): iOS's native player. */
  readonly caf: Buffer;
  /** Measured from the transcoded file, not trusted from the client. */
  readonly durationMs: number;
}

export class AudioTranscodeError extends Error {}

/**
 * Re-encodes an uploaded voice note to speech-tuned Opus. ffmpeg runs with
 * fixed arguments (never a shell), on files in a private temporary directory
 * that is always removed, with a time limit. Anything that isn't readable
 * audio fails cleanly.
 */
export async function transcodeVoice(
  input: Buffer,
  binaries: { ffmpeg: string; ffprobe: string },
): Promise<TranscodedVoice> {
  const dir = await mkdtemp(join(tmpdir(), 'vyra-voice-'));
  const source = join(dir, 'input');
  const ogg = join(dir, 'voice.ogg');
  const caf = join(dir, 'voice.caf');
  const options = { timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true };
  try {
    await writeFile(source, input, { mode: 0o600 });
    await run(
      binaries.ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-y',
        '-i',
        source,
        '-map',
        '0:a:0',
        '-vn',
        '-sn',
        '-dn',
        '-map_metadata',
        '-1',
        '-ac',
        '1',
        '-ar',
        '48000',
        '-c:a',
        'libopus',
        '-b:a',
        VOICE_BITRATE,
        '-application',
        'voip',
        '-t',
        '61',
        ogg,
      ],
      options,
    );
    const { stdout } = await run(
      binaries.ffprobe,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ogg],
      options,
    );
    const seconds = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) throw new AudioTranscodeError('no audio');
    await run(
      binaries.ffmpeg,
      ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', ogg, '-c:a', 'copy', caf],
      options,
    );
    return {
      ogg: await readFile(ogg),
      caf: await readFile(caf),
      durationMs: Math.round(seconds * 1000),
    };
  } catch (error) {
    if (error instanceof AudioTranscodeError) throw error;
    throw new AudioTranscodeError('unreadable audio');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
