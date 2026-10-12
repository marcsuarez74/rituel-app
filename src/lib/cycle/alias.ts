import { RAYONS, UNITES } from './types';

// Les IA dévient parfois du contrat sur les rayons et les unités. Avant la
// vérification de forme, on remplace les alias ÉVIDENTS (avec alerte récapitulative) ;
// toute autre valeur reste telle quelle et sera refusée, groupée par valeur.

const nettoyer = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_.-]+/g, ' ')
    .trim();

const ALIAS_RAYON: Record<string, string> = {
  'fruits legumes': 'legumes',
  'fruits et legumes': 'legumes',
  legume: 'legumes',
  fruit: 'fruits',
  cremerie: 'laitiers',
  'produits laitiers': 'laitiers',
  laitier: 'laitiers',
  boucherie: 'proteines',
  poissonnerie: 'proteines',
  charcuterie: 'proteines',
  viande: 'proteines',
  viandes: 'proteines',
  poisson: 'proteines',
  poissons: 'proteines',
  surgele: 'surgeles',
  boulangerie: 'feculents',
  pain: 'feculents',
  feculent: 'feculents',
  proteine: 'proteines',
};

const ALIAS_UNITE: Record<string, { unite: string; facteur: number }> = {
  cl: { unite: 'ml', facteur: 10 },
  dl: { unite: 'ml', facteur: 100 },
  pieces: { unite: 'piece', facteur: 1 },
  unite: { unite: 'piece', facteur: 1 },
  unites: { unite: 'piece', facteur: 1 },
  'c a s': { unite: 'cs', facteur: 1 },
  cas: { unite: 'cs', facteur: 1 },
  'cuillere a soupe': { unite: 'cs', facteur: 1 },
  'cuilleres a soupe': { unite: 'cs', facteur: 1 },
  'c a c': { unite: 'cc', facteur: 1 },
  cac: { unite: 'cc', facteur: 1 },
  'cuillere a cafe': { unite: 'cc', facteur: 1 },
  'cuilleres a cafe': { unite: 'cc', facteur: 1 },
};

export interface RapportNormalisation {
  alertes: string[];
  erreurs: string[];
  /** Nombre d'ingrédients dont un rayon ou une unité a été corrigé. */
  nbCorriges: number;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const connu = (liste: readonly string[], v: string) => liste.includes(v);

// Modifie `brut` en place (objet JSON fraîchement parsé).
export const normaliserFichier = (brut: unknown, nom: string): RapportNormalisation => {
  const rayons = new Map<string, { vers: string; n: number }>();
  const unites = new Map<string, { vers: string; facteur: number; n: number }>();
  const rayonsInconnus = new Map<string, number>();
  const unitesInconnues = new Map<string, number>();

  const ingredient = (x: unknown): void => {
    if (typeof x !== 'object' || x === null) return;
    const o = x as Record<string, unknown>;
    if (typeof o.rayon === 'string' && !connu(RAYONS, o.rayon)) {
      const cle = nettoyer(o.rayon);
      const vers = ALIAS_RAYON[cle] ?? (connu(RAYONS, cle) ? cle : undefined);
      if (vers) {
        const e = rayons.get(o.rayon) ?? { vers, n: 0 };
        e.n += 1;
        rayons.set(o.rayon, e);
        o.rayon = vers;
      } else rayonsInconnus.set(o.rayon, (rayonsInconnus.get(o.rayon) ?? 0) + 1);
    }
    if (typeof o.unite === 'string' && !connu(UNITES, o.unite)) {
      const cle = nettoyer(o.unite);
      const a = ALIAS_UNITE[cle] ?? (connu(UNITES, cle) ? { unite: cle, facteur: 1 } : undefined);
      if (a) {
        const e = unites.get(o.unite) ?? { vers: a.unite, facteur: a.facteur, n: 0 };
        e.n += 1;
        unites.set(o.unite, e);
        o.unite = a.unite;
        if (a.facteur !== 1 && typeof o.quantite === 'number')
          o.quantite = Math.round(o.quantite * a.facteur * 1000) / 1000;
      } else unitesInconnues.set(o.unite, (unitesInconnues.get(o.unite) ?? 0) + 1);
    }
  };

  const o = brut as { recettes?: unknown; fixes?: unknown } | null;
  if (Array.isArray(o?.recettes))
    for (const r of o.recettes) {
      const ings = (r as { ingredients?: unknown } | null)?.ingredients;
      if (Array.isArray(ings)) ings.forEach(ingredient);
    }
  if (Array.isArray(o?.fixes)) o.fixes.forEach(ingredient);

  const alertes = [
    ...[...rayons].map(
      ([de, { vers, n }]) => `${nom} · rayon « ${de} » corrigé en « ${vers} » (${pluriel(n, 'ingrédient')}).`,
    ),
    ...[...unites].map(
      ([de, { vers, facteur, n }]) =>
        `${nom} · unité « ${de} » convertie en « ${vers} »${facteur !== 1 ? ` (quantité ×${facteur})` : ''} (${pluriel(n, 'ingrédient')}).`,
    ),
  ];
  const erreurs = [
    ...[...rayonsInconnus].map(
      ([v, n]) =>
        `${nom} · rayon « ${v} » inconnu (${pluriel(n, 'ingrédient')}) — valeurs autorisées : ${RAYONS.join(', ')}.`,
    ),
    ...[...unitesInconnues].map(
      ([v, n]) =>
        `${nom} · unité « ${v} » inconnue (${pluriel(n, 'ingrédient')}) — valeurs autorisées : ${UNITES.join(', ')}.`,
    ),
  ];
  const nbCorriges =
    [...rayons.values()].reduce((s, e) => s + e.n, 0) + [...unites.values()].reduce((s, e) => s + e.n, 0);
  return { alertes, erreurs, nbCorriges };
};
