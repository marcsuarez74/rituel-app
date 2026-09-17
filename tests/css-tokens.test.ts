/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Contrat CSS (spec 2026-09-17-design-tokens-typo-espacement-design.md) :
// toute taille/espacement/interlignage passe par les tokens de :root.
// Exceptions d'espacement documentées (voir describe dédié, ajouté en Task 2).
const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

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

  it('chaque référence var(--fs-*) / var(--lh-*) est définie dans :root', () => {
    const definis = new Set(
      [...css.matchAll(/(--(?:fs|lh)-[\w-]+):/g)].map(([d]) => d.slice(0, -1)),
    );
    const orphelines = [...css.matchAll(/var\((--(?:fs|lh)-[\w-]+)\)/g)]
      .map(([, t]) => t)
      .filter((t) => !definis.has(t));
    expect(
      orphelines,
      `tokens référencés non définis : ${orphelines.join(' | ')}`,
    ).toEqual([]);
  });
});
