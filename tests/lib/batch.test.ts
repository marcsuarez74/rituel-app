import { describe, expect, it } from 'vitest';
import { dureeRituel, iconeReserve, reserveId, soirsSansDiner } from '../../src/lib/batch';
import type { MenuDay, ReserveLigne, RituelEtape } from '../../src/lib/model';

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

describe('reserveId', () => {
  it('id stable dérivé de la clé et du plat (accents et ponctuation normalisés)', () => {
    expect(reserveId({ cle: 'lundi', plat: 'Boîte dinde-quinoa', conservation: 'frigo' })).toBe(
      'reserve:lundi:boite-dinde-quinoa',
    );
    expect(reserveId({ cle: 'mardi', plat: 'Chili ×2', conservation: 'congel' })).toBe(
      'reserve:mardi:chili-2',
    );
  });
});

describe('soirsSansDiner', () => {
  const RESERVE = [
    { cle: 'mardi', plat: 'Chili ×2', conservation: 'congélateur' },
    { cle: 'mel', plat: 'Box keto', conservation: 'à part' },
  ];

  it('soir sans dîner (ni famille ni mel) avec une ligne de réserve dédiée', () => {
    const menu: MenuDay[] = [
      { jour: 'Lundi', dinerFamille: 'Chili' },
      { jour: 'Mardi', dejeunerMarc: 'Restes' },
      { jour: 'Mercredi' },
    ];
    expect(soirsSansDiner(menu, RESERVE)).toEqual([{ jour: 'Mardi', ligne: RESERVE[0] }]);
  });

  it('un soir sans dîner sans ligne de réserve ne suggère rien ; la clé mel jamais', () => {
    const menu: MenuDay[] = [{ jour: 'Jeudi' }, { jour: 'Vendredi' }];
    expect(soirsSansDiner(menu, RESERVE)).toEqual([]);
  });

  it('diner-melanie seul compte comme un dîner planifié', () => {
    const menu: MenuDay[] = [{ jour: 'Mardi', dinerMelanie: 'Wok keto' }];
    expect(soirsSansDiner(menu, RESERVE)).toEqual([]);
  });
});
