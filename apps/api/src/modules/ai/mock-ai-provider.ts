import { createHash } from 'node:crypto';
import {
  type AiProvider,
  EMBEDDING_DIMENSIONS,
  normalise,
  type PersonaSourceBundle,
  type SourceItem,
} from './ai-provider.js';

interface Proposal {
  value: number | string | string[];
  rationale: string;
  evidenceRefs: string[];
}

const INTEREST_SIGNALS: Readonly<
  Record<string, readonly [attribute: string, value: number, reason: string][]>
> = {
  trekking: [['adventureOrientation', 0.8, 'Chose outdoor and travel interests']],
  'road-trips': [['adventureOrientation', 0.75, 'Chose outdoor and travel interests']],
  'solo-travel': [['adventureOrientation', 0.85, 'Chose outdoor and travel interests']],
  beaches: [['adventureOrientation', 0.6, 'Chose outdoor and travel interests']],
  'live-gigs': [['socialEnergy', 0.75, 'Chose interests that happen around people']],
  'stand-up': [['socialEnergy', 0.7, 'Chose interests that happen around people']],
  dance: [['socialEnergy', 0.75, 'Chose interests that happen around people']],
  'board-games': [['socialEnergy', 0.6, 'Chose interests that happen around people']],
  philosophy: [['intellectualCuriosity', 0.85, 'Chose idea-led interests']],
  science: [['intellectualCuriosity', 0.8, 'Chose idea-led interests']],
  documentaries: [['intellectualCuriosity', 0.75, 'Chose idea-led interests']],
  'literary-fiction': [['intellectualCuriosity', 0.75, 'Chose idea-led interests']],
  quizzing: [['intellectualCuriosity', 0.8, 'Chose idea-led interests']],
  'home-cooking': [['lifestylePace', 0, 'Chose home-centred interests']],
  baking: [['lifestylePace', 0, 'Chose home-centred interests']],
};

const BIO_VALUE_WORDS: readonly [RegExp, string][] = [
  [/\bhonest/i, 'honesty'],
  [/\bkind/i, 'kindness'],
  [/\bcurious/i, 'curiosity'],
  [/\bfamily/i, 'family'],
  [/\b(funny|laugh|humou?r)/i, 'humour'],
  [/\badventur/i, 'adventure'],
  [/\bcreat/i, 'creativity'],
  [/\bloyal/i, 'loyalty'],
];

const LIFESTYLE_VALUES = ['homebody', 'balanced', 'outgoing'] as const;

/**
 * Deterministic stand-in for a language model: transparent keyword and
 * interest rules. Used in development and in every test, so results never
 * depend on a network or vary between runs.
 */
export class MockAiProvider implements AiProvider {
  readonly id = 'mock';

  async draftPersona(bundle: PersonaSourceBundle): Promise<unknown> {
    const proposals = new Map<string, Proposal>();
    const add = (
      attribute: string,
      value: number | string | string[],
      rationale: string,
      ref: string,
    ) => {
      const existing = proposals.get(attribute);
      if (!existing) {
        proposals.set(attribute, { value, rationale, evidenceRefs: [ref] });
        return;
      }
      existing.evidenceRefs.push(ref);
      if (typeof existing.value === 'number' && typeof value === 'number') {
        const n = existing.evidenceRefs.length;
        existing.value = Math.round(((existing.value * (n - 1) + value) / n) * 100) / 100;
      }
    };

    for (const item of bundle.items) {
      if (item.kind === 'interest') {
        const slug = item.ref.slice('interest.'.length);
        for (const [attribute, value, reason] of INTEREST_SIGNALS[slug] ?? []) {
          add(
            attribute,
            attribute === 'lifestylePace' ? (LIFESTYLE_VALUES[value] ?? 'balanced') : value,
            reason,
            item.ref,
          );
        }
      }
    }

    const bio = bundle.items.find((item) => item.ref === 'profile.bio');
    if (bio) this.readBio(bio, add);

    return { attributes: Object.fromEntries(proposals) };
  }

  private readBio(
    bio: SourceItem,
    add: (a: string, v: number | string | string[], r: string, ref: string) => void,
  ) {
    const words = bio.text.split(/\s+/).filter(Boolean).length;
    if (/!|\bhaha\b|\blol\b|😄|😂/i.test(bio.text)) {
      add('communicationStyle', 'playful', 'Bio has a playful tone', bio.ref);
    } else if (/\b(think|wonder|feel|quiet)\w*/i.test(bio.text)) {
      add('communicationStyle', 'reflective', 'Bio reads as thoughtful', bio.ref);
    } else if (words >= 40) {
      add('communicationStyle', 'expansive', 'Bio is long and detailed', bio.ref);
    } else if (words > 0 && words < 12) {
      add('communicationStyle', 'concise', 'Bio is short and to the point', bio.ref);
    }
    if (/\bspontaneous|last[- ]minute|go with the flow\b/i.test(bio.text)) {
      add('planningStyle', 0.2, 'Describes being spontaneous', bio.ref);
    } else if (/\bplanner|plan ahead|organis|organiz|schedule/i.test(bio.text)) {
      add('planningStyle', 0.8, 'Describes planning ahead', bio.ref);
    }
    const values = BIO_VALUE_WORDS.filter(([pattern]) => pattern.test(bio.text)).map(
      ([, value]) => value,
    );
    if (values.length > 0) add('values', values.slice(0, 5), 'Mentioned in your bio', bio.ref);
  }

  async embed(text: string): Promise<number[]> {
    const vector: number[] = [];
    let block = createHash('sha256').update(text).digest();
    while (vector.length < EMBEDDING_DIMENSIONS) {
      for (let i = 0; i + 1 < block.length && vector.length < EMBEDDING_DIMENSIONS; i += 2) {
        vector.push((block.readUInt16BE(i) / 0xffff) * 2 - 1);
      }
      block = createHash('sha256').update(block).digest();
    }
    return normalise(vector);
  }
}
