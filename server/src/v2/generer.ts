import { CONTRAT, type EtapeRituel, type Menus, type ProfilFoyer, type Recette } from './contrat.js';
import {
  DEMANDE_MENUS,
  promptBibliotheque,
  promptCorrection,
  promptProfil,
  promptRemplacement,
  type ContexteRituel,
} from './prompt.js';
import { schemaSortieMenus, schemaSortiePlatFrais, schemaSortiePlatRituel, type RecetteSortie } from './schema.js';
import { normaliser, validerMenus, type ErreurMenu } from './valider.js';

// Génération des menus (plan 2026-10-16-app-native §A.7–A.8) : l'IA écrit, le validateur tranche.
// Un menu non conforme n'est jamais renvoyé. Boucle : 2 corrections dans la même conversation,
// puis regénération du seul plat fautif, puis, pour un plat frais, un plat de la bibliothèque.

export interface MessageIA {
  role: 'user' | 'assistant';
  content: string;
}

/** Une requête au modèle ; le prompt fixe (system) et le schéma de sortie sont posés par l'adaptateur. */
export interface RequeteIA {
  format: 'menus' | 'plat-frais' | 'plat-rituel';
  messages: MessageIA[];
}

export interface Jetons {
  /** Toute l'entrée, cache compris. */
  entree: number;
  sortie: number;
  cacheLu?: number;
  cacheEcrit?: number;
}

/** refus : le modèle (et son repli) a décliné ; coupe : sortie tronquée (max_tokens). */
export interface ReponseIA {
  fin: 'ok' | 'refus' | 'coupe';
  texte: string;
  jetons?: Jetons;
}

export type AppelIA = (requete: RequeteIA) => Promise<ReponseIA>;

export type RaisonEchec = 'refus' | 'coupe' | 'sortie-invalide' | 'non-conforme';

export type ResultatGeneration = { appels: number; jetons: Jetons } & (
  | { ok: true; menus: Menus; estimation: number[] }
  | { ok: false; raison: RaisonEchec; erreurs?: ErreurMenu[] }
);

type Etape = { menus: Menus } | { raison: RaisonEchec; erreurs?: ErreurMenu[] };

const CORRECTIONS = 2;

const lireJson = (texte: string): unknown => {
  try {
    return JSON.parse(texte);
  } catch {
    return undefined;
  }
};

/** Une référence à la bibliothèque devient le plat lui-même ; hors liste = message d'erreur. */
const deplier = (r: RecetteSortie, plats: ReadonlyMap<string, Recette>): Recette | string => {
  if (!('bibliotheque' in r)) return r;
  const p = plats.get(r.bibliotheque);
  return p ? { ...p, id: r.id } : `Plat de bibliothèque « ${r.bibliotheque} » inconnu : écris la recette en entier.`;
};

const parId = (plats: readonly Recette[]) => new Map(plats.map((p) => [p.id, p]));
const titresDuMenu = (m: Menus) => m.semaines.flatMap((s) => s.recettes.map((r) => r.titre));

/** Erreur → clé de comparaison : un plat par son message, une semaine (budget, durée) par son code. */
const cle = (e: ErreurMenu) => (e.recette ? e.message : `${e.code}:${e.semaine ?? ''}`);
/** Ce qui est apparu entre deux validations : « rien ne doit empirer ». */
const nouvelles = (avant: readonly ErreurMenu[], apres: readonly ErreurMenu[]) => {
  const vues = new Set(avant.map(cle));
  return apres.filter((e) => !vues.has(cle(e)));
};

const session = (appel: AppelIA) => {
  const s = {
    appels: 0,
    jetons: { entree: 0, sortie: 0 } as Jetons,
    async demander(requete: RequeteIA): Promise<{ texte: string } | { raison: RaisonEchec }> {
      s.appels++;
      const r = await appel(requete);
      s.jetons.entree += r.jetons?.entree ?? 0;
      s.jetons.sortie += r.jetons?.sortie ?? 0;
      s.jetons.cacheLu = (s.jetons.cacheLu ?? 0) + (r.jetons?.cacheLu ?? 0);
      s.jetons.cacheEcrit = (s.jetons.cacheEcrit ?? 0) + (r.jetons?.cacheEcrit ?? 0);
      return r.fin === 'ok' ? { texte: r.texte } : { raison: r.fin };
    },
    fin(e: Etape, profil: ProfilFoyer): ResultatGeneration {
      const { appels, jetons } = s;
      if ('raison' in e)
        return {
          ok: false,
          raison: e.raison,
          appels,
          jetons,
          ...(e.erreurs ? { erreurs: e.erreurs } : {}),
        };
      const v = validerMenus(e.menus, profil);
      return {
        ok: true,
        menus: e.menus,
        estimation: v.estimation,
        appels,
        jetons,
      };
    },
  };
  return s;
};
type Session = ReturnType<typeof session>;

/** Remplace le plat `id` de la semaine par l'IA ; un plat du Rituel réécrit aussi les étapes.
 * `refus` liste les erreurs qui empêchent d'accepter un candidat (vide = accepté). */
const regenerer = async (
  ia: Session,
  profil: ProfilFoyer,
  menus: Menus,
  semaine: number,
  id: string,
  motifs: readonly string[],
  plats: readonly Recette[],
  essais: number,
  refus: (candidat: Menus) => ErreurMenu[],
): Promise<Etape> => {
  const s = menus.semaines[semaine]!;
  const ancien = s.recettes.find((r) => r.id === id)!;
  const rituel = ancien.origine === 'rituel';
  const titresPris = titresDuMenu(menus);
  const pris = new Set(titresPris.map(normaliser));
  const proposes = plats.filter((p) => p.origine === ancien.origine && !pris.has(normaliser(p.titre)));
  const contexte: ContexteRituel | undefined = rituel
    ? {
        etapes: s.rituel,
        autres: s.recettes.filter((r) => r.origine === 'rituel' && r.id !== id),
      }
    : undefined;
  const messages: MessageIA[] = [
    {
      role: 'user',
      content: [
        promptProfil(profil),
        promptBibliotheque(proposes),
        promptRemplacement(ancien, motifs, titresPris, contexte),
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];
  let erreurs: ErreurMenu[] = [];
  for (let essai = 0; essai < essais; essai++) {
    const r = await ia.demander({
      format: rituel ? 'plat-rituel' : 'plat-frais',
      messages,
    });
    if ('raison' in r) return r;
    const json = lireJson(r.texte);
    const sortie = rituel ? schemaSortiePlatRituel.safeParse(json) : schemaSortiePlatFrais.safeParse(json);
    if (!sortie.success) return { raison: 'sortie-invalide' };
    const { recette, rituel: etapes } = sortie.data as {
      recette: RecetteSortie;
      rituel?: EtapeRituel[];
    };
    const nouveau = deplier(recette, parId(proposes));
    if (typeof nouveau === 'string') erreurs = [{ code: 'structure', message: nouveau, semaine }];
    else {
      const candidat = remplacer(menus, semaine, ancien, nouveau, etapes);
      erreurs = refus(candidat);
      if (erreurs.length === 0) return { menus: candidat };
    }
    if (essai < essais - 1)
      messages.push({ role: 'assistant', content: r.texte }, { role: 'user', content: promptCorrection(erreurs) });
  }
  return { raison: 'non-conforme', erreurs };
};

/** Copie du menu où `nouveau` prend la place d'`ancien` : même id et même origine, car les jours
 * et les étapes du Rituel y renvoient. */
const remplacer = (menus: Menus, semaine: number, ancien: Recette, nouveau: Recette, rituel?: EtapeRituel[]): Menus => {
  const copie = structuredClone(menus);
  const s = copie.semaines[semaine]!;
  const { bibliotheque, ...contenu } = nouveau;
  s.recettes = s.recettes.map((r) =>
    r.id === ancien.id
      ? {
          ...contenu,
          id: ancien.id,
          origine: ancien.origine,
          ...(bibliotheque ? { bibliotheque } : {}),
        }
      : r,
  );
  if (rituel) s.rituel = rituel;
  return copie;
};

/** Dernier recours, sans IA : un plat frais de la bibliothèque à la place d'un plat frais fautif. */
const secours = (
  menus: Menus,
  semaine: number,
  id: string,
  plats: readonly Recette[],
  refus: (candidat: Menus) => ErreurMenu[],
): Menus | null => {
  const ancien = menus.semaines[semaine]?.recettes.find((r) => r.id === id);
  if (ancien?.origine !== 'frais') return null;
  const pris = new Set(titresDuMenu(menus).map(normaliser));
  for (const p of plats) {
    if (p.origine !== 'frais' || pris.has(normaliser(p.titre))) continue;
    const candidat = remplacer(menus, semaine, ancien, p);
    if (refus(candidat).length === 0) return candidat;
  }
  return null;
};

/** Les plats visés par des erreurs, par semaine ; null si une erreur ne vise aucun plat précis. */
const platsFautifs = (menus: Menus, erreurs: readonly ErreurMenu[]) => {
  const fautifs = new Map<string, { semaine: number; id: string; erreurs: ErreurMenu[] }>();
  for (const e of erreurs) {
    if (e.semaine === undefined || e.recette === undefined) return null;
    const r = menus.semaines[e.semaine]?.recettes.find((x) => x.titre === e.recette);
    if (!r) return null;
    const k = `${e.semaine}:${r.id}`;
    const f = fautifs.get(k) ?? { semaine: e.semaine, id: r.id, erreurs: [] };
    f.erreurs.push(e);
    fautifs.set(k, f);
  }
  return [...fautifs.values()];
};

/** Compose 4 semaines ; `plats` = plats compatibles de la bibliothèque, que l'IA peut reprendre. */
export const genererMenus = async (
  appel: AppelIA,
  profil: ProfilFoyer,
  plats: readonly Recette[] = [],
): Promise<ResultatGeneration> => {
  const ia = session(appel);
  const proposes = parId(plats);
  const messages: MessageIA[] = [
    {
      role: 'user',
      content: [promptProfil(profil), promptBibliotheque(plats), DEMANDE_MENUS].filter(Boolean).join('\n\n'),
    },
  ];
  let menus: Menus | null = null;
  let erreurs: ErreurMenu[] = [];

  for (let essai = 0; essai <= CORRECTIONS; essai++) {
    const r = await ia.demander({ format: 'menus', messages });
    if ('raison' in r) return ia.fin(r, profil);
    const sortie = schemaSortieMenus.safeParse(lireJson(r.texte));
    if (!sortie.success) return ia.fin({ raison: 'sortie-invalide' }, profil);
    const references: ErreurMenu[] = [];
    menus = {
      contrat: CONTRAT,
      semaines: sortie.data.semaines.map((s, semaine) => ({
        ...s,
        recettes: s.recettes.flatMap((x) => {
          const d = deplier(x, proposes);
          if (typeof d !== 'string') return [d];
          references.push({
            code: 'structure',
            message: `Semaine ${semaine + 1} : ${d}`,
            semaine,
          });
          return [];
        }),
      })),
    };
    erreurs = [...references, ...validerMenus(menus, profil).erreurs];
    if (erreurs.length === 0) return ia.fin({ menus }, profil);
    if (essai < CORRECTIONS)
      messages.push({ role: 'assistant', content: r.texte }, { role: 'user', content: promptCorrection(erreurs) });
  }

  // Regénération plat par plat : seulement si chaque erreur vise un plat précis.
  const fautifs = menus && platsFautifs(menus, erreurs);
  if (!menus || !fautifs) return ia.fin({ raison: 'non-conforme', erreurs }, profil);
  for (const f of fautifs) {
    const e = await regenerer(
      ia,
      profil,
      menus,
      f.semaine,
      f.id,
      f.erreurs.map((x) => x.message),
      plats,
      1,
      () => [],
    );
    if (!('menus' in e)) return ia.fin(e, profil);
    menus = e.menus;
  }
  erreurs = validerMenus(menus, profil).erreurs;
  if (erreurs.length === 0) return ia.fin({ menus }, profil);

  // Dernier recours : plats frais de la bibliothèque.
  for (const f of platsFautifs(menus, erreurs) ?? []) {
    const avant = validerMenus(menus, profil).erreurs;
    const titre = menus.semaines[f.semaine]!.recettes.find((r) => r.id === f.id)!.titre;
    const m = secours(menus, f.semaine, f.id, plats, (c) =>
      nouvelles(
        avant.filter((x) => x.recette !== titre),
        validerMenus(c, profil).erreurs,
      ),
    );
    if (m) menus = m;
  }
  erreurs = validerMenus(menus, profil).erreurs;
  return ia.fin(erreurs.length === 0 ? { menus } : { raison: 'non-conforme', erreurs }, profil);
};

/** « Remplacer ce plat » : un autre plat à la place de `id` (semaine `semaine`). Accepté si le
 * nouveau plat est conforme et que rien n'empire ailleurs ; le reste du menu ne change pas. */
export const remplacerPlat = async (
  appel: AppelIA,
  profil: ProfilFoyer,
  menus: Menus,
  semaine: number,
  id: string,
  plats: readonly Recette[] = [],
): Promise<ResultatGeneration> => {
  const ia = session(appel);
  const ancien = menus.semaines[semaine]?.recettes.find((r) => r.id === id);
  if (!ancien) throw new Error(`remplacerPlat : plat « ${id} » absent de la semaine ${semaine}`);
  // Les erreurs du plat remplacé disparaissent avec lui : elles ne comptent pas comme « avant ».
  const avant = validerMenus(menus, profil).erreurs.filter((e) => e.recette !== ancien.titre);
  const refus = (c: Menus) => nouvelles(avant, validerMenus(c, profil).erreurs);
  const motifs = ['Le foyer veut un autre plat à la place de celui-ci.'];
  const e = await regenerer(ia, profil, menus, semaine, id, motifs, plats, 1 + CORRECTIONS, refus);
  if ('menus' in e || e.raison !== 'non-conforme') return ia.fin(e, profil);
  const m = secours(menus, semaine, id, plats, refus);
  return ia.fin(m ? { menus: m } : e, profil);
};
