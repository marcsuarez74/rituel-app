import { describe, expect, it } from 'vitest';
import { couleurPlat, platsDuRituel } from '../../../src/lib/cycle/couleurs';
import type { Rituel } from '../../../src/lib/cycle/types';

// Rituel minimal valide pour les tests.
const rituel = (etapes: Array<{ recette?: string; plats?: string[] }>): Rituel => ({
  dureeMin: 90,
  production: [],
  avantDeCommencer: [],
  etapes: etapes.map((e, i) => ({ id: `e${i}`, creneau: '0-20 min', label: `Étape ${i}`, detail: '', ...e })),
  termine: 'On range.',
});

describe('platsDuRituel', () => {
  it('liste les plats du rituel dans l’ordre d’apparition, sans doublon', () => {
    const r = rituel([{ recette: 'curry' }, { plats: ['soupe', 'curry'] }, { recette: 'curry' }]);
    expect(platsDuRituel(r)).toEqual(['curry', 'soupe']);
  });
});

describe('couleurPlat', () => {
  it('les plats du rituel reçoivent la palette dans leur ordre d’apparition', () => {
    const r = rituel([{ recette: 'curry' }, { recette: 'soupe' }]);
    expect(couleurPlat('curry', r).vive).toBe('#e3b505'); // 1re couleur (annexe A.2)
    expect(couleurPlat('soupe', r).vive).toBe('#b8336a'); // 2e couleur, 2e plat
  });

  it('chaque plat du rituel a une couleur distincte (≤ 9 plats)', () => {
    const plats = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
    const r = rituel(plats.map((recette) => ({ recette })));
    const vives = plats.map((p) => couleurPlat(p, r).vive);
    expect(new Set(vives).size).toBe(9);
  });

  it('les recettes hors rituel : couleur stable, déterminée par hachage de l’id', () => {
    const r = rituel([]);
    expect(couleurPlat('tartines-maison', r)).toEqual(couleurPlat('tartines-maison', r));
    expect(couleurPlat('tartines-maison', r).vive).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('la couleur claire accompagne toujours la vive (annexe A.2)', () => {
    const r = rituel([{ recette: 'curry' }, { plats: ['pesto', 'omelette'] }]);
    for (const id of ['curry', 'pesto', 'omelette']) {
      const c = couleurPlat(id, r);
      expect(c.vive).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.claire).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('id vide ou inconnu du rituel sans recettes : pas de couleur (carte neutre)', () => {
    const r = rituel([{ recette: 'curry' }]);
    expect(couleurPlat(null, r)).toEqual({ vive: null, claire: null });
    expect(couleurPlat('', r)).toEqual({ vive: null, claire: null });
  });
});
