import type {
  CompatibilityDimension,
  DealBreaker,
  GenderCategory,
  PersonaAttributeKey,
  PersonaAttributeValue,
  RelationshipIntent,
} from '@vyra/validation';

/** One persona attribute as the engine sees it: an approved value and how sure we are. */
export interface Trait {
  readonly value: PersonaAttributeValue;
  readonly confidence: number;
}

export interface Person {
  readonly id: string;
  readonly age: number;
  readonly gender: GenderCategory | null;
  readonly intents: readonly RelationshipIntent[];
  readonly preferences: {
    readonly minAge: number;
    readonly maxAge: number;
    readonly maxDistanceKm: number | null;
    /** Empty means everyone. */
    readonly interestedIn: readonly GenderCategory[];
    readonly dealBreakers: readonly DealBreaker[];
  };
  readonly location: { readonly latitude: number; readonly longitude: number } | null;
  /** From the approved persona only. Missing = unknown. */
  readonly traits: Partial<Record<PersonaAttributeKey, Trait>>;
  readonly interests: readonly { readonly slug: string; readonly label: string }[];
}

export type IneligibleReason =
  'self' | 'age_preference' | 'gender_preference' | 'distance' | 'intent_mismatch' | 'deal_breaker';

export type Weights = Readonly<Record<CompatibilityDimension, number>>;
