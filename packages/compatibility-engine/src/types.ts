import type {
  CompatibilityDimension,
  DealBreaker,
  GenderCategory,
  GenderIdentity,
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
  /** As the person stated it; null = not answered. Never inferred. */
  readonly gender: GenderIdentity | null;
  /** SELF_DESCRIBE only: the searches they chose to appear in. */
  readonly discoverableAs: readonly GenderCategory[];
  readonly intents: readonly RelationshipIntent[];
  readonly preferences: {
    readonly minAge: number;
    readonly maxAge: number;
    readonly maxDistanceKm: number | null;
    /** Identities they want to see; empty means everyone. */
    readonly showGenders: readonly GenderCategory[];
    /** Whether to also see people whose identity isn't one of the listed categories. */
    readonly includeUnlistedGenders: boolean;
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
