import { describe, expect, it } from 'vitest';
import { color, contrastRatio, duration, resolveDuration, space } from './index.js';

describe('colour contrast (WCAG AA)', () => {
  const backgrounds = [color.background, color.surface, color.surfaceRaised];

  it.each(backgrounds)('body text is readable on %s', (background) => {
    expect(contrastRatio(color.textPrimary, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color.textSecondary, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(backgrounds)('accent and status colours are readable on %s', (background) => {
    for (const token of ['accent', 'chemistryText', 'success', 'warning', 'danger'] as const) {
      expect(contrastRatio(color[token], background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('text on the accent fill is readable', () => {
    expect(contrastRatio(color.textOnAccent, color.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('ivory text on the chemistry fill is readable', () => {
    expect(contrastRatio(color.textPrimary, color.chemistry)).toBeGreaterThanOrEqual(4.5);
  });

  it('rejects malformed colours', () => {
    expect(() => contrastRatio('rgb(0,0,0)', '#000000')).toThrow();
  });
});

describe('motion', () => {
  it('collapses to instant under reduced motion', () => {
    expect(resolveDuration('slow', true)).toBe(0);
    expect(resolveDuration('slow', false)).toBe(duration.slow);
  });
});

describe('spacing', () => {
  it('stays on the 2pt grid', () => {
    for (const value of Object.values(space)) expect(value % 2).toBe(0);
  });
});
