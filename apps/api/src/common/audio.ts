/** What an uploaded voice note really is, judged from its bytes, not its name or declared type. */
export interface SniffedAudio {
  readonly container: 'mp4' | 'webm';
  /** From the file itself when the container records it (MP4 does; browser WebM often doesn't). */
  readonly durationMs: number | null;
}

const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

/** Walks MP4 boxes in [start, end) and returns the first child of the given type. */
function findBox(data: Buffer, start: number, end: number, type: string): [number, number] | null {
  let offset = start;
  while (offset + 8 <= end) {
    let size = data.readUInt32BE(offset);
    const boxType = data.toString('latin1', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) return null;
      const large = data.readBigUInt64BE(offset + 8);
      if (large > BigInt(end - offset)) return null;
      size = Number(large);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) return null;
    if (boxType === type) return [offset + header, offset + size];
    offset += size;
  }
  return null;
}

function mp4DurationMs(data: Buffer): number | null {
  const moov = findBox(data, 0, data.length, 'moov');
  const mvhd = moov ? findBox(data, moov[0], moov[1], 'mvhd') : null;
  if (!mvhd) return null;
  const [body, bodyEnd] = mvhd;
  const version = data.readUInt8(body);
  let timescale: number;
  let duration: number;
  if (version === 1) {
    if (body + 32 > bodyEnd) return null;
    timescale = data.readUInt32BE(body + 20);
    duration = Number(data.readBigUInt64BE(body + 24));
  } else {
    if (body + 20 > bodyEnd) return null;
    timescale = data.readUInt32BE(body + 12);
    duration = data.readUInt32BE(body + 16);
  }
  if (timescale === 0) return null;
  return Math.round((duration / timescale) * 1000);
}

/** Recognises M4A/MP4 (iOS, Android) and WebM (browsers). Anything else is null. */
export function sniffAudio(data: Buffer): SniffedAudio | null {
  if (data.length >= 12 && data.toString('latin1', 4, 8) === 'ftyp') {
    return { container: 'mp4', durationMs: mp4DurationMs(data) };
  }
  if (data.length >= 4 && WEBM_MAGIC.every((byte, i) => data[i] === byte)) {
    return { container: 'webm', durationMs: null };
  }
  return null;
}
