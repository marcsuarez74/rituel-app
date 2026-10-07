import { describe, expect, it } from 'vitest';
import { progressionPoids, resumeObjectif } from '../../src/lib/stats';

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

describe('stats: resumeObjectif', () => {
  it('écart signé et rythme hebdo jusqu’à l’échéance', () => {
    const r = resumeObjectif(82.4, 75, '2026-12-31', '2026-10-07');
    expect(r).toMatchObject({ actuel: 82.4, vise: 75, ambitieux: false });
    expect(r!.ecart).toBeCloseTo(-7.4);
    expect(r!.kgParSemaine).toBeCloseTo(0.61, 2); // 85 jours
  });

  it('plus de 1 kg par semaine : rythme ambitieux', () => {
    const r = resumeObjectif(82.4, 75, '2026-11-15', '2026-10-07');
    expect(r!.kgParSemaine).toBeCloseTo(1.33, 2);
    expect(r!.ambitieux).toBe(true);
  });

  it('sans échéance ou échéance passée : pas de rythme', () => {
    expect(resumeObjectif(82.4, 75, undefined, '2026-10-07')!.kgParSemaine).toBeNull();
    expect(resumeObjectif(82.4, 75, '2026-10-01', '2026-10-07')!.kgParSemaine).toBeNull();
  });

  it('sans pesée ou sans poids visé : rien à résumer', () => {
    expect(resumeObjectif(null, 75, undefined, '2026-10-07')).toBeNull();
    expect(resumeObjectif(82.4, undefined, undefined, '2026-10-07')).toBeNull();
  });
});
