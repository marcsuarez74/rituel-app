import { describe, expect, it } from 'vitest';
import { PROFILS_META, prenomProfil } from '../../src/lib/model';
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
