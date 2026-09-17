/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Contrat CSS (spec 2026-09-17-design-tokens-typo-espacement-design.md) :
// toute taille/espacement/interlignage passe par les tokens de :root.
// Échelle d'espacement : 2 px (le nom du token --sp-N est sa valeur en px).
// Exceptions d'espacement documentées ci-dessous avec leur raison.
// Le contrat couvre font-size:/line-height:/padding|margin|gap. Le shorthand
// `font:` (utilisé : onboarding, pills) est couvert par le 4ᵉ test ci-dessous.
const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

// Exceptions documentées, avec raison :
// - "margin:-1px" (.sr-only) : pattern d'accessibilité standard (clip), pas du rythme.
// - calc(...) : safe-areas iOS et négation d'un token — exemptées par nature.
const EXCEPTIONS_SP = ['margin:-1px'];

describe('contrat CSS — tokens de typographie', () => {
  it('chaque font-size utilise un token --fs-*', () => {
    const brutes = [...css.matchAll(/font-size:\s*([^;]+);/g)]
      .filter(([, v]) => !v.includes('var(--fs-'))
      .map(([, v]) => v.trim());
    expect(brutes, `font-size brutes : ${brutes.join(' | ')}`).toEqual([]);
  });

  it('chaque line-height numérique utilise un token --lh-*', () => {
    const brutes = [...css.matchAll(/line-height:\s*([^;]+);/g)]
      .filter(([, v]) => /^\d/.test(v.trim()) && !v.includes('var(--lh-'))
      .map(([, v]) => v.trim());
    expect(brutes, `line-height brutes : ${brutes.join(' | ')}`).toEqual([]);
  });

  it('chaque référence var(--fs-*|--lh-*|--sp-*) est définie', () => {
    const definis = new Set(
      [...css.matchAll(/(--(?:fs|lh|sp)-[\w-]+):/g)].map(([d]) => d.slice(0, -1)),
    );
    const orphelines = [...css.matchAll(/var\((--(?:fs|lh|sp)-[\w-]+)\)/g)]
      .map(([, t]) => t)
      .filter((t) => !definis.has(t));
    expect(
      orphelines,
      `tokens référencés non définis : ${orphelines.join(' | ')}`,
    ).toEqual([]);
  });

  it('chaque taille du shorthand font: utilise un token --fs-*', () => {
    const brutes = [...css.matchAll(/^(\s*)font:\s*([^;]+);/gm)]
      .filter(([, , v]) => v.trim() !== 'inherit' && !v.includes('var(--fs-'))
      .map(([, ind, v]) => `${ind}font: ${v.trim()}`);
    expect(brutes, `shorthand font: brutes : ${brutes.join(' | ')}`).toEqual([]);
  });
});

describe('contrat CSS — tokens d\'espacement', () => {
  // Garde anti-régression silencieuse : si le CSS est réorganisé et que le
  // sélecteur ci-dessous ne matche plus rien, ce test le signale.
  const decls = [
    ...css.matchAll(/^(\s*)((?:padding|margin|gap|scroll-padding)[a-z-]*):([^;]+);/gm),
  ];

  it('le CSS contient des déclarations d\'espacement à auditer', () => {
    expect(decls.length).toBeGreaterThan(200);
  });

  it('chaque valeur px est un token --sp-* (ou exception documentée)', () => {
    const hors = decls
      .filter(([, , prop, v]) => !EXCEPTIONS_SP.includes(`${prop.trim()}:${v.trim()}`))
      .flatMap(([, , prop, v]) => {
        const sansCalc = v.replace(/calc\([^)]*\)/g, '');
        const px = [...sansCalc.matchAll(/(-?)(\d+(?:\.\d+)?)px/g)].map((m) => Math.abs(parseFloat(m[2])));
        return px.map((n) => `${prop.trim()}:${v.trim()} [${n}px]`);
      });
    expect(hors, `hors échelle : ${hors.join(' | ')}`).toEqual([]);
  });
});
