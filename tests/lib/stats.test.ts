import { describe, expect, it } from 'vitest';
import { progressionPoids } from '../../src/lib/stats';

describe('progressionPoids', () => {
  it('perte : 82,8 → 78,4 vers 74 = 50 %, 4,4 kg restants', () => {
    const r = progressionPoids('perte', 82.8, 78.4, 74);
    expect(r).toEqual({ pct: 50, kgRestant: 4.4, sens: 'restants' });
  });

  it('masse : sens inversé, kg à prendre', () => {
    const r = progressionPoids('masse', 74, 75.8, 82);
    expect(r?.pct).toBe(22.5);
    expect(r?.sens).toBe('à prendre');
  });

  it('total nul (cible = départ) : null (fallback poids simple)', () => {
    expect(progressionPoids('perte', 78, 78.4, 78)).toBeNull();
  });

  it('clamp 0-100 : déjà sous la cible = 100', () => {
    const r = progressionPoids('perte', 82.8, 73, 74);
    expect(r?.pct).toBe(100);
  });
});
