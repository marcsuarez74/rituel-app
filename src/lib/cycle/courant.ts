import type { CycleActif, Membre } from './etat';
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

// Le fichier du dépôt est anonymisé (alex, sam : adultes ; lou, noa : enfants) ;
// à l'écran, il parle du foyer — adultes puis enfants, dans l'ordre. Un rôle sans
// membre correspondant garde son nom anonyme. Remplacement en une passe : un
// prénom égal à un nom anonyme (« Sam ») ne se re-remplace pas.
const personnaliser = (contenu: string, membres: Membre[]): string => {
  const adultes = membres.filter((m) => m.type === 'adulte');
  const enfants = membres.filter((m) => m.type === 'enfant');
  const roles: Record<string, Membre | undefined> = { alex: adultes[0], sam: adultes[1], lou: enfants[0], noa: enfants[1] };
  return contenu
    .replace(/"(alex|sam|lou|noa)"/g, (brut, a: string) => (roles[a] ? JSON.stringify(roles[a].id) : brut))
    .replace(/\b(Alex|Sam|Lou|Noa)\b/g, (brut, n: string) => {
      const m = roles[n.toLowerCase()];
      return m ? JSON.stringify(m.prenom).slice(1, -1) : brut; // échappé : on écrit dans du JSON
    });
};

export const chargerCycleExemple = async (aujourdhui: string, jourCourses: Jour, membres: Membre[] = []): Promise<CycleActif> => {
  const { default: brut } = await import('../../assets/cycle-exemple.json?raw');
  const { cycle, erreurs } = importerCycle([{ nom: 'cycle-exemple.json', contenu: personnaliser(brut, membres) }]);
  if (!cycle) throw new Error(`Cycle d'exemple invalide : ${erreurs.join(' ; ')}`);
  const debut = debutParDefaut(aujourdhui, jourCourses);
  // id lié au début : les coches de l'exemple repartent à zéro chaque semaine.
  return { id: `exemple-${debut}`, numero: 1, debut, pauses: [], cycle };
};
