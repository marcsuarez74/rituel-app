import { describe, expect, it } from 'vitest';
import { foyerDuo } from './fabrique';
import { ajouterEnfant, changerJour, retirerMembre, resumeJour } from '../../../src/lib/cycle/foyer';

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
