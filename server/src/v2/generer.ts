import { CONTRAT, type Menus, type ProfilFoyer, type Recette } from './contrat.js';
import { DEMANDE_MENUS, promptCorrection, promptProfil, promptRemplacement } from './prompt.js';
import { schemaRecette, schemaSortieMenus } from './schema.js';
import { validerMenus, type ErreurMenu } from './valider.js';

// Génération des menus (plan 2026-10-16-app-native §A.7) : l'IA écrit, le validateur tranche.
// Un menu non conforme n'est jamais renvoyé. Boucle : 2 corrections dans la même conversation,
// puis regénération du seul plat fautif (la bibliothèque de plats viendra à l'étape 8).

export interface MessageIA {
  role: 'user' | 'assistant';
  content: string;
}

/** Une requête au modèle ; le prompt fixe (system) et le schéma de sortie sont posés par l'adaptateur. */
export interface RequeteIA {
  format: 'menus' | 'recette';
  messages: MessageIA[];
}

export interface Jetons {
  entree: number;
  sortie: number;
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

const CORRECTIONS = 2;

const lireJson = (texte: string): unknown => {
  try {
    return JSON.parse(texte);
  } catch {
    return undefined;
  }
};

export const genererMenus = async (appel: AppelIA, profil: ProfilFoyer): Promise<ResultatGeneration> => {
  let appels = 0;
  const jetons: Jetons = { entree: 0, sortie: 0 };
  const echec = (raison: RaisonEchec, erreurs?: ErreurMenu[]): ResultatGeneration => ({
    ok: false,
    raison,
    appels,
    jetons,
    ...(erreurs ? { erreurs } : {}),
  });

  // Un appel compté ; null = sortie exploitable, sinon la raison de l'échec.
  const demander = async (requete: RequeteIA): Promise<{ texte: string } | { raison: RaisonEchec }> => {
    appels++;
    const r = await appel(requete);
    jetons.entree += r.jetons?.entree ?? 0;
    jetons.sortie += r.jetons?.sortie ?? 0;
    return r.fin === 'ok' ? { texte: r.texte } : { raison: r.fin };
  };

  const profilMsg: MessageIA = { role: 'user', content: `${promptProfil(profil)}\n\n${DEMANDE_MENUS}` };
  const messages: MessageIA[] = [profilMsg];
  let menus: Menus | null = null;
  let erreurs: ErreurMenu[] = [];

  for (let essai = 0; essai <= CORRECTIONS; essai++) {
    const r = await demander({ format: 'menus', messages });
    if ('raison' in r) return echec(r.raison);
    const sortie = schemaSortieMenus.safeParse(lireJson(r.texte));
    if (!sortie.success) return echec('sortie-invalide');
    menus = { contrat: CONTRAT, semaines: sortie.data.semaines as Menus['semaines'] };
    const v = validerMenus(menus, profil);
    if (v.erreurs.length === 0) return { ok: true, menus, estimation: v.estimation, appels, jetons };
    erreurs = v.erreurs;
    if (essai < CORRECTIONS) messages.push({ role: 'assistant', content: r.texte }, { role: 'user', content: promptCorrection(erreurs) });
  }
  if (!menus) return echec('non-conforme', erreurs);

  // Regénération plat par plat : seulement si chaque erreur vise un plat précis.
  if (erreurs.some((e) => e.semaine === undefined || e.recette === undefined)) return echec('non-conforme', erreurs);
  const fautifs = new Map<string, { semaine: number; recette: Recette; erreurs: ErreurMenu[] }>();
  for (const e of erreurs) {
    const recette = menus.semaines[e.semaine!]?.recettes.find((r) => r.titre === e.recette);
    if (!recette) return echec('non-conforme', erreurs);
    const cle = `${e.semaine}:${recette.id}`;
    const f = fautifs.get(cle) ?? { semaine: e.semaine!, recette, erreurs: [] };
    f.erreurs.push(e);
    fautifs.set(cle, f);
  }
  const titresPris = menus.semaines.flatMap((s) => s.recettes.map((r) => r.titre));
  for (const f of fautifs.values()) {
    const r = await demander({
      format: 'recette',
      messages: [{ role: 'user', content: `${promptProfil(profil)}\n\n${promptRemplacement(f.recette, f.erreurs, titresPris)}` }],
    });
    if ('raison' in r) return echec(r.raison);
    const sortie = schemaRecette.safeParse(lireJson(r.texte));
    if (!sortie.success) return echec('sortie-invalide');
    // id et origine restent ceux du plat remplacé : les jours et les étapes du Rituel y renvoient.
    Object.assign(f.recette, { ...sortie.data, id: f.recette.id, origine: f.recette.origine });
    titresPris.push(sortie.data.titre);
  }
  const v = validerMenus(menus, profil);
  return v.erreurs.length === 0
    ? { ok: true, menus, estimation: v.estimation, appels, jetons }
    : echec('non-conforme', v.erreurs);
};
