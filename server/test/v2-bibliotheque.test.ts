import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { ajouterRecettes, piocher, signaler } from '../src/v2/bibliotheque.js';
import type { Menus, Recette } from '../src/v2/contrat.js';
import { menus, profil } from './v2-fixtures.js';

// Bibliothèque partagée (plan 2026-10-16-app-native §A.8) : chaque recette validée y entre ; la
// génération y pioche les plats compatibles ; un signalement retire un plat d'un foyer, puis de tous.

const contexte = () => {
  const db = ouvrirDb(':memory:');
  for (const f of ['f1', 'f2', 'f3', 'f4'])
    db.prepare("insert into v2_foyers (id, code_empreinte, cree_le) values (?, ?, '2026-10-17')").run(f, `e-${f}`);
  return db;
};
const toutes = (m: Menus): Recette[] => m.semaines.flatMap((s) => s.recettes);
const titres = (plats: Recette[]) => plats.map((r) => r.titre).sort();

describe('bibliothèque', () => {
  it('un menu validé entre dans la bibliothèque ; chaque recette porte son id de bibliothèque', () => {
    const db = contexte();
    const m = menus();
    ajouterRecettes(db, toutes(m));
    const recettes = toutes(m);
    expect(recettes.every((r) => typeof r.bibliotheque === 'string')).toBe(true);
    expect(new Set(recettes.map((r) => r.bibliotheque)).size).toBe(recettes.length);
    // Les ids locaux du menu ne changent pas : jours et Rituel y renvoient.
    expect(m.semaines[0].recettes.map((r) => r.id)).toEqual(menus().semaines[0].recettes.map((r) => r.id));
    expect(piocher(db, 'f1', profil())).toHaveLength(recettes.length);
  });

  it('une recette déjà issue de la bibliothèque n’y entre pas une seconde fois', () => {
    const db = contexte();
    const m = menus();
    ajouterRecettes(db, toutes(m));
    ajouterRecettes(db, toutes(m));
    expect(piocher(db, 'f1', profil())).toHaveLength(toutes(m).length);
  });

  it('piocher : un plat de la bibliothèque, avec son id de bibliothèque comme id', () => {
    const db = contexte();
    const m = menus();
    ajouterRecettes(db, toutes(m));
    const omelette = m.semaines[0].recettes.find((r) => r.id === 'omelette-1')!;
    const plat = piocher(db, 'f1', profil()).find((r) => r.titre === omelette.titre)!;
    expect(plat).toEqual({ ...omelette, id: omelette.bibliotheque });
  });

  it('piocher ne propose que les plats compatibles avec le profil', () => {
    const db = contexte();
    ajouterRecettes(db, toutes(menus()));
    const sansOeufs = piocher(db, 'f1', profil({ allergenes: ['oeufs'] }));
    expect(titres(sansOeufs).some((t) => t.startsWith('Omelette'))).toBe(false);
    expect(sansOeufs.length).toBeGreaterThan(0);
  });

  it('titres en double : un seul plat proposé', () => {
    const db = contexte();
    ajouterRecettes(db, toutes(menus()));
    ajouterRecettes(db, toutes(menus()));
    const plats = piocher(db, 'f1', profil());
    expect(new Set(plats.map((r) => r.titre)).size).toBe(plats.length);
  });

  it('limite : au plus N plats', () => {
    const db = contexte();
    ajouterRecettes(db, toutes(menus()));
    expect(piocher(db, 'f1', profil(), 3)).toHaveLength(3);
  });

  it('signaler retire le plat du foyer ; au 3e foyer, de tous ; un id inconnu est refusé', () => {
    const db = contexte();
    const m = menus();
    ajouterRecettes(db, toutes(m));
    const id = m.semaines[0].recettes[0].bibliotheque!;
    const present = (f: string) => piocher(db, f, profil()).some((r) => r.id === id);
    expect(signaler(db, 'f1', id)).toBe(true);
    expect(signaler(db, 'f1', id)).toBe(true);
    expect(present('f1')).toBe(false);
    expect(present('f4')).toBe(true);
    signaler(db, 'f2', id);
    expect(present('f4')).toBe(true);
    signaler(db, 'f3', id);
    expect(present('f4')).toBe(false);
    expect(signaler(db, 'f1', 'inconnu')).toBe(false);
  });
});
