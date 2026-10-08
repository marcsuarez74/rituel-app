import { describe, expect, it } from 'vitest';
import { foyerDuo } from './fabrique';
import { ajouterAdulte, ajouterEnfant, changerJour, rattacher, retirerMembre, resumeJour } from '../../../src/lib/cycle/foyer';
import { foyerParDefaut } from '../../../src/lib/cycle/etat';
import type { UserProfile } from '../../../src/lib/model';

describe('réglages du foyer', () => {
  it('ajouter un enfant : id slug, déjeuner « dehors » chaque jour ; doublon ignoré', () => {
    const f = ajouterEnfant(foyerDuo(), ' Maëlle ');
    expect(f.membres.at(-1)).toEqual({ id: 'maelle', prenom: 'Maëlle', type: 'enfant', suivi: false });
    expect(f.semaine.mardi.dejeuner).toEqual({ marc: 'maison', melanie: 'maison', maelle: 'dehors' });
    expect(ajouterEnfant(f, 'maelle')).toBe(f);
    expect(ajouterEnfant(f, '  ')).toBe(f);
  });

  it('retirer un membre : disparaît des jours (déjeuner, plus tard, journée)', () => {
    let f = ajouterEnfant(foyerDuo(), 'Maxine');
    f = changerJour(f, 'lundi', { plusTard: ['maxine'], journee: { maxine: 'sortie' } });
    f = retirerMembre(f, 'maxine');
    expect(f.membres.map((m) => m.id)).toEqual(['marc', 'melanie']);
    expect(f.semaine.lundi).toEqual({ dejeuner: { marc: 'maison', melanie: 'maison' }, diner: 'famille', plusTard: [], journee: {} });
  });

  it('résumé d’un jour pour la ligne repliée', () => {
    const f = changerJour(foyerDuo(), 'lundi', { dejeuner: { marc: 'box', melanie: 'box' }, diner: 'rapide', plusTard: ['melanie'] });
    expect(resumeJour(f, 'lundi')).toBe('dîner rapide · 2 box · 1 plus tard');
    expect(resumeJour(f, 'mardi')).toBe('dîner famille');
  });
});

const jean: UserProfile = { id: 'jean-01ab', prenom: 'Jean', objectif: { type: 'maintien' }, complements: [], regime: 'aucun' };
const therese: UserProfile = { ...jean, id: 'therese-9c9c', prenom: 'Thérèse' };

describe('foyer à plusieurs téléphones', () => {
  it('ajouter un adulte (le/la partenaire) : sans téléphone, non suivi tant qu’il/elle n’a pas rejoint', () => {
    const f = ajouterAdulte(foyerParDefaut(jean), ' Thérèse ', () => '3f9a');
    expect(f.membres.at(-1)).toEqual({ id: 'therese-3f9a', prenom: 'Thérèse', type: 'adulte', suivi: false });
    expect(f.semaine.lundi.dejeuner['therese-3f9a']).toBe('maison');
    expect(ajouterAdulte(f, '  ')).toBe(f);
  });

  it('rattacher : même prénom (casse / accents ignorés) parmi les adultes sans téléphone → c’est moi', () => {
    const f = ajouterAdulte(foyerParDefaut(jean), 'Thérèse', () => '3f9a');
    expect(rattacher(f, { ...therese, prenom: 'therese' })).toEqual({ etat: 'auto', membre: f.membres[1] });
  });

  it('rattacher : prénom différent → question, avec les adultes sans téléphone', () => {
    const f = ajouterAdulte(foyerParDefaut(jean), 'Thérèse', () => '3f9a');
    expect(rattacher(f, { ...therese, prenom: 'Tess' })).toEqual({ etat: 'question', candidats: [f.membres[1]] });
  });

  it('rattacher : personne en attente → nouvel adulte ; déjà membre → rien à faire', () => {
    expect(rattacher(foyerParDefaut(jean), therese)).toEqual({ etat: 'nouveau' });
    expect(rattacher(foyerParDefaut(therese), therese)).toEqual({ etat: 'deja' });
  });
});
