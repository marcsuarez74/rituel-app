import { describe, expect, it } from 'vitest';
import type { MutationSync } from '../../../src/lib/sync/outbox';
import { evenementsDepuisMutations } from '../../../src/lib/push/evenements';

const MENUS = {
  lundi: 'Omelette au champignons',
  mardi: 'Salade keto',
};

const menuLabel = (semaine: string, jour: string): string | null =>
  semaine === '2026-S39' ? MENUS[jour as keyof typeof MENUS] ?? null : null;

const check = (id: string, done: boolean): MutationSync => ({
  op: 'upsert',
  table: 'checks',
  key: { semaine: '2026-S39', check_id: id },
  payload: { done },
});

const weight = (kg: number): MutationSync => ({
  op: 'upsert',
  table: 'weights',
  key: { profil: 'marc', date_: '2026-09-16' },
  payload: { kg },
});

const depense = (magasin: string, total: number): MutationSync => ({
  op: 'upsert',
  table: 'depenses',
  key: { date_: '2026-09-16', magasin_key: magasin.toLowerCase() },
  payload: { magasin, total },
});

describe('evenementsDepuisMutations', () => {
  it('dîner coché → événement diner avec le texte du menu', () => {
    expect(evenementsDepuisMutations([check('menu:lundi:dinerFamille', true)], menuLabel)).toEqual([
      { type: 'diner', label: 'Omelette au champignons' },
    ]);
  });

  it('dîner mélanie coché → aussi un diner', () => {
    expect(evenementsDepuisMutations([check('menu:mardi:dinerMelanie', true)], menuLabel)).toEqual([
      { type: 'diner', label: 'Salade keto' },
    ]);
  });

  it('dîner décoché → rien', () => {
    expect(evenementsDepuisMutations([check('menu:lundi:dinerFamille', false)], menuLabel)).toEqual([]);
  });

  it('menu inconnu (label absent) → rien', () => {
    expect(evenementsDepuisMutations([check('menu:dimanche:dinerFamille', true)], menuLabel)).toEqual([]);
  });

  it('autres coches (déjeuner, séances, courses) → rien', () => {
    expect(
      evenementsDepuisMutations(
        [check('menu:lundi:dejeunerMarc', true), check('seances:marc:lundi', true), check('courses:lundi:lait', true)],
        menuLabel,
      ),
    ).toEqual([]);
  });

  it('pesée → événement pesee, virgule française', () => {
    expect(evenementsDepuisMutations([weight(82.4)], menuLabel)).toEqual([{ type: 'pesee', label: '82,4 kg' }]);
  });

  it('courses → événement courses, virgule décimale', () => {
    expect(evenementsDepuisMutations([depense('Lidl', 23.4)], menuLabel)).toEqual([
      { type: 'courses', label: '23,4 € chez Lidl' },
    ]);
  });

  it('deletes (pesée, dépense) → rien', () => {
    expect(
      evenementsDepuisMutations(
        [
          { op: 'delete', table: 'weights', key: { profil: 'marc', date_: '2026-09-16' } },
          { op: 'delete', table: 'depenses', key: { date_: '2026-09-16', magasin_key: 'lidl' } },
        ],
        menuLabel,
      ),
    ).toEqual([]);
  });

  it('plusieurs mutations → plusieurs événements, ordre conservé', () => {
    expect(
      evenementsDepuisMutations([check('menu:lundi:dinerFamille', true), weight(82), depense('Lidl', 12)], menuLabel),
    ).toEqual([
      { type: 'diner', label: 'Omelette au champignons' },
      { type: 'pesee', label: '82 kg' },
      { type: 'courses', label: '12 € chez Lidl' },
    ]);
  });
});
