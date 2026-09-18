import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assemblePromptIa } from '../../src/lib/promptIa';
import type { UserProfile } from '../../src/lib/model';
import type { WeightEntry } from '../../src/lib/storage';

const profilComplet: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  poidsObjectif: 72,
  objectif: { type: 'affiner', echeance: '2027-03-01' },
  complements: ['Créatine', 'Whey'],
  regime: 'keto',
  magasin: 'Lidl',
  budgetMax: 40,
  personnes: 4,
  repasJour: 3,
  preferences: ['Healthy', 'Batch-friendly'],
};

const pesee: WeightEntry = { date: '2026-09-14', kg: 82.4 };

describe('assemblePromptIa', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-17T10:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('embarque le contrat de format inline (squelette, règles, sortie)', () => {
    const texte = assemblePromptIa(profilComplet, pesee);
    expect(texte).toContain('## Squelette à remplir');
    expect(texte).toContain('## Règles dures');
    expect(texte).toContain('## Sortie attendue');
    expect(texte).toContain('semaine: {{AAAA-Sxx}}');
  });

  it('remplit l ouverture avec le contexte personnel', () => {
    const texte = assemblePromptIa(profilComplet, pesee);
    expect(texte).toContain(
      'Tu es un nutritionniste. Marc (41 ans, 82,4 kg — dernière pesée du 14/09, 178 cm) te demande de lui réaliser une rotation de menus sur 4 semaines',
    );
    expect(texte).toContain("Objectif : affiner la silhouette vers 72 kg d'ici mars 2027.");
  });

  it('assemble le bloc contexte avec les données maison', () => {
    const texte = assemblePromptIa(profilComplet, pesee);
    expect(texte).toContain('- Régime particulier : keto');
    expect(texte).toContain('- Compléments : Créatine, Whey');
    // formatEuro insère une espace insécable (U+00A0) avant € — cf. lib/prix.test.ts.
    expect(texte).toContain('- Courses : Lidl, budget 40,00\u00a0€/semaine');
    expect(texte).toContain('- Personnes à table : 4 · 3 repas/jour');
    expect(texte).toContain('- Préférences : healthy, batch-friendly');
  });

  it('omet les lignes des champs non configurés (bloc contexte vide -> absent)', () => {
    const texte = assemblePromptIa(
      {
        id: 'melanie',
        dateNaissance: '1994-06-30',
        taille: 165,
        objectif: { type: 'maintien' },
        complements: [],
        regime: 'aucun',
      },
      null,
    );
    expect(texte).toContain('Tu es un nutritionniste. Mélanie (32 ans, 165 cm)');
    expect(texte).toContain('Objectif : maintenir le poids.');
    expect(texte).not.toContain('- Régime');
    expect(texte).not.toContain('- Compléments');
    expect(texte).not.toContain('- Courses');
    expect(texte).not.toContain('- Budget');
    expect(texte).not.toContain('- Personnes');
    expect(texte).not.toContain('- Préférences');
    expect(texte).not.toContain('Son contexte');
  });

  it('gère magasin sans budget et budget sans magasin', () => {
    const texte = assemblePromptIa({ ...profilComplet, magasin: 'Lidl', budgetMax: undefined }, pesee);
    expect(texte).toContain('- Courses : Lidl');
    const texte2 = assemblePromptIa({ ...profilComplet, magasin: undefined, budgetMax: 30 }, pesee);
    expect(texte2).toContain('- Budget : 30,00\u00a0€/semaine');
  });

  it('omet la mention poids quand il n y a aucune pesée', () => {
    const texte = assemblePromptIa(profilComplet, null);
    expect(texte).toContain('Marc (41 ans, 178 cm)');
    expect(texte).not.toContain('82,4');
  });

  it('formate l objectif selon les 4 types (sans échéance ni poids cible)', () => {
    expect(assemblePromptIa({ ...profilComplet, poidsObjectif: undefined, objectif: { type: 'perte' } }, null)).toContain(
      'Objectif : perdre du poids.',
    );
    expect(assemblePromptIa({ ...profilComplet, poidsObjectif: undefined, objectif: { type: 'masse' } }, null)).toContain(
      'Objectif : prendre de la masse.',
    );
    expect(assemblePromptIa({ ...profilComplet, poidsObjectif: undefined, objectif: { type: 'maintien' } }, null)).toContain(
      'Objectif : maintenir le poids.',
    );
    const sansEcheance = assemblePromptIa(
      { ...profilComplet, poidsObjectif: undefined, objectif: { type: 'affiner' } },
      null,
    );
    expect(sansEcheance).toContain('Objectif : affiner la silhouette.');
    expect(sansEcheance).not.toContain("d'ici");
    const sansPoidsCible = assemblePromptIa(
      { ...profilComplet, poidsObjectif: undefined, objectif: { type: 'perte', echeance: '2027-06-01' } },
      null,
    );
    expect(sansPoidsCible).toContain("Objectif : perdre du poids d'ici juin 2027.");
    const avecPoidsCible = assemblePromptIa(
      { ...profilComplet, poidsObjectif: 75, objectif: { type: 'perte' } },
      null,
    );
    expect(avecPoidsCible).toContain('Objectif : perdre du poids vers 75 kg.');
  });

  it('laisse les placeholders de chat intacts et remplit les placeholders app', () => {
    const texte = assemblePromptIa(profilComplet, pesee);
    expect(texte).toContain('{{SEMAINE_DEPART}}');
    expect(texte).toContain('{{MENUS_ORDRE}}');
    expect(texte).toContain('{{EVENEMENTS}}');
    expect(texte).not.toContain('{{OUVERTURE}}');
    expect(texte).not.toContain('{{CONTEXTE}}');
  });

  it('profil partiel (onboarding sauté) : ouverture sans âge ni taille', () => {
    const texte = assemblePromptIa(
      { ...profilComplet, dateNaissance: undefined, taille: undefined },
      pesee,
    );
    expect(texte).toContain(
      'Tu es un nutritionniste. Marc (82,4 kg — dernière pesée du 14/09) te demande',
    );
  });

  it('profil partiel sans pesée : le prénom seul dans l ouverture', () => {
    const texte = assemblePromptIa(
      { ...profilComplet, dateNaissance: undefined, taille: undefined },
      null,
    );
    expect(texte).toContain('Tu es un nutritionniste. Marc te demande');
  });

  it('date présente, taille absente : âge affiché sans taille', () => {
    const texte = assemblePromptIa({ ...profilComplet, taille: undefined }, null);
    expect(texte).toContain('Tu es un nutritionniste. Marc (41 ans)');
  });
});
