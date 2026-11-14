import type {
  PersonaAttributeKey,
  PersonaAttributeRecord,
  PersonaAttributeValue,
  PersonaEvidenceView,
} from '@vyra/validation';
import { type Candidate, CONFIDENCE_CAP } from './candidates.js';

export interface AttributeState {
  readonly record: PersonaAttributeRecord;
  readonly evidence: readonly PersonaEvidenceView[];
}
export type PersonaState = ReadonlyMap<PersonaAttributeKey, AttributeState>;

/** Scale answers further apart than this are treated as disagreeing. */
const SCALE_AGREEMENT = 0.25;

function agrees(a: PersonaAttributeValue, b: PersonaAttributeValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= SCALE_AGREEMENT;
  if (Array.isArray(a) && Array.isArray(b)) return a.some((item) => b.includes(item));
  return a === b;
}

function roundScale(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The person's own word is final: neither a model nor an assistant may override it. */
export function isLockedByPerson(record: PersonaAttributeRecord): boolean {
  return record.evidenceCategory === 'USER_STATED' || record.confirmation !== 'unreviewed';
}

interface Weighted {
  readonly value: PersonaAttributeValue;
  readonly confidence: number;
}

function resolve(
  weighted: readonly Weighted[],
  cap: number,
): { value: PersonaAttributeValue; confidence: number; needsReview: boolean } {
  const sorted = [...weighted].toSorted((a, b) => b.confidence - a.confidence);
  const strongest = sorted[0] as Weighted;
  const agreeing = sorted.filter((w) => agrees(w.value, strongest.value));
  const disagreeing = sorted.length - agreeing.length;

  let value: PersonaAttributeValue = strongest.value;
  if (typeof strongest.value === 'number') {
    const total = agreeing.reduce((sum, w) => sum + w.confidence, 0);
    value = roundScale(
      agreeing.reduce((sum, w) => sum + (w.value as number) * w.confidence, 0) / total,
    );
  } else if (Array.isArray(strongest.value)) {
    value = [...new Set(agreeing.flatMap((w) => w.value as string[]))].slice(0, 5);
  }
  // Independent sources that agree raise confidence a little; disagreement halves it.
  let confidence = Math.min(cap, strongest.confidence + 0.05 * (agreeing.length - 1));
  if (disagreeing > 0) confidence /= 2;
  return { value, confidence: Math.round(confidence * 100) / 100, needsReview: disagreeing > 0 };
}

/**
 * Merges new candidates into an existing persona state, deterministically.
 * - Attributes the person stated, confirmed or corrected are never changed.
 * - Agreeing sources are combined; disagreeing ones keep the stronger value at
 *   half confidence and flag the attribute for the person to review.
 * - Evidence accumulates so every value can be explained.
 */
export function combine(
  existing: PersonaState,
  candidates: readonly Candidate[],
  now: Date,
): Map<PersonaAttributeKey, AttributeState> {
  const result = new Map(existing);
  const byKey = new Map<PersonaAttributeKey, Candidate[]>();
  for (const candidate of candidates)
    byKey.set(candidate.key, [...(byKey.get(candidate.key) ?? []), candidate]);

  for (const [key, incoming] of byKey) {
    const current = existing.get(key);
    if (current && isLockedByPerson(current.record)) continue;

    const weighted: Weighted[] = incoming.map((c) => ({
      value: c.value,
      confidence: c.confidence,
    }));
    if (current)
      weighted.push({ value: current.record.value, confidence: current.record.confidence });
    const resolved = resolve(weighted, CONFIDENCE_CAP.INFERRED);
    const lead = incoming.toSorted((a, b) => b.confidence - a.confidence)[0] as Candidate;

    const evidence = [...(current?.evidence ?? [])];
    for (const c of incoming) {
      const entry: PersonaEvidenceView = {
        summary: c.summary,
        category: c.category,
        sourceType: c.sourceType,
        sourceDetail: c.sourceDetail,
      };
      if (
        !evidence.some(
          (e) =>
            e.summary === entry.summary &&
            e.sourceType === entry.sourceType &&
            e.sourceDetail === entry.sourceDetail,
        )
      ) {
        evidence.push(entry);
      }
    }

    result.set(key, {
      record: {
        value: resolved.value,
        confidence: resolved.confidence,
        evidenceCategory: 'INFERRED',
        sourceType: lead.sourceType,
        updatedAt: now.toISOString(),
        confirmation: 'unreviewed',
        needsReview: resolved.needsReview || (current?.record.needsReview ?? false),
      },
      evidence,
    });
  }
  return result;
}

/** The person sets a value themselves. */
export function stateFromPerson(value: PersonaAttributeValue, now: Date): AttributeState {
  return {
    record: {
      value,
      confidence: CONFIDENCE_CAP.USER_STATED,
      evidenceCategory: 'USER_STATED',
      sourceType: 'USER_CORRECTION',
      updatedAt: now.toISOString(),
      confirmation: 'corrected',
      needsReview: false,
    },
    evidence: [
      {
        summary: 'You set this.',
        category: 'USER_STATED',
        sourceType: 'USER_CORRECTION',
        sourceDetail: null,
      },
    ],
  };
}

/** The person confirms an inferred value is right. */
export function confirmState(state: AttributeState, now: Date): AttributeState {
  return {
    record: {
      ...state.record,
      confidence: CONFIDENCE_CAP.USER_STATED,
      evidenceCategory: 'USER_STATED',
      updatedAt: now.toISOString(),
      confirmation: 'confirmed',
      needsReview: false,
    },
    evidence: [
      ...state.evidence,
      {
        summary: 'You confirmed this.',
        category: 'USER_STATED',
        sourceType: 'USER_CORRECTION',
        sourceDetail: null,
      },
    ],
  };
}
