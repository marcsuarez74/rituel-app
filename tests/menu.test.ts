import { describe, expect, it } from 'vitest';
import type { MenuDay, Recette } from '../src/lib/model';
import { construireOnglets, labelCourt } from '../src/lib/menu';

const RECETTE: Recette = {
  id: 'r1',
  nom: 'Poulet au four + riz',
  temps: '45 min · four 200°',
  kcal: 680,
  score: 7,
  fraicheur: 'batch dimanche → boîte frigo',
  pour: '6-8 cuisses · 250 g riz',
  bases: ['b4'],
  etapes: ['Four 200°.', 'Rôtir 40 min.'],
  portions: { marc: '1 poignée de riz (~150 g) · 2 cuisses', melanie: 'poulet ×2 (sans riz)' },
};

const MENU: MenuDay[] = [
  {
    jour: 'Lundi',
    dejeunerMarc: 'Boîte poulet-riz',
    dejeunerMelanie: 'Restes poulet',
    dinerFamille: 'Poulet au four + riz',
    dinerMelanie: 'Poulet + légumes (sans riz)',
    batch: 'Double riz → boîte mardi',
    recetteRefs: { dinerFamille: 'R1', dejeunerMarc: 'R1', dejeunerMelanie: 'R1' },
  },
  { jour: 'Mardi', dejeunerMarc: 'Boîte poulet-riz (lun)', recetteRefs: { dejeunerMarc: 'R1' } },
  { jour: 'Mercredi', dinerFamille: 'Omelette + salade' },
];

describe('menu — labelCourt', () => {
  it('garde le premier segment avant séparateur (+ · —)', () => {
    expect(labelCourt('Poulet au four + riz')).toBe('Poulet au four');
    expect(labelCourt('Omelette + salade')).toBe('Omelette');
    expect(labelCourt('Rôti de dinde + gratin de courgettes + quinoa')).toBe('Rôti de dinde');
  });

  it('tronque les noms longs sur une borne de mot (espace ou tiret)', () => {
    expect(labelCourt('Cuisses de poulet rôties + légumes + riz')).toBe('Cuisses de poulet…');
    expect(labelCourt('Omelette fromage-jambon + pommes vapeur')).toBe('Omelette fromage…');
    expect(labelCourt('Soupe butternut-carotte + tartines')).toBe('Soupe butternut…');
  });
});

describe('menu — construireOnglets', () => {
  it('un onglet par jour qui a un dîner, dans l ordre du fichier', () => {
    const onglets = construireOnglets(MENU, [RECETTE]);
    expect(onglets).toHaveLength(2); // mardi (déjeuner seul) et jeudi n ouvrent pas d onglet
    expect(onglets[0].jour).toBe('Lundi');
    expect(onglets[1].jour).toBe('Mercredi');
  });

  it('la coche de l onglet = dinerFamille, le label = nom court de la recette', () => {
    const [lundi] = construireOnglets(MENU, [RECETTE]);
    expect(lundi.cleCoche).toBe('menu:lundi:dinerFamille');
    expect(lundi.label).toBe('Poulet au four');
    expect(lundi.recette?.id).toBe('r1');
    expect(lundi.diner?.id).toBe('menu:lundi:dinerFamille');
    expect(lundi.mel?.texte).toBe('Poulet + légumes (sans riz)');
    expect(lundi.batch?.texte).toBe('Double riz → boîte mardi');
  });

  it('jour sans recette : label = dîner tronqué, coche en repli sur dinerMelanie si pas de dinerFamille', () => {
    const [, mercredi] = construireOnglets(MENU, [RECETTE]);
    expect(mercredi.label).toBe('Omelette');
    expect(mercredi.recette).toBeUndefined();

    const repli = construireOnglets(
      [{ jour: 'Vendredi', dinerMelanie: 'Bowl saumon + avocat' }],
      [],
    );
    expect(repli[0].cleCoche).toBe('menu:vendredi:dinerMelanie');
    expect(repli[0].label).toBe('Bowl saumon');
  });
});
