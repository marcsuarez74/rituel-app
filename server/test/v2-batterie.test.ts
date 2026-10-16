import { describe, expect, it } from 'vitest';
import { cout, executerBatterie, PROFILS_DIFFICILES, rapport, TARIFS, type Mesure } from '../src/v2/batterie.js';
import type { AppelIA } from '../src/v2/generer.js';
import { schemaProfil } from '../src/v2/schema.js';
import { menus, profil } from './v2-fixtures.js';

// Batterie de profils difficiles (plan 2026-10-16-app-native §A.9) : la mesure et le rapport sont
// testés ici avec une IA simulée ; le script lui-même tourne contre l'API réelle, hors CI.

const sortieOk = JSON.stringify({ semaines: menus().semaines });
const jetons = { entree: 1000, sortie: 500, cacheLu: 400, cacheEcrit: 100 };

describe('cout', () => {
  it('tarif par million de jetons ; le cache lu et écrit a son propre prix', () => {
    // 500 entrée × 4 + 100 écriture × 5 + 400 lecture × 0,2 + 500 sortie × 20 = 12 580 / 1e6
    expect(cout(jetons, TARIFS['claude-opus-5-5']!)).toBeCloseTo(0.01258, 6);
    expect(cout({ entree: 1_000_000, sortie: 0 }, TARIFS['claude-opus-5-5']!)).toBeCloseTo(4, 6);
  });
});

describe('PROFILS_DIFFICILES', () => {
  it('les 5 profils du plan, tous acceptés par la route', () => {
    expect(PROFILS_DIFFICILES.map((p) => p.nom)).toEqual([
      'keto + sans gluten',
      'végétarien',
      'allergie à l’arachide',
      'Rituel de 10 min',
      'petit budget',
    ]);
    for (const p of PROFILS_DIFFICILES) expect(schemaProfil.safeParse(p.profil).success).toBe(true);
  });
});

describe('executerBatterie', () => {
  it('une mesure par profil et par répétition : issue, appels, jetons, durée', async () => {
    let t = 0;
    const horloge = () => (t += 1000);
    const ia: AppelIA = async () => ({ fin: 'ok', texte: sortieOk, jetons });
    const m = await executerBatterie(ia, [{ nom: 'simple', profil: profil() }], 2, horloge);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ profil: 'simple', ok: true, appels: 1, jetons, dureeMs: 1000 });
    expect(m[0]!.menus?.semaines).toHaveLength(4);
  });

  it('un échec et une exception de l’API sont mesurés, la batterie continue', async () => {
    let n = 0;
    const ia: AppelIA = async () => {
      if (n++ === 0) throw new Error('réseau');
      return { fin: 'refus', texte: '' };
    };
    const m = await executerBatterie(ia, [{ nom: 'a', profil: profil() }], 2);
    expect(m.map((x) => [x.ok, x.raison])).toEqual([
      [false, 'erreur-ia'],
      [false, 'refus'],
    ]);
  });
});

describe('rapport', () => {
  const mesure = (s: Partial<Mesure>): Mesure => ({
    profil: 'p',
    ok: true,
    appels: 1,
    jetons: { entree: 1_000_000, sortie: 0 },
    dureeMs: 60_000,
    ...s,
  });

  it('par profil et au total : conformes au premier essai, réussites, coût et durée', () => {
    const texte = rapport(
      [
        mesure({}),
        mesure({ appels: 3, dureeMs: 120_000 }),
        mesure({ profil: 'q', ok: false, raison: 'non-conforme', appels: 4 }),
      ],
      TARIFS['claude-opus-5-5'],
      3,
    );
    expect(texte).toMatch(/p\s+\|\s+2\s+\|\s+1\/2\s+\|\s+2\/2\s+\|\s+4,00 \$\s+\|\s+1,5 min/);
    expect(texte).toMatch(/q\s+\|\s+1\s+\|\s+0\/1\s+\|\s+0\/1 \(non-conforme\)/);
    expect(texte).toMatch(/Total\s+\|\s+3\s+\|\s+1\/3\s+\|\s+2\/3/);
    // Pire cas d'un foyer : 3 générations par jour au coût maximal, 30 jours.
    expect(texte).toContain('360,00 $');
  });

  it('modèle sans tarif connu : jetons seulement, pas de coût inventé', () => {
    expect(rapport([mesure({})], undefined, 3)).toContain('tarif inconnu');
  });
});
