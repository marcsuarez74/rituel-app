import { DIFFICULTES, JOURS, LETTRES, MOMENTS, RAYONS, UNITES } from './types';

// Vérification de FORME d'un fichier de cycle (types, valeurs autorisées), sans
// dépendance : un mini-schéma déclaratif interprété par `verifierForme`. Les
// champs inconnus sont tolérés (le contrat peut s'enrichir sans casser).

export type Forme =
  | 'texte'
  | 'nombre'
  | 'booleen'
  | { parmi: readonly string[] }
  | { liste: Forme }
  | { dico: Forme }
  | { objet: Record<string, Forme> }
  | { option: Forme }
  | { ou: Forme[] };

export const opt = (f: Forme): Forme => ({ option: f });
export const liste = (f: Forme): Forme => ({ liste: f });
export const objet = (o: Record<string, Forme>): Forme => ({ objet: o });
const textes = liste('texte');

const POUR: Forme = { ou: [{ parmi: ['famille'] }, textes] };
const MACROS = objet({ kcal: 'nombre', proteines: 'nombre', glucides: 'nombre', lipides: 'nombre' });

const INGREDIENT = objet({
  nom: 'texte',
  quantite: 'nombre',
  unite: { parmi: UNITES },
  rayon: { parmi: RAYONS },
  prixEstime: 'nombre',
  fraisJours: opt('nombre'),
  placard: opt('booleen'),
});

const RECETTE = objet({
  id: 'texte',
  nom: 'texte',
  difficulte: { parmi: DIFFICULTES },
  tempsMin: 'nombre',
  tempsActifMin: opt('nombre'),
  ingredients: liste(INGREDIENT),
  portions: { dico: 'texte' },
  variantes: opt({ dico: 'texte' }),
  macros: { dico: MACROS },
  etapes: liste(objet({ texte: 'texte', minuteurMin: opt('nombre') })),
  conservation: objet({ frigoJours: 'nombre', congelable: 'booleen', rechauffage: 'texte' }),
  notes: opt(textes),
});

const REPAS = objet({
  id: 'texte',
  moment: { parmi: MOMENTS },
  pour: POUR,
  recette: opt('texte'),
  texte: opt('texte'),
  boite: opt(objet({ produitePar: 'texte', frigoJours: 'nombre' })),
  exception: opt(objet({ quand: 'texte', pour: textes, texte: 'texte' })),
});

const MENU = objet({
  lettre: { parmi: LETTRES },
  titre: 'texte',
  jours: liste(objet({ jour: { parmi: JOURS }, repas: liste(REPAS) })),
  rappelsRituel: opt(textes),
  microBatch: liste(
    objet({
      id: 'texte',
      jour: { parmi: JOURS },
      quoi: 'texte',
      dureeMin: 'nombre',
      quantite: opt('texte'),
      recette: opt('texte'),
      detail: opt('texte'),
    }),
  ),
  reserve: liste(objet({ pour: 'texte', plat: 'texte', conservation: 'texte', produitPar: opt('texte') })),
});

const RITUEL = objet({
  dureeMin: 'nombre',
  production: textes,
  avantDeCommencer: liste(objet({ nom: 'texte', quantite: 'texte' })),
  etapes: liste(
    objet({
      id: 'texte',
      creneau: 'texte',
      label: 'texte',
      detail: 'texte',
      recette: opt('texte'),
      sousEtapes: opt(textes),
      enParallele: opt('texte'),
      minuteurMin: opt('nombre'),
    }),
  ),
  termine: 'texte',
});

const FIXE = objet({
  nom: 'texte',
  quantite: 'nombre',
  unite: { parmi: UNITES },
  rayon: { parmi: RAYONS },
  prixEstime: 'nombre',
  pour: POUR,
  frequence: { parmi: ['hebdo', 'mensuel'] },
});

export const FICHIER: Forme = objet({
  titre: 'texte',
  rituel: opt(RITUEL),
  menus: liste(MENU),
  recettes: liste(RECETTE),
  fixes: opt(liste(FIXE)),
  remarques: opt(textes),
});

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const decrire = (v: unknown): string =>
  v === undefined ? 'absent' : typeof v === 'string' ? `« ${v} »` : JSON.stringify(v);

// Une erreur par écart, sous la forme « chemin : problème ». Limitée pour
// rester lisible (un fichier mal formé produit vite des centaines d'écarts).
export const verifierForme = (v: unknown, f: Forme, chemin = '', max = 20): string[] => {
  const erreurs: string[] = [];
  const err = (c: string, m: string) => {
    if (erreurs.length < max) erreurs.push(`${c || 'racine'} : ${m}`);
  };
  const visiter = (val: unknown, forme: Forme, c: string): void => {
    if (forme === 'texte') {
      if (typeof val !== 'string' || !val.trim()) err(c, `texte attendu (${decrire(val)})`);
    } else if (forme === 'nombre') {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) err(c, `nombre positif attendu (${decrire(val)})`);
    } else if (forme === 'booleen') {
      if (typeof val !== 'boolean') err(c, `true ou false attendu (${decrire(val)})`);
    } else if ('parmi' in forme) {
      if (typeof val !== 'string' || !forme.parmi.includes(val))
        err(c, `${decrire(val)} n'est pas une valeur autorisée (${forme.parmi.join(', ')})`);
    } else if ('option' in forme) {
      if (val !== undefined) visiter(val, forme.option, c);
    } else if ('ou' in forme) {
      if (!forme.ou.some((alt) => verifierForme(val, alt).length === 0)) err(c, `valeur inattendue (${decrire(val)})`);
    } else if ('liste' in forme) {
      if (!Array.isArray(val)) return err(c, `liste attendue (${decrire(val)})`);
      val.forEach((x, i) => visiter(x, forme.liste, `${c}[${i}]`));
    } else if ('dico' in forme) {
      if (!estObjet(val)) return err(c, `objet attendu (${decrire(val)})`);
      for (const [k, x] of Object.entries(val)) visiter(x, forme.dico, `${c}.${k}`);
    } else {
      if (!estObjet(val)) return err(c, `objet attendu (${decrire(val)})`);
      for (const [k, sf] of Object.entries(forme.objet)) visiter(val[k], sf, c ? `${c}.${k}` : k);
    }
  };
  visiter(v, f, chemin);
  return erreurs;
};
