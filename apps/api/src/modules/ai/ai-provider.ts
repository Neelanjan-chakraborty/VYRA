export const AI_PROVIDER = Symbol('AI_PROVIDER');
export const EMBEDDING_DIMENSIONS = 768;

/** One piece of what the person gave VYRA, addressable so evidence can point at it. */
export interface SourceItem {
  /** Stable id, e.g. "profile.bio" or "interest.trekking". */
  readonly ref: string;
  readonly kind: 'profile' | 'interest' | 'intent';
  readonly label: string;
  /** Already redacted. */
  readonly text: string;
}

export interface PersonaSourceBundle {
  readonly items: readonly SourceItem[];
}

/** What Wingman may know. Built only from what both people already show each other. */
export interface WingmanContext {
  readonly purpose: 'opener' | 'reply' | 'date_idea';
  readonly me: { readonly name: string; readonly interests: readonly string[] };
  readonly them: {
    readonly name: string;
    readonly bio: string | null;
    readonly occupation: string | null;
    readonly interests: readonly string[];
  };
  readonly sharedInterests: readonly string[];
  /** Plain-language reasons from the compatibility engine. */
  readonly highlights: readonly string[];
  /** Recent messages, oldest first. Only present when the requester allowed it. Redacted. */
  readonly messages: readonly { readonly fromMe: boolean; readonly text: string }[] | null;
}

export interface AiProvider {
  /** e.g. "mock" or "gemini:gemini-3.8-flash". Stored on the persona version. */
  readonly id: string;
  /**
   * Proposes persona attributes from the bundle. The result is untrusted and
   * deliberately `unknown`: callers must validate it before use.
   */
  draftPersona(bundle: PersonaSourceBundle): Promise<unknown>;
  /**
   * Up to three short message ideas. Untrusted `unknown`: callers filter it with
   * `filterWingmanSuggestions` and the person always edits before sending.
   */
  suggestMessages(context: WingmanContext): Promise<unknown>;
  /** A unit-length vector of EMBEDDING_DIMENSIONS numbers. */
  embed(text: string): Promise<number[]>;
}

export function normalise(vector: readonly number[]): number[] {
  const length = Math.hypot(...vector);
  return length === 0 ? vector.map(() => 0) : vector.map((v) => v / length);
}
