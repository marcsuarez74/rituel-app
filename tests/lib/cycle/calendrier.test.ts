import { describe, expect, it } from 'vitest';
import {
  ajouterJours,
  dateDuJour,
  ordreJours,
  positionCycle,
  prochainCycle,
  prochainJour,
} from '../../../src/lib/cycle/calendrier';

// Cycle de référence : courses le samedi 4 octobre 2025.
const cal = { debut: '2025-10-04', pauses: [] as number[] };

describe('outils de dates (sans fuseau)', () => {
  it('ajoute des jours en franchissant les mois et le changement d’heure', () => {
    expect(ajouterJours('2025-10-25', 2)).toBe('2025-10-27');
    expect(ajouterJours('2025-12-30', 3)).toBe('2026-01-02');
    expect(ajouterJours('2025-10-04', -1)).toBe('2025-10-03');
  });

  it('prochainJour : le jour même s’il correspond, sinon le suivant', () => {
    expect(prochainJour('2025-10-04', 'samedi')).toBe('2025-10-04'); // un samedi
    expect(prochainJour('2025-10-07', 'samedi')).toBe('2025-10-11'); // un mardi
  });

  it('ordreJours : la semaine commence au jour des courses', () => {
    expect(ordreJours('samedi')).toEqual(['samedi', 'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']);
    expect(ordreJours('lundi')[6]).toBe('dimanche');
  });
});

describe('positionCycle', () => {
  it('avant le début', () => {
    expect(positionCycle(cal, '2025-10-01')).toEqual({ etat: 'avant', debut: '2025-10-04' });
  });

  it('semaines 1 à 4 → menus A à D, du jour des courses à la veille des suivantes', () => {
    expect(positionCycle(cal, '2025-10-04')).toEqual({ etat: 'semaine', index: 0, lettre: 'A', du: '2025-10-04', au: '2025-10-10' });
    expect(positionCycle(cal, '2025-10-10')).toMatchObject({ index: 0 });
    expect(positionCycle(cal, '2025-10-11')).toMatchObject({ index: 1, lettre: 'B' });
    expect(positionCycle(cal, '2025-10-31')).toMatchObject({ index: 3, lettre: 'D', au: '2025-10-31' });
  });

  it('terminé à partir du lendemain de la 4e semaine', () => {
    expect(positionCycle(cal, '2025-11-01')).toEqual({ etat: 'termine', prochain: '2025-11-01' });
    expect(prochainCycle(cal)).toBe('2025-11-01');
  });

  it('une pause après la semaine 2 décale la suite et la fin de 7 jours', () => {
    const p = { debut: '2025-10-04', pauses: [1] };
    expect(positionCycle(p, '2025-10-18')).toEqual({ etat: 'pause', du: '2025-10-18', au: '2025-10-24' });
    expect(positionCycle(p, '2025-10-25')).toMatchObject({ etat: 'semaine', index: 2, lettre: 'C' });
    expect(prochainCycle(p)).toBe('2025-11-08');
  });
});

describe('dateDuJour', () => {
  it('donne la date d’un jour du menu dans sa semaine', () => {
    expect(dateDuJour(cal, 0, 'samedi', 'samedi')).toBe('2025-10-04');
    expect(dateDuJour(cal, 0, 'vendredi', 'samedi')).toBe('2025-10-10');
    expect(dateDuJour({ ...cal, pauses: [0] }, 1, 'lundi', 'samedi')).toBe('2025-10-20');
  });
});
