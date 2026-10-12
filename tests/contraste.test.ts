import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Contrat de lisibilité (spec refonte ergo 2026-10-12, PR 1 item 2) : toute paire
// texte/fond déclarée dans :root doit tenir ≥ 4,5:1 (règle « ultra visible » du dépôt).
// Le texte secondaire doit tenir sur le fond papier ET sur les cartes blanches :
// l'ancien --muted Herbes (4,41:1 sur surface) ne doit pas être reproduit.
const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

function blocRoot(): Map<string, string> {
  const sansCommentaires = css.replace(/\/\*[^*]*\*\//g, '');
  const bloc = sansCommentaires.match(/:root\s*{([^}]*)}/);
  expect(bloc, 'bloc :root introuvable').not.toBeNull();
  const tokens = new Map<string, string>();
  for (const [, nom, valeur] of (bloc as RegExpMatchArray)[1].matchAll(/(--[\w-]+):\s*([^;]+)/g)) {
    tokens.set(nom.trim(), valeur.trim());
  }
  return tokens;
}

const LIMIT_ALIAS = 10;
function resoudre(tokens: Map<string, string>, nom: string, profondeur = 0): string {
  expect(profondeur, `alias de ${nom} trop imbriqués`).toBeLessThan(LIMIT_ALIAS);
  const valeur = tokens.get(nom);
  expect(valeur, `token ${nom} manquant dans :root`).toBeDefined();
  const alias = (valeur as string).match(/^var\((--[\w-]+)\)$/);
  return alias ? resoudre(tokens, alias[1], profondeur + 1) : (valeur as string);
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

function ratio(tokens: Map<string, string>, texte: string, fond: string): number {
  const lt = luminance(resoudre(tokens, texte));
  const lf = luminance(resoudre(tokens, fond));
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
  ];

  for (const [libelle, texte, fond] of paires) {
    it(`${libelle} (${texte} sur ${fond})`, () => {
      const r = ratio(tokens, texte, fond);
      expect(r, `${texte} sur ${fond} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('texte du bouton plein (blanc) sur --accent', () => {
    const r = ratio(tokens, '--accent', '--accent'); // sécurité : les tokens existent
    const lt = luminance(BLANC_BOUTON);
    const lf = luminance(resoudre(tokens, '--accent'));
    const r2 = (lt + 0.05) / (lf + 0.05);
    expect(r2, `blanc sur --accent = ${r2.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    expect(r).toBeGreaterThan(0); // --accent est défini et hex-résoluble
  });
});
