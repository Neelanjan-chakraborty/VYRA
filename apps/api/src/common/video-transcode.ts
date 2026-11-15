import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { VIDEO_MAX_MS } from '@vyra/validation';

const run = promisify(execFile);

/** Long edge 1280, short edge 720 at most: plenty on a phone, small to send. */
const MAX_LONG = 1280;
const MAX_SHORT = 720;
/** Frames sampled for the image classifier; every one must pass. */
export const MODERATION_FRAMES = 5;
const TIMEOUT_MS = 120_000;

export class VideoTranscodeError extends Error {}

export interface TranscodedVideo {
  /** H.264 + AAC in MP4, moov atom first so playback starts before the download ends. */
  readonly mp4: Buffer;
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  /** A PNG frame from the start, for the poster and preview. */
  readonly poster: Buffer;
  /** PNG frames spread over the clip, for moderation. */
  readonly frames: readonly Buffer[];
}

/** MP4/MOV ("ftyp" box) or WebM/Matroska (EBML header), judged by the bytes. */
export function sniffVideo(data: Buffer): boolean {
  if (data.length < 12) return false;
  if (data.subarray(4, 8).toString('latin1') === 'ftyp') return true;
  return data.readUInt32BE(0) === 0x1a45dfa3;
}

/** Output size: fits in 1280×720 (either orientation), even numbers for H.264. */
export function fitVideo(width: number, height: number): { width: number; height: number } {
  const landscape = width >= height;
  const [maxW, maxH] = landscape ? [MAX_LONG, MAX_SHORT] : [MAX_SHORT, MAX_LONG];
  const scale = Math.min(1, maxW / width, maxH / height);
  const even = (n: number) => Math.max(2, Math.floor((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

interface Probe {
  streams?: {
    codec_type?: string;
    width?: number;
    height?: number;
    tags?: { rotate?: string };
    side_data_list?: { rotation?: number }[];
  }[];
  format?: { duration?: string };
}

/**
 * Re-encodes an uploaded clip. ffmpeg runs with fixed arguments (never a
 * shell), in a private temporary directory that is always removed, with a time
 * limit; metadata (including location) is dropped. With `overlay`, a PNG the
 * size of the output is burned into every frame (the recipient watermark).
 */
export async function transcodeVideo(
  input: Buffer,
  binaries: { ffmpeg: string; ffprobe: string },
  overlay?: (width: number, height: number) => Promise<Buffer>,
): Promise<TranscodedVideo> {
  const dir = await mkdtemp(join(tmpdir(), 'vyra-video-'));
  const source = join(dir, 'input');
  const output = join(dir, 'video.mp4');
  const options = { timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, windowsHide: true };
  const quiet = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y'];
  try {
    await writeFile(source, input, { mode: 0o600 });
    const probe = JSON.parse(
      (
        await run(
          binaries.ffprobe,
          ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source],
          options,
        )
      ).stdout,
    ) as Probe;
    const stream = probe.streams?.find((s) => s.codec_type === 'video');
    const seconds = Number.parseFloat(probe.format?.duration ?? '');
    if (!stream?.width || !stream.height || !Number.isFinite(seconds) || seconds <= 0)
      throw new VideoTranscodeError('no video');
    if (seconds * 1000 > VIDEO_MAX_MS + 500) throw new VideoTranscodeError('too long');
    // Phones record sideways and say so in metadata; ffmpeg turns the picture upright.
    const rotation = Math.abs(
      Number(stream.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) ||
        Number(stream.tags?.rotate ?? 0),
    );
    const sideways = rotation % 180 === 90;
    const size = fitVideo(
      sideways ? stream.height : stream.width,
      sideways ? stream.width : stream.height,
    );
    const filters = [`scale=${size.width}:${size.height}`, 'fps=30'];
    const args = [...quiet, '-i', source];
    let graph = `[0:v:0]${filters.join(',')}[v]`;
    if (overlay) {
      const mark = join(dir, 'mark.png');
      await writeFile(mark, await overlay(size.width, size.height), { mode: 0o600 });
      args.push('-i', mark);
      graph = `[0:v:0]${filters.join(',')}[base];[base][1:v]overlay=0:0[v]`;
    }
    args.push(
      '-filter_complex',
      graph,
      '-map',
      '[v]',
      '-map',
      '0:a:0?',
      '-map_metadata',
      '-1',
      '-sn',
      '-dn',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '28',
      '-pix_fmt',
      'yuv420p',
      '-profile:v',
      'high',
      '-c:a',
      'aac',
      '-b:a',
      '64k',
      '-ac',
      '1',
      '-movflags',
      '+faststart',
      '-t',
      String(VIDEO_MAX_MS / 1000),
      output,
    );
    await run(binaries.ffmpeg, args, options);

    const duration = Math.min(seconds, VIDEO_MAX_MS / 1000);
    const frameAt = async (at: number, name: string) => {
      const file = join(dir, name);
      await run(
        binaries.ffmpeg,
        [...quiet, '-ss', at.toFixed(2), '-i', output, '-frames:v', '1', '-f', 'image2', file],
        options,
      );
      return readFile(file);
    };
    const frames: Buffer[] = [];
    for (let i = 0; i < MODERATION_FRAMES; i += 1)
      frames.push(await frameAt((duration * (i + 0.5)) / MODERATION_FRAMES, `frame${i}.png`));
    return {
      mp4: await readFile(output),
      durationMs: Math.max(1, Math.round(duration * 1000)),
      width: size.width,
      height: size.height,
      poster: await frameAt(Math.min(0.5, duration / 2), 'poster.png'),
      frames,
    };
  } catch (error) {
    if (error instanceof VideoTranscodeError) throw error;
    throw new VideoTranscodeError('unreadable video');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
