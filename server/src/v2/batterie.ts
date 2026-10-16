import type { Menus, ProfilFoyer } from './contrat.js';
import { genererMenus, type AppelIA, type Jetons } from './generer.js';

// Batterie de profils difficiles (plan 2026-10-16-app-native §A.9) : obligatoire avant tout
// changement de prompt ou de modèle. Elle tourne contre l'API réelle, hors CI (payant) : voir
// batterie-cli.ts. Sortie : conformité au premier essai, coût et durée par génération.

/** Dollars par million de jetons. */
export interface Tarif {
  entree: number;
  sortie: number;
  cacheLu: number;
  cacheEcrit: number;
}

// Écriture du cache 5 min = 1,25 × l'entrée. À tenir à jour avec la grille d'Anthropic.
export const TARIFS: Record<string, Tarif> = {
  'claude-opus-5-5': { entree: 4, sortie: 20, cacheLu: 0.2, cacheEcrit: 5 },
};

/** Coût en dollars ; `entree` compte aussi les jetons lus et écrits en cache. */
export const cout = (j: Jetons, t: Tarif): number => {
  const lu = j.cacheLu ?? 0;
  const ecrit = j.cacheEcrit ?? 0;
  return ((j.entree - lu - ecrit) * t.entree + ecrit * t.cacheEcrit + lu * t.cacheLu + j.sortie * t.sortie) / 1e6;
};

const base: ProfilFoyer = {
  adultes: 2,
  enfants: 0,
  jourRituel: 6,
  trame: [
    { midi: 'libre', soir: 'pret' },
    { midi: 'box', soir: 'pret' },
    { midi: 'box', soir: 'frais' },
    { midi: 'box', soir: 'pret' },
    { midi: 'box', soir: 'frais' },
    { midi: 'dehors', soir: 'dehors' },
    { midi: 'libre', soir: 'frais' },
  ],
  tempsRituel: 90,
  tempsSoir: 20,
  regimes: [],
  eviter: [],
  allergenes: [],
  budget: { montant: 120, periode: 'semaine' },
};

export interface ProfilNomme {
  nom: string;
  profil: ProfilFoyer;
}

export const PROFILS_DIFFICILES: ProfilNomme[] = [
  { nom: 'keto + sans gluten', profil: { ...base, regimes: ['keto', 'sans-gluten'] } },
  { nom: 'végétarien', profil: { ...base, regimes: ['vegetarien'] } },
  { nom: 'allergie à l’arachide', profil: { ...base, enfants: 2, allergenes: ['arachides'] } },
  { nom: 'Rituel de 10 min', profil: { ...base, tempsRituel: 10 } },
  { nom: 'petit budget', profil: { ...base, enfants: 2, budget: { montant: 60, periode: 'semaine' } } },
];

export interface Mesure {
  profil: string;
  ok: boolean;
  /** Raison de l'échec ; `erreur-ia` = l'API a levé (réseau, 5xx). */
  raison?: string;
  appels: number;
  jetons: Jetons;
  dureeMs: number;
  /** Le menu obtenu, pour le relire à la main. */
  menus?: Menus;
}

/** Une génération par profil et par répétition, l'une après l'autre (le coût reste lisible). */
export const executerBatterie = async (
  appel: AppelIA,
  profils: readonly ProfilNomme[],
  repetitions: number,
  horloge: () => number = Date.now,
  suivi: (m: Mesure) => void = () => {},
): Promise<Mesure[]> => {
  const mesures: Mesure[] = [];
  for (let i = 0; i < repetitions; i++)
    for (const { nom, profil } of profils) {
      const debut = horloge();
      let m: Mesure;
      try {
        const r = await genererMenus(appel, profil);
        const commun = { profil: nom, appels: r.appels, jetons: r.jetons, dureeMs: horloge() - debut };
        m = r.ok ? { ...commun, ok: true, menus: r.menus } : { ...commun, ok: false, raison: r.raison };
      } catch {
        m = {
          profil: nom,
          ok: false,
          raison: 'erreur-ia',
          appels: 0,
          jetons: { entree: 0, sortie: 0 },
          dureeMs: horloge() - debut,
        };
      }
      mesures.push(m);
      suivi(m);
    }
  return mesures;
};

const dollars = (n: number) => `${n.toFixed(2).replace('.', ',')} $`;
const minutes = (ms: number) => `${(ms / 60_000).toFixed(1).replace('.', ',')} min`;
const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Tableau texte : par profil puis au total. `quotaJour` donne le pire cas mensuel d'un foyer. */
export const rapport = (mesures: readonly Mesure[], tarif: Tarif | undefined, quotaJour: number): string => {
  const groupes = new Map<string, Mesure[]>();
  for (const m of mesures) groupes.set(m.profil, [...(groupes.get(m.profil) ?? []), m]);
  const ligne = (nom: string, ms: readonly Mesure[]) => {
    const raisons = [...new Set(ms.filter((m) => !m.ok).map((m) => m.raison))].join(', ');
    const reussies = `${ms.filter((m) => m.ok).length}/${ms.length}${raisons ? ` (${raisons})` : ''}`;
    const prix = tarif ? dollars(moyenne(ms.map((m) => cout(m.jetons, tarif)))) : '—';
    const jetons = `${Math.round(moyenne(ms.map((m) => m.jetons.entree)))} / ${Math.round(moyenne(ms.map((m) => m.jetons.sortie)))}`;
    return [
      nom,
      ms.length,
      `${ms.filter((m) => m.ok && m.appels === 1).length}/${ms.length}`,
      reussies,
      prix,
      minutes(moyenne(ms.map((m) => m.dureeMs))),
      jetons,
    ].join(' | ');
  };
  const lignes = [
    'Profil | Générations | Conformes au 1er essai | Réussies | Coût moyen | Durée moyenne | Jetons entrée / sortie',
    ...[...groupes].map(([nom, ms]) => ligne(nom, ms)),
    ligne('Total', mesures),
    '',
  ];
  if (!tarif) lignes.push('Coût : tarif inconnu pour ce modèle (ajouter dans TARIFS).');
  else {
    const max = Math.max(0, ...mesures.map((m) => cout(m.jetons, tarif)));
    lignes.push(
      `Coût maximal d'une génération : ${dollars(max)}.`,
      `Pire cas d'un foyer au quota (${quotaJour}/jour pendant 30 jours) : ${dollars(max * quotaJour * 30)}.`,
    );
  }
  return lignes.join('\n');
};
