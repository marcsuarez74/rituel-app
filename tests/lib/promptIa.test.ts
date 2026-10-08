import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReglagesFoyer } from '../../src/lib/cycle/etat';
import type { UserProfile } from '../../src/lib/model';
import { assemblePromptIa, schemaContrat } from '../../src/lib/promptIa';
import { foyerDuo } from './cycle/fabrique';

const profil: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  poidsObjectif: 75,
  objectif: { type: 'perte' },
  complements: ['Créatine', 'Whey'],
  regime: 'aucun',
  preferences: ['Batch-friendly'],
};

const foyer = (): ReglagesFoyer => {
  const f: ReglagesFoyer = { ...foyerDuo(), magasin: 'Lidl', budgetMax: 110 };
  f.membres[1].regime = 'keto';
  f.membres.push({ id: 'maelle', prenom: 'Maëlle', type: 'enfant', suivi: false });
  f.semaine.lundi = { dejeuner: { marc: 'box', melanie: 'maison', maelle: 'dehors' }, diner: 'rapide', plusTard: ['melanie'], journee: { marc: 'sortie' }, note: 'Piscine' };
  f.exceptions = [
    { regle: '1er et 3e vendredis', effet: 'resto à deux', actif: true },
    { regle: 'Mardi', effet: 'inactif', actif: false },
  ];
  return f;
};

const prompt = (f = foyer(), precedentes: string[] = []) =>
  assemblePromptIa({ foyer: f, profil, dernierPoids: { date: '2026-10-05', kg: 82.4 }, precedentes });

describe('assemblePromptIa (cycle v2)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-10-07T10:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aucun champ laissé à remplir', () => {
    expect(prompt()).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('le foyer : ids exacts, profil actif détaillé, régimes, enfants', () => {
    const t = prompt();
    expect(t).toContain(
      '- marc (Marc) · adulte · suivi · objectif : perdre du poids vers 75 kg · 41 ans, 82,4 kg, 178 cm · compléments : Créatine, Whey',
    );
    expect(t).toContain('- melanie (Mélanie) · adulte · suivi · régime keto');
    expect(t).toContain('- maelle (Maëlle) · enfant · mange normalement, portion enfant');
  });

  it('juste la routine : ni objectif ni mesures pour ce membre, portions adulte standard', () => {
    const f = foyer();
    f.membres[0].suivi = false;
    const t = assemblePromptIa({ foyer: f, profil: { ...profil, suivi: false }, dernierPoids: { date: '2026-10-05', kg: 82.4 }, precedentes: [] });
    expect(t).toContain('- marc (Marc) · adulte · portion adulte standard\n');
    expect(t).not.toContain('82,4 kg');
  });

  it('la semaine type à partir du jour des courses, exceptions actives seulement', () => {
    const t = prompt();
    expect(t).toContain('Courses le samedi · rituel batch le dimanche');
    expect(t.indexOf('- samedi :')).toBeLessThan(t.indexOf('- lundi :'));
    expect(t).toContain(
      '- lundi : déjeuner Marc=box, Mélanie=maison, Maëlle=dehors · dîner rapide · Mélanie dîne plus tard · journée Marc : sortie · Piscine',
    );
    expect(t).toContain('Exceptions : 1er et 3e vendredis → resto à deux\n');
  });

  it('courses et budget du foyer, règle de budget souple', () => {
    const t = prompt();
    expect(t).toContain('Magasin : Lidl · budget max : 110 € par semaine pour TOUT le foyer');
    expect(t).toContain('Vise ≤ 110 € par semaine');
    const sansBudget = prompt({ ...foyer(), budgetMax: undefined, magasin: undefined });
    expect(sansBudget).toContain('Magasin : supermarché habituel · pas de budget max fixé');
    expect(sansBudget).toContain("Reste économique et indique l'estimation hebdomadaire dans `remarques`.");
  });

  it('recettes du cycle précédent à éviter, préférences', () => {
    expect(prompt(foyer(), ['Poulet rôti', 'Curry'])).toContain('Recettes du cycle précédent : Poulet rôti, Curry');
    expect(prompt()).toContain('Recettes du cycle précédent : aucune (premier cycle)');
    expect(prompt()).toContain('Préférences : batch-friendly.');
  });

  it('embarque le contrat tel quel depuis types.ts', () => {
    const s = schemaContrat();
    expect(s.startsWith('export interface Macros')).toBe(true);
    expect(s).toContain('export interface CycleFichier');
    expect(s).not.toContain('export interface Cycle {');
    expect(prompt()).toContain(s);
  });
});
