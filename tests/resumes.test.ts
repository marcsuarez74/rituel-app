import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '../src/lib/model';
import type { WeightEntry } from '../src/lib/storage'; // WeightEntry vit dans storage, pas model
import type { PushConfig } from '../src/lib/push/module';
import { configDefaut } from '../src/lib/push/module';
import { ageDepuis } from '../src/lib/dates';
import {
  fmtKg,
  resumeDuo,
  resumeInfos,
  resumeMaison,
  resumeNotifications,
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

describe('resumes — fmtKg', () => {
  it('forme française (virgule, sans zéro inutile)', () => {
    expect(fmtKg(4.2)).toBe('4,2');
    expect(fmtKg(4)).toBe('4');
    expect(fmtKg(0.8)).toBe('0,8');
  });
});

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
  it('sans cible : le type seul (fallback silencieux)', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, poidsObjectif: undefined }, pesee)).toBe(
      'Perte de poids',
    );
  });
  it('sans pesée : le type seul', () => {
    expect(resumeObjectif({ ...profileBase, poidsObjectif: 79.8 }, null)).toBe('Perte de poids');
  });
  it('maintien : le nom du type (pas de calcul)', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, objectif: { type: 'maintien' } }, pesee)).toBe(
      'Maintien',
    );
  });
});

describe('resumes — resumeInfos', () => {
  it('champs remplis : âge calculé + taille', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // avec heure (parse local)
    expect(ageDepuis('1985-04-12')).toBe(41);
    expect(resumeInfos(profileBase)).toBe('41 ans · 178 cm');
    vi.useRealTimers();
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
  it('rien : « — »', () => {
    expect(resumeMaison(profileBase)).toBe('—');
  });
});

describe('resumes — resumeNotifications', () => {
  it('2 événements + 1 rappel', () => {
    const config: PushConfig = {
      ...configDefaut(),
      evenements: { diner: true, pesee: true, courses: false },
      rappels: [...configDefaut().rappels, { type: 'seance', jours: [1], heure: '08:00' }],
    };
    expect(resumeNotifications(config)).toBe('2 évts · 1 rappel');
  });
  it('2 rappels : accord pluriel', () => {
    const config: PushConfig = {
      ...configDefaut(),
      rappels: [
        { type: 'seance', jours: [1], heure: '08:00' },
        { type: 'pesee', jours: [1], heure: '08:00' },
      ],
    };
    expect(resumeNotifications(config)).toBe('0 évts · 2 rappels');
  });
  it('rien activé : « — »', () => {
    expect(resumeNotifications({ ...configDefaut(), rappels: [] })).toBe('—');
  });
});

beforeEach(() => {
  localStorage.clear();
});
