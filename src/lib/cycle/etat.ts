import { PROFILS_META, type ProfileKey, type Regime, type UserProfile } from '../model';
import { empilerMutation } from '../sync/outbox';
import { FICHIER, type Forme, liste, objet, opt, verifierForme } from './schema';
import type { Cycle, Jour, MembreId } from './types';
import { JOURS } from './types';

// État v2 sur le téléphone (spec 2026-10-07 §4, §7, §8) : réglages du foyer,
// cycle en cours, reports. Même règles que storage.ts : lecture gardée (une
// donnée corrompue est réparée : warn + remove + fallback), clé absente
// silencieuse, toute écriture empile une mutation de sync (table `etat`).

export interface Membre {
  id: MembreId;
  prenom: string;
  type: 'adulte' | 'enfant';
  suivi: boolean; // a un profil (poids, séances, macros)
  regime?: Regime;
}

export interface JourType {
  dejeuner: Record<MembreId, 'box' | 'maison' | 'dehors'>;
  diner: 'famille' | 'rapide' | 'leger';
  plusTard: MembreId[]; // dînent décalé (portion réchauffée)
  journee?: Record<MembreId, 'standard' | 'sortie' | 'repos' | 'alternee'>;
  note?: string;
}

export interface ExceptionFoyer {
  regle: string; // « 1er et 3e vendredis »
  effet: string; // « resto à deux : dîner simple pour les filles »
  actif: boolean;
}

export interface ReglagesFoyer {
  version: 3;
  membres: Membre[];
  jourCourses: Jour;
  jourRituel: Jour;
  semaine: Record<Jour, JourType>;
  exceptions: ExceptionFoyer[];
  magasin?: string;
  budgetMax?: number; // € / semaine, foyer entier
}

export interface CycleActif {
  id: string;
  numero: number; // « Cycle N »
  debut: string; // AAAA-MM-JJ = jour de courses de la semaine 1
  pauses: number[]; // index de semaine (0-3) après lesquels une pause est insérée
  cycle: Cycle;
  relanceDe?: string;
}

export interface Report {
  repas: string; // id de coche du repas d'origine (stable)
  vers: { semaine: number; jour?: Jour } | 'abandon'; // sans jour : « reporté », à placer
  cree: string; // ISO
}

const FOYER_KEY = 'sportapp:foyer';
const CYCLE_KEY = 'sportapp:cycle';
const PRECEDENT_KEY = 'sportapp:cycle:precedent';
const V2_KEY = 'sportapp:v2';
const reportsKey = (cycleId: string) => `sportapp:reports:${cycleId}`;

// Clés de la table de sync `etat` (une ligne par clé, dernier écrit gagne).
export const CLE_FOYER = 'foyer';
export const CLE_CYCLE = 'cycle';
export const CLE_PRECEDENT = 'cycle-precedent';
export const cleReports = (cycleId: string) => `reports:${cycleId}`;

// Les coches du cycle réutilisent getChecks/setCheck (et la table `checks`).
export const semaineCoches = (cycleId: string, n: number): string => `cycle:${cycleId}:${n}`;

// ---- Formes (mini-schéma partagé avec l'import) ----

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const JOUR: Forme = { parmi: JOURS };

const MEMBRE = objet({
  id: 'texte',
  prenom: 'texte',
  type: { parmi: ['adulte', 'enfant'] },
  suivi: 'booleen',
  regime: opt({ parmi: ['keto', 'vegetarien', 'vegan', 'sans-gluten', 'aucun'] }),
});

const JOUR_TYPE = objet({
  dejeuner: { dico: { parmi: ['box', 'maison', 'dehors'] } },
  diner: { parmi: ['famille', 'rapide', 'leger'] },
  plusTard: liste('texte'),
  journee: opt({ dico: { parmi: ['standard', 'sortie', 'repos', 'alternee'] } }),
  note: opt('texte'),
});

const FOYER = objet({
  membres: liste(MEMBRE),
  jourCourses: JOUR,
  jourRituel: JOUR,
  semaine: objet(Object.fromEntries(JOURS.map((j) => [j, JOUR_TYPE]))),
  exceptions: liste(objet({ regle: 'texte', effet: 'texte', actif: 'booleen' })),
  magasin: opt('texte'),
  budgetMax: opt('nombre'),
});

const REPORT = objet({
  repas: 'texte',
  vers: { ou: [{ parmi: ['abandon'] }, objet({ semaine: 'nombre', jour: opt(JOUR) })] },
  cree: 'texte',
});

const estObjet = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export const estFoyerValide = (v: unknown): v is ReglagesFoyer =>
  estObjet(v) && v.version === 3 && verifierForme(v, FOYER, '', 1).length === 0;

export const estCycleActifValide = (v: unknown): v is CycleActif =>
  estObjet(v) &&
  typeof v.id === 'string' &&
  !!v.id &&
  typeof v.numero === 'number' &&
  Number.isInteger(v.numero) &&
  v.numero >= 1 &&
  typeof v.debut === 'string' &&
  ISO.test(v.debut) &&
  Array.isArray(v.pauses) &&
  v.pauses.every((p) => Number.isInteger(p) && p >= 0 && p <= 3) &&
  (v.relanceDe === undefined || typeof v.relanceDe === 'string') &&
  estObjet(v.cycle) &&
  Array.isArray(v.cycle.menus) &&
  v.cycle.menus.length === 4 &&
  estObjet(v.cycle.rituel) &&
  Array.isArray(v.cycle.fixes) &&
  Array.isArray(v.cycle.remarques) &&
  verifierForme(v.cycle, FICHIER, '', 1).length === 0;

export const estReportValide = (v: unknown): v is Report => verifierForme(v, REPORT, '', 1).length === 0;

export const estPrecedentValide = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

// ---- Lecture gardée / écriture + sync ----

const lire = <T>(cle: string, garde: (v: unknown) => v is T, nom: string): T | null => {
  const raw = localStorage.getItem(cle);
  if (raw === null) return null;
  let v: unknown = null;
  try {
    v = JSON.parse(raw);
  } catch {
    /* traité comme une forme illégale */
  }
  if (garde(v)) return v;
  console.warn(`${nom} corrompu ignoré : ${cle}`);
  localStorage.removeItem(cle);
  return null;
};

const ecrire = (cle: string, cleSync: string, valeur: unknown): void => {
  localStorage.setItem(cle, JSON.stringify(valeur));
  empilerMutation({ op: 'upsert', table: 'etat', key: { cle: cleSync }, payload: { valeur } });
};

export const loadFoyer = (): ReglagesFoyer | null => lire(FOYER_KEY, estFoyerValide, 'Foyer');
export const saveFoyer = (f: ReglagesFoyer): void => ecrire(FOYER_KEY, CLE_FOYER, f);

// Foyer tant que rien n'est saisi : les 2 adultes suivis, tout « maison »,
// dîner « famille ». Prénom, régime, magasin et budget viennent du profil actif.
export const foyerParDefaut = (profil: UserProfile | null): ReglagesFoyer => {
  const membres: Membre[] = (['marc', 'melanie'] as ProfileKey[]).map((id) => {
    const actif = profil?.id === id ? profil : null;
    return {
      id,
      prenom: actif?.prenom?.trim() || PROFILS_META[id].nom,
      type: 'adulte',
      suivi: true,
      ...(actif && actif.regime !== 'aucun' ? { regime: actif.regime } : {}),
    };
  });
  const jour = (): JourType => ({
    dejeuner: Object.fromEntries(membres.map((m) => [m.id, 'maison' as const])),
    diner: 'famille',
    plusTard: [],
  });
  return {
    version: 3,
    membres,
    jourCourses: 'samedi',
    jourRituel: 'dimanche',
    semaine: Object.fromEntries(JOURS.map((j) => [j, jour()])) as Record<Jour, JourType>,
    exceptions: [],
    ...(profil?.magasin ? { magasin: profil.magasin } : {}),
    ...(profil?.budgetMax ? { budgetMax: profil.budgetMax } : {}),
  };
};

export const loadCycle = (): CycleActif | null => lire(CYCLE_KEY, estCycleActifValide, 'Cycle');
export const saveCycle = (c: CycleActif): void => ecrire(CYCLE_KEY, CLE_CYCLE, c);
export const effacerCycle = (): void => {
  localStorage.removeItem(CYCLE_KEY);
  empilerMutation({ op: 'delete', table: 'etat', key: { cle: CLE_CYCLE } });
};

export const loadPrecedent = (): string[] => lire(PRECEDENT_KEY, estPrecedentValide, 'Cycle précédent') ?? [];
export const savePrecedent = (noms: string[]): void => ecrire(PRECEDENT_KEY, CLE_PRECEDENT, noms);

// Garde PAR ENTRÉE : un report illégal est écarté, les autres gardés.
export const getReports = (cycleId: string): Report[] => {
  const liste = lire(reportsKey(cycleId), Array.isArray, 'Reports') as unknown[] | null;
  if (!liste) return [];
  const ok = liste.filter(estReportValide);
  if (ok.length !== liste.length) console.warn(`Report illégal ignoré : ${reportsKey(cycleId)}`);
  return ok;
};
export const saveReports = (cycleId: string, r: Report[]): void => ecrire(reportsKey(cycleId), cleReports(cycleId), r);

export const estV2 = (): boolean => localStorage.getItem(V2_KEY) !== null;

// Remise à zéro de la 2.0 (une fois) : semaines .md, leurs coches et la
// sélection disparaissent ; profil, pesées, dépenses, sync et coches du cycle
// restent. Retourne true si elle a eu lieu.
export const migrerV2 = (): boolean => {
  if (estV2()) return false;
  const aEffacer: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('sportapp:checks:') && !k.startsWith('sportapp:checks:cycle:')) aEffacer.push(k);
  }
  for (const k of [...aEffacer, 'sportapp:week', 'sportapp:weeks', 'sportapp:selection']) localStorage.removeItem(k);
  localStorage.setItem(V2_KEY, '1');
  return true;
};
