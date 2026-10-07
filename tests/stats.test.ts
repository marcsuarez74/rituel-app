import { describe, expect, it } from 'vitest';
import { poidsActuel, variationKg7j } from '../src/lib/stats';
import type { WeightEntry } from '../src/lib/storage';

const w = (date: string, kg: number): WeightEntry => ({ date, kg });

describe('stats: poidsActuel', () => {
  it('retourne la dernière pesée', () => {
    expect(poidsActuel([w('2026-08-01', 85), w('2026-09-01', 78)])).toEqual(w('2026-09-01', 78));
  });

  it('retourne null sans pesée', () => {
    expect(poidsActuel([])).toBeNull();
  });
});

describe('stats: variationKg7j', () => {
  it('retourne l écart en kg vs la pesée la plus proche de J-7', () => {
    const weights = [w('2026-08-01', 80), w('2026-08-29', 80), w('2026-09-01', 78), w('2026-09-08', 77.4)];
    expect(variationKg7j(weights)).toBeCloseTo(-0.6, 2);
  });

  it('retourne null avec une seule pesée', () => {
    expect(variationKg7j([w('2026-09-08', 78)])).toBeNull();
  });

  it('retourne null si la pesée précédente a plus de 14 jours', () => {
    expect(variationKg7j([w('2026-08-01', 80), w('2026-09-08', 78)])).toBeNull();
  });
});

