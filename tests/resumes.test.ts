import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '../src/lib/model';
import type { WeightEntry } from '../src/lib/storage'; // WeightEntry vit dans storage, pas model
import { ageDepuis } from '../src/lib/dates';
import {
  resumeDuo,
  resumeInfos,
  resumeMaison,
  resumeObjectif,
} from '../src/lib/resumes';

const profileBase: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  objectif: { type: 'perte', echeance: '2026-12-15' },
  complements: [],
  regime: 'aucun',
};

afterEach(() => vi.useRealTimers());

describe('resumes — resumeDuo (sous-ligne en-tête)', () => {
  it('connecté : « Duo connecté » point basilic', () => {
    expect(resumeDuo('sync')).toEqual({ label: 'Duo connecté', ton: 'basilic' });
  });
  it('en cours/erreur : « Duo ⟳ » point danger', () => {
    expect(resumeDuo('attente')).toEqual({ label: 'Duo ⟳', ton: 'danger' });
    expect(resumeDuo('erreur')).toEqual({ label: 'Duo ⟳', ton: 'danger' });
  });
  it('hors foyer : « Local » point gris', () => {
    expect(resumeDuo('hors-foyer')).toEqual({ label: 'Local', ton: 'gris' });
  });
  it('off (sans env) : null — chip masquée', () => {
    expect(resumeDuo('off')).toBeNull();
  });
});

describe('resumes — resumeObjectif', () => {
  it('cible + pesée : type · restants (perte)', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, poidsObjectif: 79.8 }, pesee)).toBe(
      'Perte de poids · 4,2 kg restants',
    );
  });
  it('sens auto : cible au-dessus de l actuel → à prendre', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, poidsObjectif: 87.2 }, pesee)).toBe(
      'Perte de poids · 3,2 kg à prendre',
    );
  });
  it('cible atteinte : 0 kg restants', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, poidsObjectif: 84 }, pesee)).toBe(
      'Perte de poids · 0,0 kg restants',
    );
  });
  it('sans cible : le type seul (fallback silencieux)', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, poidsObjectif: undefined }, pesee)).toBe(
      'Perte de poids',
    );
  });
  it('sans pesée : le type seul', () => {
    expect(resumeObjectif({ ...profileBase, poidsObjectif: 79.8 }, null)).toBe('Perte de poids');
  });
  it('maintien sans cible : le nom du type', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, objectif: { type: 'maintien' } }, pesee)).toBe(
      'Maintien',
    );
  });
  it('maintien avec cible : le calcul s applique', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(
      resumeObjectif({ ...profileBase, objectif: { type: 'maintien' }, poidsObjectif: 79.8 }, pesee),
    ).toBe('Maintien · 4,2 kg restants');
  });
});

describe('resumes — resumeInfos', () => {
  it('champs remplis : âge calculé + taille', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // avec heure (parse local)
    expect(ageDepuis('1985-04-12')).toBe(41);
    expect(resumeInfos(profileBase)).toBe('41 ans · 178 cm');
  });
  it('profil partiel : seuls les champs remplis', () => {
    expect(resumeInfos({ ...profileBase, dateNaissance: undefined })).toBe('178 cm');
  });
  it('rien : « — »', () => {
    expect(
      resumeInfos({ ...profileBase, dateNaissance: undefined, taille: undefined }),
    ).toBe('—');
  });
});

describe('resumes — resumeMaison', () => {
  it('seuls les champs remplis, pill format', () => {
    expect(resumeMaison({ ...profileBase, magasin: 'Carrefour City', budgetMax: 80, personnes: 2 })).toBe(
      'Carrefour City · 80 € · 2 pers.',
    );
  });
  it('budget décimal : à la française', () => {
    expect(resumeMaison({ ...profileBase, magasin: 'Lidl', budgetMax: 39.99 })).toBe(
      'Lidl · 39,99 €',
    );
  });
  it('rien : « — »', () => {
    expect(resumeMaison(profileBase)).toBe('—');
  });
});
