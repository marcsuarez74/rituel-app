import { describe, expect, it } from 'vitest';
import { chargerCycleExemple, debutParDefaut, semaineParDefaut } from '../../../src/lib/cycle/courant';

describe('debutParDefaut', () => {
  it('dernier jour des courses passé (aujourd’hui compris)', () => {
    expect(debutParDefaut('2026-10-07', 'samedi')).toBe('2026-10-03'); // mercredi → samedi d'avant
    expect(debutParDefaut('2026-10-10', 'samedi')).toBe('2026-10-10'); // samedi même
  });
});

describe('semaineParDefaut', () => {
  it('semaine en cours, sinon la 1re avant le début, la dernière après la fin, celle d’avant une pause', () => {
    expect(semaineParDefaut({ etat: 'semaine', index: 2, lettre: 'C', du: '', au: '' })).toBe(2);
    expect(semaineParDefaut({ etat: 'avant', debut: '' })).toBe(0);
    expect(semaineParDefaut({ etat: 'termine', prochain: '' })).toBe(3);
    expect(semaineParDefaut({ etat: 'pause', apres: 1, du: '', au: '' })).toBe(1);
  });
});

describe('chargerCycleExemple', () => {
  it('cycle d’exemple valide, qui démarre au dernier jour des courses', async () => {
    const c = await chargerCycleExemple('2026-10-07', 'samedi');
    // id lié au début : les coches d'exemple repartent à zéro chaque semaine.
    expect(c).toMatchObject({ id: 'exemple-2026-10-03', numero: 1, debut: '2026-10-03', pauses: [] });
    expect(c.cycle.menus.map((m) => m.lettre)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('les membres anonymisés du fichier deviennent ceux du foyer', async () => {
    const c = await chargerCycleExemple('2026-10-07', 'samedi');
    const r = c.cycle.recettes[0];
    expect(Object.keys(r.macros).sort()).toEqual(['marc', 'melanie']);
    expect(Object.keys(r.portions)).toEqual(expect.arrayContaining(['maelle', 'maxine']));
    expect(JSON.stringify(c.cycle)).not.toMatch(/\b(Alex|Sam)\b|"(alex|sam|lou|noa)"/);
  });
});
