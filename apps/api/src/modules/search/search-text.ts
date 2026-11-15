import type { SearchResult } from '@vyra/validation';

/**
 * Lower-case, accents removed, whitespace collapsed. The database applies the
 * same fold to display names (`vyra_fold`), so "José" is found by "jose".
 */
export function foldText(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escapes LIKE wildcards so a query is always matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export interface SearchTerms {
  /** Folded text, for matching display names. */
  readonly name: string;
  /** What a username could be: no "@", no spaces, only username characters. */
  readonly handle: string;
}

/** Splits what someone typed into the two forms the search matches against. */
export function searchTerms(raw: string): SearchTerms {
  const name = foldText(raw).replace(/^@+/, '');
  return { name, handle: name.replace(/[^a-z0-9._]/g, '') };
}

export interface RankInput {
  /** The database's text-match score, up to 1000. */
  readonly base: number;
  readonly relation: SearchResult['relation'];
  readonly sameCity: boolean;
  readonly hasPhoto: boolean;
}

/**
 * Final order. Text relevance leads, so a typed username always beats a vague
 * name; closeness breaks near ties: people you already know first, then your
 * own city, then profiles that have a photo. The boosts are smaller than the
 * gap between match tiers, so they never lift a weak match over a strong one.
 */
export function rankScore({ base, relation, sameCity, hasPhoto }: RankInput): number {
  let boost = 0;
  if (relation === 'connected') boost += 60;
  else if (relation === 'pending') boost += 40;
  if (sameCity) boost += 15;
  if (hasPhoto) boost += 10;
  return base + boost;
}
