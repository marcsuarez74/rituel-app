import { recettesDeLaSemaine } from './budget';
import type { Cycle, Lettre, Rayon, Unite } from './types';
import { RAYONS } from './types';

// Liste de courses CALCULÉE (spec 2026-10-07 §9) : somme des ingrédients des
// recettes de la semaine + articles fixes, agrégés par ingrédient. Le JSON ne
// contient pas de liste : elle colle toujours au menu.

export const LIBELLES_RAYON: Record<Rayon, string> = {
  proteines: 'Protéines',
  laitiers: 'Laitiers',
  feculents: 'Féculents',
  legumes: 'Légumes',
  fruits: 'Fruits',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
  keto: 'Extras keto',
};

export interface LigneCourse {
  id: string; // id de coche stable : courses:{lettre}:{rayon}:{clé}
  cle: string;
  nom: string; // graphie de la 1re occurrence
  quantite: number; // en g / ml pour les poids et volumes
  unite: Unite;
  rayon: Rayon;
  prix: number;
  rituel: boolean; // sert au rituel du dimanche
  placard: boolean;
}

export interface ListeCourses {
  lignes: LigneCourse[]; // par rayon (ordre RAYONS, keto en dernier)
  placard: LigneCourse[]; // huile, épices… : à vérifier, hors liste
}

// Clé d'agrégation : sans précision entre parenthèses, casse, accents, ni
// pluriel simple (« Oignons » = « oignon »).
export const cleIngredient = (nom: string): string =>
  nom
    .replace(/\(.*?\)/g, ' ')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((mot) => (mot.length > 3 ? mot.replace(/s$/, '') : mot))
    .join('-');

// Poids et volumes ramenés à g / ml pour pouvoir additionner.
const normaliser = (q: number, u: Unite): { q: number; u: Unite } =>
  u === 'kg' ? { q: q * 1000, u: 'g' } : u === 'l' ? { q: q * 1000, u: 'ml' } : { q, u };

const nombre = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

export const formatQuantite = (q: number, u: Unite): string => {
  switch (u) {
    case 'g':
    case 'kg': {
      const g = u === 'kg' ? q * 1000 : q;
      return g >= 1000 ? `${nombre(g / 1000)} kg` : `${Math.round(g)} g`;
    }
    case 'ml':
    case 'l': {
      const ml = u === 'l' ? q * 1000 : q;
      return ml >= 1000 ? `${nombre(ml / 1000)} l` : `${Math.round(ml)} ml`;
    }
    case 'piece':
      return `×${Math.ceil(q)}`;
    case 'boite':
      return pluriel(Math.ceil(q), 'boîte', 'boîtes');
    case 'sachet':
      return pluriel(Math.ceil(q), 'sachet', 'sachets');
    case 'botte':
      return pluriel(Math.ceil(q), 'botte', 'bottes');
    case 'cs':
      return `${nombre(q)} c. à s.`;
    case 'cc':
      return `${nombre(q)} c. à c.`;
  }
};

// `semaine` : index 0-3 dans le cycle (les fixes mensuels tombent en semaine 0).
export const listeCourses = (cycle: Cycle, lettre: Lettre, semaine: number): ListeCourses => {
  const duRituel = new Set(cycle.rituel.etapes.flatMap((e) => (e.recette ? [e.recette] : [])));
  const lignes = new Map<string, LigneCourse>();
  const ajouter = (
    i: { nom: string; quantite: number; unite: Unite; rayon: Rayon; prix: number; placard?: boolean },
    rituel: boolean,
  ) => {
    const { q, u } = normaliser(i.quantite, i.unite);
    const cle = cleIngredient(i.nom);
    const k = `${cle}|${u}`;
    const l = lignes.get(k);
    if (l) {
      l.quantite += q;
      l.prix += i.prix;
      l.rituel ||= rituel;
      return;
    }
    lignes.set(k, {
      id: `courses:${lettre}:${i.rayon}:${cle}`,
      cle,
      nom: i.nom.replace(/\s*\(.*?\)\s*/g, ' ').trim(),
      quantite: q,
      unite: u,
      rayon: i.rayon,
      prix: i.prix,
      rituel,
      placard: !!i.placard,
    });
  };

  for (const r of recettesDeLaSemaine(cycle, lettre))
    for (const i of r.ingredients) ajouter({ ...i, prix: i.prixEstime }, duRituel.has(r.id));
  for (const f of cycle.fixes)
    if (f.frequence === 'hebdo' || semaine === 0) ajouter({ ...f, prix: f.prixEstime }, false);

  const toutes = [...lignes.values()].sort((a, b) => RAYONS.indexOf(a.rayon) - RAYONS.indexOf(b.rayon));
  return { lignes: toutes.filter((l) => !l.placard), placard: toutes.filter((l) => l.placard) };
};
