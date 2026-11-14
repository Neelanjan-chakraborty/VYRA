import {
  type AssistantId,
  attributeValueSchema,
  type EvidenceCategory,
  type EvidenceSourceType,
  isPersonaAttributeKey,
  PERSONA_ATTRIBUTES,
  type PersonaAttributeKey,
  type PersonaAttributeValue,
} from '@vyra/validation';
import { z } from 'zod';
import type { PersonaSourceBundle, SourceItem } from '../ai/ai-provider.js';
import { safeSummary } from '../ai/redact.js';

/** One source's proposal for one attribute, before merging. */
export interface Candidate {
  readonly key: PersonaAttributeKey;
  readonly value: PersonaAttributeValue;
  readonly confidence: number;
  readonly category: EvidenceCategory;
  readonly sourceType: EvidenceSourceType;
  readonly sourceDetail: string | null;
  readonly summary: string;
}

/** Highest confidence each kind of evidence can reach. */
export const CONFIDENCE_CAP: Readonly<Record<EvidenceCategory, number>> = {
  USER_STATED: 0.95,
  OBSERVED: 0.8,
  INFERRED: 0.6,
};

/** More independent pieces of evidence raise confidence, up to the category cap. */
export function confidenceFor(category: EvidenceCategory, evidenceCount: number): number {
  const factor = 0.6 + (0.4 * Math.min(evidenceCount, 3)) / 3;
  return Math.round(CONFIDENCE_CAP[category] * factor * 100) / 100;
}

function sourceTypeOf(item: SourceItem): EvidenceSourceType {
  return item.kind === 'interest' ? 'INTEREST_SELECTION' : 'PROFILE';
}

const proposalSchema = z.object({
  value: z.unknown(),
  rationale: z.string().max(400).default(''),
  evidenceRefs: z.array(z.string().max(120)).max(20),
});

export interface ParsedModelOutput {
  readonly candidates: Candidate[];
  /** Attribute keys dropped, with the reason. Logged as codes only. */
  readonly dropped: { key: string; reason: string }[];
}

/**
 * Reads a provider's untrusted output. Only catalogue attributes with a valid
 * value and at least one real piece of evidence survive; everything else is
 * dropped rather than repaired.
 */
export function candidatesFromModel(
  raw: unknown,
  bundle: PersonaSourceBundle,
): ParsedModelOutput | null {
  if (typeof raw !== 'object' || raw === null || !('attributes' in raw)) return null;
  const { attributes } = raw as { attributes: unknown };
  if (typeof attributes !== 'object' || attributes === null || Array.isArray(attributes))
    return null;

  const items = new Map(bundle.items.map((item) => [item.ref, item]));
  const candidates: Candidate[] = [];
  const dropped: { key: string; reason: string }[] = [];

  for (const [key, proposalRaw] of Object.entries(attributes)) {
    if (!isPersonaAttributeKey(key)) {
      dropped.push({ key: key.slice(0, 40), reason: 'not_in_catalogue' });
      continue;
    }
    const definition = PERSONA_ATTRIBUTES[key];
    if (definition.kind === 'list' && definition.userStatedOnly) {
      dropped.push({ key, reason: 'user_stated_only' });
      continue;
    }
    const proposal = proposalSchema.safeParse(proposalRaw);
    const value = proposal.success
      ? attributeValueSchema(key).safeParse(proposal.data.value)
      : null;
    if (!proposal.success || !value?.success) {
      dropped.push({ key, reason: 'invalid_value' });
      continue;
    }
    const evidence = [...new Set(proposal.data.evidenceRefs)].flatMap((ref) => {
      const item = items.get(ref);
      return item ? [item] : [];
    });
    if (evidence.length === 0) {
      // A claim with no evidence that exists in what the person gave us is not kept.
      dropped.push({ key, reason: 'no_evidence' });
      continue;
    }
    candidates.push({
      key,
      value: value.data as PersonaAttributeValue,
      confidence: confidenceFor('INFERRED', evidence.length),
      category: 'INFERRED',
      sourceType: sourceTypeOf(evidence[0] as SourceItem),
      sourceDetail: null,
      summary: safeSummary(
        proposal.data.rationale,
        `Based on your ${evidence.map((e) => e.label.toLowerCase()).join(', ')}`,
      ),
    });
  }
  return { candidates, dropped };
}

const REFLECTION_CONFIDENCE = { low: 0.3, medium: 0.45, high: 0.6 } as const;

/** Turns a parsed assistant reply into candidates. Another AI's view is an inference. */
export function candidatesFromReflection(
  answers: ReadonlyMap<
    PersonaAttributeKey,
    { value: PersonaAttributeValue; confidence: keyof typeof REFLECTION_CONFIDENCE; why: string }
  >,
  assistant: AssistantId,
  assistantName: string,
): Candidate[] {
  return [...answers].map(([key, answer]) => ({
    key,
    value: answer.value,
    confidence: Math.min(REFLECTION_CONFIDENCE[answer.confidence], CONFIDENCE_CAP.INFERRED),
    category: 'INFERRED',
    sourceType: 'ASSISTANT_REFLECTION',
    sourceDetail: assistant,
    summary: safeSummary(answer.why, `From ${assistantName}’s answers`),
  }));
}
