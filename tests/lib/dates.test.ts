import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ageDepuis,
  extraireJourLabel,
  formatJourMoisCourt,
  jourAbrege,
  joursRestants,
  libelleSemaineCourt,
  numeroCycle,
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

describe('dates: jourAbrege', () => {
  it('abrège les 7 jours', () => {
    expect(jourAbrege('lundi')).toBe('lun.');
    expect(jourAbrege('mercredi')).toBe('mer.');
    expect(jourAbrege('jeudi')).toBe('jeu.');
    expect(jourAbrege('vendredi')).toBe('ven.');
    expect(jourAbrege('samedi')).toBe('sam.');
    expect(jourAbrege('dimanche')).toBe('dim.');
    expect(jourAbrege('mardi')).toBe('mar.');
  });

  it('ignore la casse et rend le jour tel quel si inconnu', () => {
    expect(jourAbrege('Lundi')).toBe('lun.');
    expect(jourAbrege('inconnu')).toBe('inconnu');
  });
});

describe('dates: extraireJourLabel', () => {
  it('extrait le préfixe jour et le reste du libellé', () => {
    expect(extraireJourLabel('Lundi — Muscu libre 10h30 + navette vélo')).toEqual({
      jour: 'lundi',
      reste: 'Muscu libre 10h30 + navette vélo',
    });
  });

  it('accepte le tiret simple et les espaces', () => {
    expect(extraireJourLabel('Mardi - Pilates')).toEqual({ jour: 'mardi', reste: 'Pilates' });
  });

  it('ne coupe pas un libellé sans préfixe jour', () => {
    expect(extraireJourLabel('Full body')).toEqual({ jour: null, reste: 'Full body' });
  });
});

describe('libelleSemaineCourt', () => {
  it('tronque l\u2019année : 2026-S37 → Semaine 37', () => {
    expect(libelleSemaineCourt('2026-S37')).toBe('Semaine 37');
  });

  it('id sans année : S12 → Semaine 12', () => {
    expect(libelleSemaineCourt('S12')).toBe('Semaine 12');
  });

  it('id non conforme : ne crash pas, affiche l\u2019id', () => {
    expect(libelleSemaineCourt('bizarr')).toBe('Semaine bizarr');
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

describe('dates: numeroCycle', () => {
  // Rotation 4 semaines : S37 = menu A = cycle 1, S38 = B = 2, S39 = C = 3, S40 = D = 4, S41 → 1…
  it('calcule la position dans la rotation de 4 semaines', () => {
    expect(numeroCycle('2026-S37')).toBe(1);
    expect(numeroCycle('2026-S38')).toBe(2);
    expect(numeroCycle('2026-S39')).toBe(3);
    expect(numeroCycle('2026-S40')).toBe(4);
    expect(numeroCycle('2026-S41')).toBe(1);
  });

  it('id avec préfixe : E2E-S1 → cycle 1, E2E-S2 → cycle 2', () => {
    expect(numeroCycle('E2E-S1')).toBe(1);
    expect(numeroCycle('E2E-S2')).toBe(2);
  });

  it('id sans numéro de semaine : pas de pill (null)', () => {
    expect(numeroCycle('bizarr')).toBeNull();
  });
});
