import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Contrat de lisibilité (spec refonte ergo 2026-10-12, PR 1 item 2) : toute paire
// texte/fond déclarée dans :root doit tenir ≥ 4,5:1 (règle « ultra visible » du dépôt).
// Le texte secondaire doit tenir sur le fond papier ET sur les cartes blanches :
// l'ancien --muted Herbes (4,41:1 sur surface) ne doit pas être reproduit.
const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

function blocRoot(): Map<string, string> {
  const bloc = cssSansCommentaires.match(/:root\s*{([^}]*)}/);
  expect(bloc, 'bloc :root introuvable').not.toBeNull();
  const tokens = new Map<string, string>();
  for (const [, nom, valeur] of (bloc as RegExpMatchArray)[1].matchAll(/(--[\w-]+):\s*([^;]+)/g)) {
    tokens.set(nom.trim(), valeur.trim());
  }
  return tokens;
}

const LIMIT_ALIAS = 10;
const cssSansCommentaires = css.replace(/\/\*[^*]*\*\//g, '');

function blocDeclarations(selecteur: string): string {
  const motif = new RegExp(selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  return cssSansCommentaires.match(motif)?.[1] ?? '';
}

// Découpe « a, f(x, y), b » au niveau supérieur (les virgules entre parenthèses sont gardées).
function argumentsNiveauSuperieur(s: string): string[] {
  const parts: string[] = [];
  let courant = '';
  let profondeur = 0;
  for (const c of s) {
    if (c === '(') profondeur++;
    if (c === ')') profondeur--;
    if (c === ',' && profondeur === 0) {
      parts.push(courant.trim());
      courant = '';
    } else {
      courant += c;
    }
  }
  if (courant.trim()) parts.push(courant.trim());
  return parts;
}

function resoudre(tokens: Map<string, string>, nom: string, profondeur = 0): string {
  expect(profondeur, `alias de ${nom} trop imbriqués`).toBeLessThan(LIMIT_ALIAS);
  const valeur = tokens.get(nom);
  expect(valeur, `token ${nom} manquant dans :root`).toBeDefined();
  const alias = (valeur as string).match(/^var\((--[\w-]+)\)$/);
  return alias ? resoudre(tokens, alias[1], profondeur + 1) : (valeur as string);
}

// color-mix(in srgb, <couleur> P%, <couleur>) — mix gamma-encoded (espace sRGB),
// comme le navigateur. Renvoie un hex 6 chiffres.
function melanger(tokens: Map<string, string>, valeur: string, profondeur = 0): string {
  const mix = valeur.match(
    /^color-mix\(\s*in srgb,\s*(var\(--[\w-]+\)|#[0-9a-fA-F]{3,8})\s+([\d.]+)%\s*,\s*(var\(--[\w-]+\)|#[0-9a-fA-F]{3,8})\s*\)$/,
  );
  if (!mix) return valeur;
  const [, c1, part, c2] = mix;
  const hex1 = c1.startsWith('var(') ? resoudre(tokens, c1.slice(4, -1), profondeur + 1) : c1;
  const hex2 = c2.startsWith('var(') ? resoudre(tokens, c2.slice(4, -1), profondeur + 1) : c2;
  const p = parseFloat(part) / 100;
  const h1 = normaliserHex(hex1);
  const h2 = normaliserHex(hex2);
  const canaux = [0, 2, 4].map((i) => {
    const v1 = parseInt(h1.slice(i, i + 2), 16);
    const v2 = parseInt(h2.slice(i, i + 2), 16);
    return Math.round(v1 * p + v2 * (1 - p));
  });
  return `#${canaux.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function normaliserHex(hex: string): string {
  const n = hex.replace('#', '');
  return n.length === 3 ? [...n].map((c) => c + c).join('') : n;
}

function luminance(hex: string): number {
  expect(hex, `valeur non hexa : ${hex}`).toMatch(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/);
  const n = hex.replace('#', '');
  const h = n.length === 3 ? [...n].map((c) => c + c).join('') : n;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Résout une valeur CSS en hex : littéral #, expression color-mix (mélangée avec
// ses arguments résolus), token nu ou var(--token) — dans n'importe quel ordre,
// y compris un token dont la valeur est elle-même un color-mix.
function couleurFinale(tokens: Map<string, string>, valeur: string, profondeur = 0): string {
  expect(profondeur, `résolution de couleur trop imbriquée : ${valeur}`).toBeLessThan(LIMIT_ALIAS);
  if (valeur.startsWith('#')) return valeur;
  const melangee = melanger(tokens, valeur);
  if (melangee.startsWith('#')) return melangee;
  const nom = melangee.startsWith('var(') ? melangee.slice(4, -1) : melangee;
  return couleurFinale(tokens, resoudre(tokens, nom), profondeur + 1);
}

function ratio(tokens: Map<string, string>, texte: string, fond: string): number {
  const lt = luminance(couleurFinale(tokens, texte));
  const lf = luminance(couleurFinale(tokens, fond));
  const [claire, sombre] = [lt, lf].sort((a, b) => b - a);
  return (claire + 0.05) / (sombre + 0.05);
}

// Texte du bouton plein : blanc (littéral accepté par le design system).
const BLANC_BOUTON = '#ffffff';

describe('contrat CSS — contraste des paires texte/fond (≥ 4,5:1)', () => {
  const tokens = blocRoot();
  const paires: [string, string, string][] = [
    ['texte principal sur papier', '--text', '--papier'],
    ['texte principal sur cartes', '--text', '--surface'],
    ['texte secondaire sur papier', '--muted', '--papier'],
    ['texte secondaire sur cartes', '--muted', '--surface'],
    ['danger sur papier', '--danger', '--papier'],
    ['danger sur cartes', '--danger', '--surface'],
    // Paires étendues (revue PR 1) : usages réels du thème Marché.
    ['lien/action sur papier', '--accent', '--papier'],
    ['lien/action sur cartes', '--accent', '--surface'],
    ['texte blanc du bouton danger', BLANC_BOUTON, '--danger'],
    ['texte sur étiquette kraft', '--text', '--kraft'],
    ['craie du toast sur ardoise', '--craie', '--ardoise'],
  ];

  for (const [libelle, texte, fond] of paires) {
    it(`${libelle} (${texte} sur ${fond})`, () => {
      const r = ratio(tokens, texte, fond);
      expect(r, `${texte} sur ${fond} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('texte du bouton plein (blanc) sur --accent', () => {
    const lt = luminance(BLANC_BOUTON);
    const lf = luminance(resoudre(tokens, '--accent'));
    const r = (lt + 0.05) / (lf + 0.05);
    expect(r, `blanc sur --accent = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  // Dégradés des cartes d'onboarding (étape 1 obligatoire) : les DEUX bornes de
  // chaque dégradé doivent porter leur texte — l'angle mort qui a laissé passer la
  // tagline invisible sur la carte Marc (revue PR 1, finding C1).
  const degrades: [string, string, string][] = [
    ['tagline blanche sur carte Marc (borne basilic)', BLANC_BOUTON, '--basilic'],
    ['tagline blanche sur carte Marc (borne foncée)', BLANC_BOUTON, 'color-mix(in srgb, var(--basilic) 75%, var(--encre))'],
    ['tagline encre sur carte Mélanie (borne jaune fruit)', '--text', '--accent-2'],
    ['tagline encre sur carte Mélanie (borne foncée)', '--text', 'color-mix(in srgb, var(--accent-2) 72%, var(--encre))'],
  ];

  for (const [libelle, texte, fond] of degrades) {
    it(`${libelle}`, () => {
      const r = ratio(tokens, texte, fond);
      expect(r, `${texte} sur ${fond} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// Revue PR 1, finding C1 : la tagline des cartes d'onboarding avait UNE couleur
// mixée unique pour les deux cartes — illisible sur la carte Marc (fond basilic).
// Contrat : chaque carte déclare sa propre couleur de tagline, et cette couleur
// tient ≥ 4,5:1 sur les DEUX bornes du dégradé de la carte (pas seulement la claire).
describe('contrat CSS — taglines des cartes d’onboarding, lisibles sur tout le dégradé (C1)', () => {
  const tokens = blocRoot();

  for (const carte of ['marc', 'melanie'] as const) {
    it(`la tagline de la carte ${carte} a une couleur propre, lisible sur les deux bornes de son dégradé`, () => {
      const blocCarte = blocDeclarations(`.onboarding-card-${carte}`);
      expect(blocCarte, `.onboarding-card-${carte} doit déclarer un dégradé`).toMatch(
        /background:\s*linear-gradient/,
      );
      const valeurFond = (blocCarte.match(/background:\s*([^;]+);/) as RegExpMatchArray)[1].trim();
      const args = argumentsNiveauSuperieur((valeurFond.match(/^linear-gradient\((.*)\)$/) as RegExpMatchArray)[1]);
      const bornes = args.slice(1);
      expect(bornes, `dégradé de .onboarding-card-${carte} : 2 bornes attendues`).toHaveLength(2);

      const blocTagline = blocDeclarations(`.onboarding-card-${carte} .onboarding-card-tagline`);
      const couleur = blocTagline.match(/color:\s*([^;]+);/)?.[1]?.trim();
      expect(
        couleur,
        `.onboarding-card-${carte} .onboarding-card-tagline { color: … } manquante — la couleur doit être déclarée par carte`,
      ).toBeDefined();

      for (const borne of bornes) {
        const r = ratio(tokens, couleur as string, borne);
        expect(r, `tagline carte ${carte} (${couleur}) sur ${borne} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
