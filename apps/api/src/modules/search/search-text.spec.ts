import { describe, expect, it } from 'vitest';
import { escapeLike, foldText, rankScore, searchTerms } from './search-text.js';

describe('search text', () => {
  it('folds case, accents and spacing', () => {
    expect(foldText('  José  ÁLVAREZ ')).toBe('jose alvarez');
    expect(foldText('Zoë')).toBe('zoe');
  });

  it('separates a name form from a username form', () => {
    expect(searchTerms('@Asha Rao')).toEqual({ name: 'asha rao', handle: 'asharao' });
    expect(searchTerms('neel_01')).toEqual({ name: 'neel_01', handle: 'neel_01' });
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });

  it('keeps boosts below the gap between match tiers', () => {
    const strong = rankScore({ base: 800, relation: 'none', sameCity: false, hasPhoto: false });
    const weakButClose = rankScore({
      base: 680,
      relation: 'connected',
      sameCity: true,
      hasPhoto: true,
    });
    expect(strong).toBeGreaterThan(weakButClose);
  });

  it('prefers people you know when text matches equally', () => {
    const known = rankScore({ base: 700, relation: 'connected', sameCity: false, hasPhoto: false });
    const stranger = rankScore({ base: 700, relation: 'none', sameCity: true, hasPhoto: true });
    expect(known).toBeGreaterThan(stranger);
  });
});
