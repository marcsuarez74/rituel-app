import { describe, expect, it } from 'vitest';
import { type CycleActif, foyerParDefaut } from '../../../src/lib/cycle/etat';
import { ajouterPause, changerDebut, demarrer, generationOuverte, messagePourClaude, relancer } from '../../../src/lib/cycle/monCycle';
import { importerCycle } from '../../../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './fabrique';

const cycle = () => importerCycle(enFichiers(quatreFichiers())).cycle!;
const actif = (extra: Partial<CycleActif> = {}): CycleActif => ({ id: 'c1', numero: 2, debut: '2026-10-03', pauses: [], cycle: cycle(), ...extra });

describe('Mon cycle', () => {
  it('verrou : génération fermée tant que le cycle n’est pas fini', () => {
    expect(generationOuverte(null, '2026-10-07')).toBe(true);
    expect(generationOuverte(actif(), '2026-10-30')).toBe(false); // dernier jour de la semaine 4
    expect(generationOuverte(actif(), '2026-10-31')).toBe(true);
    expect(generationOuverte(actif({ pauses: [1] }), '2026-10-31')).toBe(false); // la pause décale la fin
  });

  it('démarrer : numéro suivant, début choisi, sans pause', () => {
    expect(demarrer(cycle(), actif(), '2026-10-31', 'n1')).toMatchObject({ id: 'n1', numero: 3, debut: '2026-10-31', pauses: [] });
    expect(demarrer(cycle(), null, '2026-10-10', 'n1').numero).toBe(1);
  });

  it('relancer : même contenu, numéro suivant, au prochain jour des courses, lien vers l’ancien', () => {
    const r = relancer(actif(), '2026-11-02', 'samedi', 'n2');
    expect(r).toMatchObject({ id: 'n2', numero: 3, debut: '2026-11-07', pauses: [], relanceDe: 'c1' });
    expect(r.cycle).toEqual(actif().cycle);
  });

  it('changer la date de début : passé autorisé, le jour des courses du foyer suit, ids inchangés', () => {
    const foyer = foyerParDefaut(null); // courses le samedi
    const { actif: a, foyer: f } = changerDebut(actif(), foyer, '2026-09-30'); // un mercredi
    expect(a).toMatchObject({ id: 'c1', numero: 2, debut: '2026-09-30' });
    expect(f.jourCourses).toBe('mercredi');
    expect(changerDebut(actif(), foyer, '2026-09-26').foyer).toBe(foyer); // déjà un samedi : inchangé
  });

  it('pause : une semaine après la semaine en cours, une seule fois', () => {
    expect(ajouterPause(actif(), 1).pauses).toEqual([1]);
    expect(ajouterPause(actif({ pauses: [1] }), 1).pauses).toEqual([1]);
  });

  it('message pour Claude : erreurs puis alertes, prêt à recoller', () => {
    const m = messagePourClaude(['menu-B.json · Menu B manquant.'], ['Menu D : seulement 4 dîners propres.']);
    expect(m).toContain("L'application a refusé l'import");
    expect(m).toContain('- menu-B.json · Menu B manquant.');
    expect(m).toContain('- Menu D : seulement 4 dîners propres.');
    expect(m).toContain('Renvoie uniquement les fichiers corrigés');
  });
});
