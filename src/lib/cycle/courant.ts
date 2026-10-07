import type { CycleActif } from './etat';
import { ajouterJours, prochainJour, type PositionCycle } from './calendrier';
import type { Jour } from './types';
import { importerCycle } from './valider';

// Cycle affiché quand aucun n'est importé : le cycle d'exemple, chargé à la
// demande (chunk séparé, ~160 Ko de JSON) et gardé en mémoire seulement.

// Dernier jour des courses passé, aujourd'hui compris.
export const debutParDefaut = (aujourdhui: string, jourCourses: Jour): string =>
  prochainJour(ajouterJours(aujourdhui, -6), jourCourses);

// Semaine montrée par défaut dans Menu / Courses / Rituel.
export const semaineParDefaut = (p: PositionCycle): number =>
  p.etat === 'semaine' ? p.index : p.etat === 'pause' ? p.apres : p.etat === 'termine' ? 3 : 0;

// Le fichier du dépôt est anonymisé ; à l'écran, il parle du foyer.
const MEMBRES_EXEMPLE: Array<[string, string, string]> = [
  ['alex', 'marc', 'Marc'],
  ['sam', 'melanie', 'Mélanie'],
  ['lou', 'maelle', 'Maëlle'],
  ['noa', 'maxine', 'Maxine'],
];

const personnaliser = (contenu: string): string =>
  MEMBRES_EXEMPLE.reduce(
    (s, [anonyme, id, prenom]) =>
      s
        .replaceAll(`"${anonyme}"`, `"${id}"`)
        .replace(new RegExp(`\\b${anonyme[0].toUpperCase()}${anonyme.slice(1)}\\b`, 'g'), prenom),
    contenu,
  );

export const chargerCycleExemple = async (aujourdhui: string, jourCourses: Jour): Promise<CycleActif> => {
  const { default: brut } = await import('../../assets/cycle-exemple.json?raw');
  const { cycle, erreurs } = importerCycle([{ nom: 'cycle-exemple.json', contenu: personnaliser(brut) }]);
  if (!cycle) throw new Error(`Cycle d'exemple invalide : ${erreurs.join(' ; ')}`);
  const debut = debutParDefaut(aujourdhui, jourCourses);
  // id lié au début : les coches de l'exemple repartent à zéro chaque semaine.
  return { id: `exemple-${debut}`, numero: 1, debut, pauses: [], cycle };
};
