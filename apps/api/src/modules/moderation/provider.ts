export const PHOTO_MODERATION_PROVIDER = Symbol('PHOTO_MODERATION_PROVIDER');

export type ModerationVerdict = 'approve' | 'reject' | 'review';

export interface ModerationAssessment {
  readonly verdict: ModerationVerdict;
  /** Reason code stored on the photo, e.g. "explicit_content". Never free text. */
  readonly reason: string;
  /** Provider scores, kept for the moderation history only. */
  readonly scores?: Readonly<Record<string, number>>;
}

/** Automated first pass. Anything uncertain must come back as "review", never "approve". */
export interface PhotoModerationProvider {
  readonly id: string;
  assess(jpeg: Buffer): Promise<ModerationAssessment>;
}

/** Every photo waits for a person. */
export class ManualModerationProvider implements PhotoModerationProvider {
  readonly id = 'manual';
  async assess(): Promise<ModerationAssessment> {
    return { verdict: 'review', reason: 'manual_review' };
  }
}

/** Tests only: approves everything unless a test overrides it. Refused in production. */
export class MockModerationProvider implements PhotoModerationProvider {
  readonly id = 'mock';
  async assess(): Promise<ModerationAssessment> {
    return { verdict: 'approve', reason: 'mock_approved' };
  }
}
