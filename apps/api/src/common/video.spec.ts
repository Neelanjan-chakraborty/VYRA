import { fitVideo, sniffVideo } from './video-transcode.js';
import { watermarkText } from './watermark.js';

describe('fitVideo', () => {
  it('fits landscape in 1280×720 and portrait in 720×1280, keeping even sizes', () => {
    expect(fitVideo(1920, 1080)).toEqual({ width: 1280, height: 720 });
    expect(fitVideo(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(fitVideo(4000, 3000)).toEqual({ width: 960, height: 720 });
  });

  it('never enlarges, and rounds odd sizes down to even', () => {
    expect(fitVideo(640, 360)).toEqual({ width: 640, height: 360 });
    expect(fitVideo(641, 361)).toEqual({ width: 640, height: 360 });
  });
});

describe('sniffVideo', () => {
  it('recognises MP4/MOV and WebM by their bytes, nothing else', () => {
    const mp4 = Buffer.alloc(16);
    mp4.write('ftypisom', 4, 'latin1');
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sniffVideo(mp4)).toBe(true);
    expect(sniffVideo(webm)).toBe(true);
    expect(sniffVideo(Buffer.from('just some text here'))).toBe(false);
    expect(sniffVideo(Buffer.alloc(4))).toBe(false);
  });
});

describe('watermarkText', () => {
  it('uses the first name and the date', () => {
    expect(watermarkText('Kabir Rao', new Date(Date.UTC(2026, 10, 15)))).toBe('Kabir · 15 Nov');
    expect(watermarkText('   ', new Date(Date.UTC(2026, 0, 2)))).toBe('Private · 2 Jan');
  });
});
