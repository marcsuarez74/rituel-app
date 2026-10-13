import { normaliserFichier } from './alias';
import { estimerSemaine } from './budget';
import { FICHIER, verifierForme } from './schema';
import type { Cycle, CycleFichier, Jour, MenuSemaine, MembreId, Recette, Repas } from './types';
import { JOURS, LETTRES } from './types';

// Import d'un cycle généré par Claude (spec 2026-10-07 §6) : lecture des
// fichiers, vérification de forme, fusion, règles. Les ERREURS bloquent le
// démarrage du cycle ; les ALERTES s'affichent dans l'aperçu.

export interface MembreValidation {
  id: MembreId;
  suivi: boolean;
  regime?: string;
}

export interface ContexteValidation {
  membres?: MembreValidation[]; // sans foyer : pas de contrôle des membres
  budgetMax?: number;
  seuilKetoG?: number; // glucides nets / jour, défaut 30
  recettesPrecedentes?: string[];
  jourRituel?: Jour; // sans foyer : pas de contrôle de conservation frigo
}

/** Alertes classées par ce que l'utilisateur a à en faire. */
export interface AlertesClassees {
  /** Règles de l'app : peuvent demander une action (budget, glucides…). */
  actions: string[];
  /** Remarques de l'IA, dédoublonnées : informatives. */
  notes: string[];
  /** Conversions d'alias déjà appliquées par l'app : jamais listées. */
  techniques: string[];
  /** Nombre d'ingrédients rangés/convertis automatiquement. */
  nbCorriges: number;
}

export interface ResultatImport {
  cycle: Cycle | null;
  erreurs: string[];
  /** Toutes les alertes à plat (copie pour l'IA, compatibilité). */
  alertes: string[];
  classees: AlertesClassees;
}

const VIDE: AlertesClassees = { actions: [], notes: [], techniques: [], nbCorriges: 0 };

const empreinte = (t: string): Set<string> =>
  new Set(
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

const quasiIdentiques = (a: Set<string>, b: Set<string>): boolean => {
  if (a.size === 0 || b.size === 0) return a.size === b.size;
  let commun = 0;
  for (const m of a) if (b.has(m)) commun += 1;
  return commun / (a.size + b.size - commun) >= 0.85;
};

/** Même texte (à la casse, aux accents et à la ponctuation près) ou quasi identique → une seule. */
export const dedoublonnerNotes = (notes: string[]): string[] => {
  const gardees: { texte: string; emp: Set<string> }[] = [];
  for (const texte of notes) {
    const emp = empreinte(texte);
    if (!gardees.some((g) => quasiIdentiques(g.emp, emp))) gardees.push({ texte, emp });
  }
  return gardees.map((g) => g.texte);
};

const SEUIL_KETO = 30;
const DINERS_PROPRES_MIN = 5;
const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Lu = { fichier?: CycleFichier; erreurs: string[]; alertes: string[]; nbCorriges: number };
const lire = (nom: string, contenu: string): Lu => {
  let brut: unknown;
  try {
    brut = JSON.parse(contenu);
  } catch {
    return { erreurs: [`${nom} : JSON illisible (le fichier est incomplet ou mal copié).`], alertes: [], nbCorriges: 0 };
  }
  const o = brut as Partial<CycleFichier> | null;
  if (o?.format !== 'rituel-cycle') return { erreurs: [`${nom} · format : « rituel-cycle » attendu.`], alertes: [], nbCorriges: 0 };
  if (o.version !== 2) return { erreurs: [`${nom} · version : 2 attendu (reçu ${String(o.version)}).`], alertes: [], nbCorriges: 0 };
  const norm = normaliserFichier(brut, nom);
  // Rayons/unités inconnus : déjà signalés par `norm`, groupés par valeur.
  const forme = verifierForme(brut, FICHIER, '', 500)
    .filter((e) => !/\.(rayon|unite) : /.test(e))
    .slice(0, 20)
    .map((e) => `${nom} · ${e}.`);
  const erreurs = [...norm.erreurs, ...forme];
  return erreurs.length
    ? { erreurs, alertes: norm.alertes, nbCorriges: norm.nbCorriges }
    : { fichier: brut as CycleFichier, erreurs: [], alertes: norm.alertes, nbCorriges: norm.nbCorriges };
};

const fusionner = (fichiers: CycleFichier[]): { cycle?: Cycle; erreurs: string[] } => {
  const erreurs: string[] = [];
  const menus: MenuSemaine[] = [];
  for (const l of LETTRES) {
    const trouves = fichiers.flatMap((f) => f.menus).filter((m) => m.lettre === l);
    if (trouves.length === 0) erreurs.push(`Menu ${l} manquant.`);
    else if (trouves.length > 1) erreurs.push(`Menu ${l} présent plusieurs fois.`);
    else menus.push(trouves[0]);
  }
  const recettes = new Map<string, Recette>();
  for (const r of fichiers.flatMap((f) => f.recettes)) {
    const deja = recettes.get(r.id);
    if (!deja) recettes.set(r.id, r);
    else if (!egal(deja, r)) erreurs.push(`Recette « ${r.id} » définie deux fois avec un contenu différent.`);
  }
  const rituels = fichiers.flatMap((f) => (f.rituel ? [f.rituel] : []));
  if (rituels.length === 0) erreurs.push('Rituel du dimanche absent.');
  else if (rituels.some((r) => !egal(r, rituels[0])))
    erreurs.push('Plusieurs rituels différents : il en faut un seul pour le cycle.');
  if (erreurs.length) return { erreurs };
  const fixes = fichiers.flatMap((f) => f.fixes ?? []).filter((x, i, t) => t.findIndex((y) => egal(x, y)) === i);
  return {
    erreurs,
    cycle: {
      titre: fichiers[0].titre,
      rituel: rituels[0],
      menus,
      recettes: [...recettes.values()],
      fixes,
      remarques: fichiers.flatMap((f) => f.remarques ?? []),
    },
  };
};

const mange = (repas: Repas, m: MembreId) => repas.pour === 'famille' || repas.pour.includes(m);

const regles = (cycle: Cycle, ctx: ContexteValidation): string[] => {
  const erreurs = new Set<string>();
  const recettes = new Map(cycle.recettes.map((r) => [r.id, r]));
  const idsRituel = new Set(cycle.rituel.etapes.map((e) => e.id));

  for (const e of cycle.rituel.etapes)
    if (e.recette && !recettes.has(e.recette))
      erreurs.add(`Rituel, étape « ${e.id} » : la recette « ${e.recette} » n'existe pas.`);

  // Étapes qui déclarent plusieurs plats et minuteurs (rituel en parallèle,
  // spec §5.5) : mêmes exigences que pour `recette`.
  for (const e of cycle.rituel.etapes) {
    for (const p of e.plats ?? [])
      if (!recettes.has(p)) erreurs.add(`Rituel, étape « ${e.id} » : la recette « ${p} » n'existe pas.`);
    for (const m of e.minuteurs ?? []) {
      if (m.recette && !recettes.has(m.recette))
        erreurs.add(`Rituel, étape « ${e.id} » : la recette « ${m.recette} » n'existe pas.`);
      if (m.minutes < 1)
        erreurs.add(`Rituel, étape « ${e.id} » : le minuteur « ${m.nom} » doit durer au moins 1 minute.`);
    }
  }

  for (const menu of cycle.menus) {
    const m = `Menu ${menu.lettre}`;
    const producteurs = new Set([...idsRituel, ...menu.microBatch.map((x) => x.id), ...recettes.keys()]);
    const vus = menu.jours.map((j) => j.jour);
    for (const j of JOURS) if (!vus.includes(j)) erreurs.add(`${m} : jour « ${j} » manquant.`);
    vus.forEach((j, i) => vus.indexOf(j) !== i && erreurs.add(`${m} : jour « ${j} » en double.`));

    for (const { jour, repas } of menu.jours)
      for (const r of repas) {
        const ou = `${m}, ${jour}`;
        if (!r.recette && !r.texte) erreurs.add(`${ou} : le repas « ${r.id} » n'a ni recette ni texte.`);
        if (r.recette && !recettes.has(r.recette))
          erreurs.add(`${ou} : la recette « ${r.recette} » n'existe pas (repas ${r.id}).`);
        if (r.boite && !producteurs.has(r.boite.produitePar))
          erreurs.add(
            `${ou} : la boîte du repas « ${r.id} » vient de « ${r.boite.produitePar} », introuvable (étape du rituel, micro-batch ou recette).`,
          );
        const rec = r.recette ? recettes.get(r.recette) : undefined;
        if (!rec || !ctx.membres) continue;
        for (const mb of ctx.membres) {
          if (!mange(r, mb.id)) continue;
          if (mb.regime && r.moment === 'diner' && r.pour === 'famille' && !rec.variantes?.[mb.id])
            erreurs.add(`${ou} : la version de « ${mb.id} » manque pour « ${rec.nom} » (régime ${mb.regime}).`);
          if (mb.suivi && !rec.macros[mb.id])
            erreurs.add(`${ou} : les macros de « ${mb.id} » manquent pour « ${rec.nom} ».`);
        }
      }

    for (const x of menu.microBatch)
      if (x.recette && !recettes.has(x.recette))
        erreurs.add(`${m}, micro-batch « ${x.id} » : la recette « ${x.recette} » n'existe pas.`);
    for (const x of menu.reserve)
      if (x.produitPar && !producteurs.has(x.produitPar))
        erreurs.add(`${m}, réserve « ${x.plat} » : « ${x.produitPar} » introuvable.`);
  }

  if (ctx.membres) {
    const connus = new Set(ctx.membres.map((x) => x.id));
    const verifier = (ids: string[], ou: string) =>
      ids.forEach((id) => !connus.has(id) && erreurs.add(`${ou} : membre inconnu « ${id} ».`));
    for (const r of cycle.recettes) {
      verifier(Object.keys(r.portions), `Recette « ${r.id} » (portions)`);
      verifier(Object.keys(r.variantes ?? {}), `Recette « ${r.id} » (variantes)`);
      verifier(Object.keys(r.macros), `Recette « ${r.id} » (macros)`);
    }
    for (const menu of cycle.menus)
      for (const { jour, repas } of menu.jours)
        for (const r of repas) {
          if (r.pour !== 'famille') verifier(r.pour, `Menu ${menu.lettre}, ${jour}`);
          if (r.exception) verifier(r.exception.pour, `Menu ${menu.lettre}, ${jour}`);
        }
    for (const f of cycle.fixes) if (f.pour !== 'famille') verifier(f.pour, `Article fixe « ${f.nom} »`);
  }
  return [...erreurs];
};

// Alertes de règles de l'app : celles qui peuvent demander une action.
const alertes = (cycle: Cycle, ctx: ContexteValidation): string[] => {
  const a: string[] = [];
  const recettes = new Map(cycle.recettes.map((r) => [r.id, r]));

  if (ctx.budgetMax != null)
    for (const { lettre } of cycle.menus) {
      const { total } = estimerSemaine(cycle, lettre);
      if (total > ctx.budgetMax + 0.005)
        a.push(
          `Menu ${lettre} : courses estimées à ${Math.round(total)} € par semaine, au-dessus de ton plafond de ${ctx.budgetMax} €.`,
        );
    }

  const seuil = ctx.seuilKetoG ?? SEUIL_KETO;
  for (const mb of ctx.membres?.filter((x) => x.regime === 'keto') ?? [])
    for (const menu of cycle.menus)
      for (const { jour, repas } of menu.jours) {
        const g = repas
          .filter((r) => r.recette && mange(r, mb.id))
          .reduce((s, r) => s + (recettes.get(r.recette!)?.macros[mb.id]?.glucides ?? 0), 0);
        if (g > seuil) a.push(`Menu ${menu.lettre}, ${jour} : ≈ ${g} g de glucides pour ${mb.id} (seuil ${seuil} g).`);
      }

  // Plat non congelable servi au-delà de sa conservation frigo (spec §5.5) :
  // alerte, jamais bloquant. Sans jourRituel (pas de foyer) : pas de calcul.
  if (ctx.jourRituel) {
    const produitParRituel = new Set<string>();
    for (const e of cycle.rituel.etapes) {
      produitParRituel.add(e.id);
      if (e.recette) produitParRituel.add(e.recette);
      for (const p of e.plats ?? []) produitParRituel.add(p);
    }
    const iRituel = JOURS.indexOf(ctx.jourRituel);
    for (const menu of cycle.menus)
      for (const { jour, repas } of menu.jours) {
        const ecoule = (JOURS.indexOf(jour) - iRituel + 7) % 7;
        if (ecoule <= 0) continue;
        for (const r of repas) {
          if (!r.boite || !r.recette || !produitParRituel.has(r.boite.produitePar)) continue;
          const rec = recettes.get(r.recette);
          if (!rec) continue;
          const frigoJours = r.boite.frigoJours ?? rec.conservation.frigoJours;
          if (rec.conservation.congelable || frigoJours >= ecoule) continue;
          a.push(
            `« ${rec.nom} » du ${jour} : ne se garde que ${frigoJours} jours au frigo sans congélation — décale-la dans la semaine ou congele des portions.`,
          );
        }
      }
  }

  const diners = cycle.menus.map((menu) => ({
    lettre: menu.lettre,
    ids: new Set(
      menu.jours.flatMap((j) => j.repas.filter((r) => r.moment === 'diner' && r.recette).map((r) => r.recette!)),
    ),
  }));
  for (const { lettre, ids } of diners) {
    const propres = [...ids].filter((id) => diners.every((d) => d.lettre === lettre || !d.ids.has(id))).length;
    if (propres < DINERS_PROPRES_MIN)
      a.push(`Menu ${lettre} : seulement ${propres} dîners propres (au moins ${DINERS_PROPRES_MIN} attendus).`);
  }

  for (const id of ctx.recettesPrecedentes ?? []) {
    const r = recettes.get(id);
    if (r) a.push(`« ${r.nom} » était déjà au cycle précédent.`);
  }
  return a;
};

export const importerCycle = (
  fichiers: { nom: string; contenu: string }[],
  ctx: ContexteValidation = {},
): ResultatImport => {
  const lus = fichiers.map((f) => lire(f.nom, f.contenu));
  const erreursLecture = lus.flatMap((l) => l.erreurs);
  if (erreursLecture.length) return { cycle: null, erreurs: erreursLecture, alertes: [], classees: VIDE };

  const { cycle, erreurs } = fusionner(lus.map((l) => l.fichier!));
  if (!cycle) return { cycle: null, erreurs, alertes: [], classees: VIDE };

  const erreursRegles = regles(cycle, ctx);
  if (erreursRegles.length) return { cycle: null, erreurs: erreursRegles, alertes: [], classees: VIDE };
  const techniques = lus.flatMap((l) => l.alertes);
  const actions = alertes(cycle, ctx);
  const notes = dedoublonnerNotes(cycle.remarques);
  return {
    cycle,
    erreurs: [],
    // Ordre historique conservé : conversions, remarques de l'IA, puis règles.
    alertes: [...techniques, ...cycle.remarques, ...actions],
    classees: { actions, notes, techniques, nbCorriges: lus.reduce((s, l) => s + l.nbCorriges, 0) },
  };
};
