import { Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import { load, type NSFWJS } from 'nsfwjs';
import sharp from 'sharp';
import type { ModerationAssessment, PhotoModerationProvider } from './provider.js';

/** Thresholds over nsfwjs class probabilities. See docs/SECURITY_AND_PRIVACY.md. */
export const NSFW_THRESHOLDS = {
  /** Porn + Hentai at or above this is rejected automatically. */
  reject: 0.85,
  /** Porn + Hentai at or above this goes to a person. */
  reviewExplicit: 0.4,
  /** "Sexy" at or above this goes to a person. */
  reviewSuggestive: 0.7,
} as const;

/** Turns class probabilities into a verdict. Pure, so the rules are unit-tested directly. */
export function verdictFromScores(scores: Readonly<Record<string, number>>): ModerationAssessment {
  const explicit = (scores.Porn ?? 0) + (scores.Hentai ?? 0);
  const suggestive = scores.Sexy ?? 0;
  if (explicit >= NSFW_THRESHOLDS.reject)
    return { verdict: 'reject', reason: 'explicit_content', scores };
  if (explicit >= NSFW_THRESHOLDS.reviewExplicit)
    return { verdict: 'review', reason: 'possibly_explicit', scores };
  if (suggestive >= NSFW_THRESHOLDS.reviewSuggestive)
    return { verdict: 'review', reason: 'possibly_suggestive', scores };
  return { verdict: 'approve', reason: 'automated_pass', scores };
}

/**
 * Open-source, offline classifier (nsfwjs, MIT; MobileNetV2 model bundled in
 * the package). It detects nudity and sexual content only — not violence,
 * minors, impersonation or text — so reports and human review remain
 * essential. Runs on the pure-JS TensorFlow backend: ~1–2 s per photo, which
 * is why it runs in a queue worker.
 */
export class NsfwjsModerationProvider implements PhotoModerationProvider {
  readonly id = 'nsfwjs:mobilenet_v2';
  private readonly logger = new Logger(NsfwjsModerationProvider.name);
  private model: Promise<NSFWJS> | null = null;

  private loadModel(): Promise<NSFWJS> {
    this.model ??= load('MobileNetV2').catch((error: unknown) => {
      this.model = null;
      throw error;
    });
    return this.model;
  }

  async assess(jpeg: Buffer): Promise<ModerationAssessment> {
    try {
      const model = await this.loadModel();
      const { data, info } = await sharp(jpeg)
        .resize(224, 224, { fit: 'cover' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
      try {
        const predictions = await model.classify(tensor, 5);
        const scores = Object.fromEntries(
          predictions.map((p) => [p.className, Math.round(p.probability * 1000) / 1000]),
        );
        return verdictFromScores(scores);
      } finally {
        tensor.dispose();
      }
    } catch (error) {
      // A classifier failure is never an approval.
      this.logger.error(
        'Photo classifier failed',
        error instanceof Error ? error.stack : undefined,
      );
      return { verdict: 'review', reason: 'classifier_unavailable' };
    }
  }
}
