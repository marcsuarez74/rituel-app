import { describe, expect, it } from 'vitest';
import { lancer, restant, sonnes } from '../../src/lib/minuteurs';
import type { MinuteurStocke } from '../../src/lib/storage';

const M = 60_000;
const maintenant = new Date('2026-10-11T10:00:00').getTime();

describe('minuteurs (pur, heure de fin jamais un décompte)', () => {
  it('lancer ajoute un minuteur fin = maintenant + minutes, les autres intacts', () => {
    const existant: MinuteurStocke = { id: 'm1', nom: 'Four', fin: maintenant + 5 * M };
    const l = lancer([existant], 'Lentilles', 18, 'lentilles-vertes-batch', maintenant);
    expect(l[0].id).toBe('m1');
    const nouveau = l[1];
    expect(nouveau.nom).toBe('Lentilles');
    expect(nouveau.recette).toBe('lentilles-vertes-batch');
    expect(nouveau.fin).toBe(maintenant + 18 * M);
    expect(nouveau.id).not.toBe('m1');
  });

  it('deux lancers au même instant ont des ids distincts', () => {
    const a = lancer([], 'Riz', 10, undefined, maintenant);
    const b = lancer(a, 'Quinoa', 10, undefined, maintenant);
    expect(new Set(b.map((x) => x.id)).size).toBe(2);
  });

  it('restant : secondes arrondies au-dessus, 0 une fois passé', () => {
    const m: MinuteurStocke = { id: 'm', nom: 'Four', fin: maintenant + 90_000 };
    expect(restant(m, maintenant)).toBe(90);
    expect(restant(m, maintenant + 1_000)).toBe(89);
    expect(restant(m, maintenant + 90_000)).toBe(0);
    expect(restant(m, maintenant + 120_000)).toBe(0);
  });

  it('sonnes : ceux dont la fin est atteinte ou passée', () => {
    const a: MinuteurStocke = { id: 'a', nom: 'A', fin: maintenant + 1 };
    const b: MinuteurStocke = { id: 'b', nom: 'B', fin: maintenant + 60_000 };
    expect(sonnes([a, b], maintenant)).toEqual([]);
    expect(sonnes([a, b], maintenant + 1_000).map((x) => x.id)).toEqual(['a']);
  });
});
