import sharp from 'sharp';
import { NsfwjsModerationProvider, verdictFromScores } from './nsfwjs-provider.js';
import { ManualModerationProvider } from './provider.js';

describe('moderation thresholds', () => {
  it.each([
    [{ Neutral: 0.9, Drawing: 0.1 }, 'approve', 'automated_pass'],
    [{ Porn: 0.6, Hentai: 0.3, Neutral: 0.1 }, 'reject', 'explicit_content'],
    [{ Porn: 0.3, Hentai: 0.15, Neutral: 0.55 }, 'review', 'possibly_explicit'],
    [{ Sexy: 0.75, Neutral: 0.25 }, 'review', 'possibly_suggestive'],
    [{ Sexy: 0.5, Neutral: 0.5 }, 'approve', 'automated_pass'],
  ])('%j → %s', (scores, verdict, reason) => {
    expect(verdictFromScores(scores)).toMatchObject({ verdict, reason });
  });

  it('manual mode sends everything to a person', async () => {
    expect(await new ManualModerationProvider().assess()).toEqual({
      verdict: 'review',
      reason: 'manual_review',
    });
  });
});

describe('nsfwjs provider (real model, offline)', () => {
  const provider = new NsfwjsModerationProvider();

  it('approves ordinary images', { timeout: 60_000 }, async () => {
    for (const background of ['#7a5c4d', '#20304a']) {
      const jpeg = await sharp({ create: { width: 600, height: 800, channels: 3, background } })
        .jpeg()
        .toBuffer();
      const result = await provider.assess(jpeg);
      expect(result.verdict).toBe('approve');
      expect(Object.keys(result.scores ?? {}).toSorted()).toEqual([
        'Drawing',
        'Hentai',
        'Neutral',
        'Porn',
        'Sexy',
      ]);
    }
  });

  it('never approves when it cannot read the image', { timeout: 60_000 }, async () => {
    expect(await provider.assess(Buffer.from('not an image'))).toEqual({
      verdict: 'review',
      reason: 'classifier_unavailable',
    });
  });
});
