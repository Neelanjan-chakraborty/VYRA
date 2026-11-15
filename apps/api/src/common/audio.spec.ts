import { sniffAudio } from './audio.js';

function box(type: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, body]);
}

function mvhd(version: 0 | 1, timescale: number, duration: number): Buffer {
  const body = Buffer.alloc(version === 1 ? 112 : 100);
  body.writeUInt8(version, 0);
  if (version === 1) {
    body.writeUInt32BE(timescale, 20);
    body.writeBigUInt64BE(BigInt(duration), 24);
  } else {
    body.writeUInt32BE(timescale, 12);
    body.writeUInt32BE(duration, 16);
  }
  return box('mvhd', body);
}

const ftyp = box('ftyp', Buffer.from('M4A \0\0\0\0', 'latin1'));

describe('sniffAudio', () => {
  it('reads the duration of an M4A from its mvhd box (version 0 and 1)', () => {
    const v0 = Buffer.concat([
      ftyp,
      box('free', Buffer.alloc(10)),
      box('moov', mvhd(0, 44_100, 44_100 * 7)),
    ]);
    expect(sniffAudio(v0)).toEqual({ container: 'mp4', durationMs: 7000 });
    const v1 = Buffer.concat([ftyp, box('moov', mvhd(1, 1000, 59_000))]);
    expect(sniffAudio(v1)).toEqual({ container: 'mp4', durationMs: 59_000 });
  });

  it('recognises WebM without a duration', () => {
    expect(sniffAudio(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toEqual({
      container: 'webm',
      durationMs: null,
    });
  });

  it('refuses anything else and survives truncated or lying box sizes', () => {
    expect(sniffAudio(Buffer.from('ID3 pretend mp3 file'))).toBeNull();
    expect(sniffAudio(Buffer.alloc(3))).toBeNull();
    const lying = Buffer.concat([ftyp, Buffer.from([0xff, 0xff, 0xff, 0xff]), Buffer.from('moov')]);
    expect(sniffAudio(lying)).toEqual({ container: 'mp4', durationMs: null });
  });
});
