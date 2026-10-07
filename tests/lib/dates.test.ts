import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ageDepuis,
  formatJourMoisCourt,
  joursRestants,
  periodeCourte,
} from '../../src/lib/dates';

describe('dates: ageDepuis', () => {
  afterEach(() => vi.useRealTimers());

  it('calcule l âge atteint quand l anniversaire est passé', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    expect(ageDepuis('1985-04-12')).toBe(41);
  });

  it("ne compte pas l'anniversaire pas encore atteint", () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    expect(ageDepuis('1985-12-01')).toBe(40);
  });

  it("compte l'anniversaire le jour même", () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    expect(ageDepuis('1990-09-09')).toBe(36);
  });
});

describe('dates: joursRestants', () => {
  afterEach(() => vi.useRealTimers());

  it('compte les jours jusqu à une échéance future', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    expect(joursRestants('2026-12-15')).toBe(97);
  });

  it('retourne 0 le jour même', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    expect(joursRestants('2026-09-09')).toBe(0);
  });

  it('retourne un nombre négatif si dépassée', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    expect(joursRestants('2026-06-15')).toBe(-86);
  });
});

describe('dates: formatJourMoisCourt', () => {
  it('formate en jour + mois abrégé français', () => {
    expect(formatJourMoisCourt('2026-12-15')).toBe('15 déc.');
    expect(formatJourMoisCourt('2026-06-01')).toBe('1 juin');
    expect(formatJourMoisCourt('2026-02-03')).toBe('3 févr.');
  });
});

describe('dates: periodeCourte', () => {
  it('même mois : numéros de jours + mois de fin', () => {
    expect(periodeCourte('2026-09-21', '2026-09-27')).toBe('21 → 27 sept.');
  });

  it('mois différents : les deux mois sont affichés', () => {
    expect(periodeCourte('2026-09-30', '2026-10-03')).toBe('30 sept. → 3 oct.');
  });

  it('jours sans zéro initial (semaine d\u2019exemple)', () => {
    expect(periodeCourte('2026-09-07', '2026-09-13')).toBe('7 → 13 sept.');
  });
});
