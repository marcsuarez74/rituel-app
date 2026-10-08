import { describe, expect, it } from 'vitest';
import { PROFILS_META, estIdProfil, estSuivi, nouvelIdProfil, prenomProfil } from '../../src/lib/model';
import type { UserProfile } from '../../src/lib/model';

const base: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  objectif: { type: 'perte' },
  complements: [],
  regime: 'aucun',
};

describe('PROFILS_META / prenomProfil', () => {
  it('défaut : nom de la méta', () => {
    expect(prenomProfil('marc')).toBe('Marc');
    expect(prenomProfil('melanie')).toBe('Mélanie');
    expect(PROFILS_META.marc.tagline).toBe('Diet & Sport');
    expect(PROFILS_META.melanie.tagline).toBe('Keto & Sport');
  });

  it('prénom édité prioritaire (trim)', () => {
    expect(prenomProfil('marc', { ...base, prenom: '  Jean ' })).toBe('Jean');
    expect(prenomProfil('melanie', { ...base, id: 'melanie', prenom: 'Mel' })).toBe('Mel');
  });

  it('prénom vide ou espaces → défaut', () => {
    expect(prenomProfil('marc', { ...base, prenom: '   ' })).toBe('Marc');
    expect(prenomProfil('marc', { ...base, prenom: '' })).toBe('Marc');
  });
});

describe('identité ouverte', () => {
  it('nouvel id : prénom en slug + 4 caractères aléatoires, jamais affiché', () => {
    expect(nouvelIdProfil('Thérèse', () => '3f9a')).toBe('therese-3f9a');
    expect(nouvelIdProfil('  Jean-Éric du Pont ', () => '00ab')).toBe('jean-eric-du-pont-00ab');
    expect(nouvelIdProfil('   ', () => '1234')).toBe('moi-1234');
    expect(nouvelIdProfil('Zoé')).toMatch(/^zoe-[0-9a-f]{4}$/);
  });

  it('garde d’id : les anciens marc / melanie et les nouveaux ids passent, le reste non', () => {
    for (const ok of ['marc', 'melanie', 'therese-3f9a']) expect(estIdProfil(ok)).toBe(true);
    for (const ko of ['', 'Marc', '../x', 'a b', 42, null]) expect(estIdProfil(ko)).toBe(false);
  });

  it('prénom affiché : à défaut de prénom, l’id (pas de nom inventé)', () => {
    expect(prenomProfil('therese-3f9a', { ...base, id: 'therese-3f9a', prenom: 'Thérèse' })).toBe('Thérèse');
    expect(prenomProfil('therese-3f9a')).toBe('therese-3f9a');
  });

  it('suivi : absent = oui (profils existants), false = juste la routine', () => {
    expect(estSuivi(base)).toBe(true);
    expect(estSuivi({ ...base, suivi: false })).toBe(false);
  });
});
