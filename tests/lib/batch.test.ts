import { describe, expect, it } from 'vitest';
import { dureeRituel, iconeReserve } from '../../src/lib/batch';
import type { ReserveLigne, RituelEtape } from '../../src/lib/model';

const etape = (creneau: string): RituelEtape => ({ id: `x-${creneau}`, creneau, label: 'L' });

describe('dureeRituel', () => {
  it('somme les créneaux A-B min', () => {
    expect(dureeRituel([etape('0-5 min'), etape('5-30 min')])).toBe('≈ 30 min');
  });
  it('formate les heures pleines et les minutes restantes', () => {
    expect(dureeRituel([etape('0-60 min')])).toBe('≈ 1 h');
    expect(dureeRituel([etape('0-45 min'), etape('45-75 min')])).toBe('≈ 1 h 15');
  });
  it('ignore les créneaux non parsables', () => {
    expect(dureeRituel([etape('13h45 · 10 min'), etape('0-5 min')])).toBe('≈ 5 min');
  });
  it('pas de badge sans durées exploitables', () => {
    expect(dureeRituel([etape('à définir')])).toBeNull();
    expect(dureeRituel([])).toBeNull();
    expect(dureeRituel(undefined)).toBeNull();
  });
});

describe('iconeReserve', () => {
  const ligne = (plat: string, conservation: string, cle = 'lundi'): ReserveLigne => ({
    cle,
    plat,
    conservation,
  });
  it('déduit par mots-clés (sans casse ni accents)', () => {
    expect(iconeReserve(ligne('Poulet-riz', 'frigo, 2 j max · réchauffage 2 min'))).toBe('box');
    expect(iconeReserve(ligne('Poulet-riz', 'congelé dimanche · sortie mercredi soir'))).toBe('snow');
    expect(iconeReserve(ligne('Saumon-asperges', 'poisson frais du jour'))).toBe('fish');
    expect(iconeReserve(ligne('Pâtes-tomate (famille)', 'cuites le soir'))).toBe('pasta');
    expect(iconeReserve(ligne('Salade poulet-riz', 'froide'))).toBe('bowl');
  });
  it('la clé mel et le mot keto priment (feuille)', () => {
    expect(iconeReserve(ligne('Boîte keto saumon-asperges', 'à part', 'mel'))).toBe('leaf');
    expect(iconeReserve(ligne('Œufs durs', 'collations keto'))).toBe('leaf');
  });
});
