import { describe, expect, it } from 'vitest';
import type { ReglagesFoyer } from '../../../src/lib/cycle/etat';
import { foyerParDefaut } from '../../../src/lib/cycle/etat';
import { changementsEnAttente } from '../../../src/lib/cycle/semaineType';

// Option B (spec refonte §6) : le diff entre la semaine type ACTUELLE du foyer
// et l'instantané pris au lancement des menus. Corrompu = ignoré, jamais un crash.

const foyer = foyerParDefaut(null);

describe('changementsEnAttente', () => {
  it('instantané absent ou corrompu → aucun changement (pas de crash)', () => {
    expect(changementsEnAttente(foyer, undefined)).toEqual([]);
    expect(changementsEnAttente(foyer, null)).toEqual([]);
    expect(changementsEnAttente(foyer, 'corrompu')).toEqual([]);
    expect(changementsEnAttente(foyer, 42)).toEqual([]);
    expect(changementsEnAttente(foyer, { lundi: 42 })).toEqual([]);
    expect(changementsEnAttente(foyer, { ...foyer.semaine, samedi: undefined })).toEqual([]);
    expect(changementsEnAttente(foyer, { ...foyer.semaine, lundi: { ...foyer.semaine.lundi, diner: 'nimporte' } })).toEqual([]);
  });

  it('semaine identique → vide (même ordre de clés ou contenu égal)', () => {
    expect(changementsEnAttente(foyer, foyer.semaine)).toEqual([]);
    const copie = Object.fromEntries(Object.entries(foyer.semaine).map(([j, t]) => [j, { ...t, plusTard: [...t.plusTard] }]));
    expect(changementsEnAttente(foyer, copie)).toEqual([]);
  });

  it('un créneau modifié → son jour', () => {
    const f: ReglagesFoyer = { ...foyer, semaine: { ...foyer.semaine, lundi: { ...foyer.semaine.lundi, diner: 'rapide' } } };
    expect(changementsEnAttente(f, foyer.semaine)).toEqual(['lundi']);
  });

  it('plusieurs créneaux → tous les jours changés, dans l\'ordre de la semaine', () => {
    const f: ReglagesFoyer = {
      ...foyer,
      semaine: {
        ...foyer.semaine,
        lundi: { ...foyer.semaine.lundi, diner: 'rapide' },
        jeudi: { ...foyer.semaine.jeudi, plusTard: ['nouveau'] },
      },
    };
    expect(changementsEnAttente(f, foyer.semaine)).toEqual(['lundi', 'jeudi']);
  });

  it('journée renommée : « standard » dans l’instantané égale « classique » du foyer (pas de faux changement)', () => {
    const instantane: unknown = { ...foyer.semaine, lundi: { ...foyer.semaine.lundi, journee: { marc: 'standard' } } };
    const f: ReglagesFoyer = { ...foyer, semaine: { ...foyer.semaine, lundi: { ...foyer.semaine.lundi, journee: { marc: 'classique' } } } };
    expect(changementsEnAttente(f, instantane)).toEqual([]);
  });
});
