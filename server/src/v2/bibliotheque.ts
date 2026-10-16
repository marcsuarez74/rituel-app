import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { ProfilFoyer, Recette } from './contrat.js';
import { controlerRecette, normaliser } from './valider.js';

// Bibliothèque partagée (plan 2026-10-16-app-native §A.8) : les recettes validées, communes à
// tous les foyers. La génération y pioche des plats déjà éprouvés ; l'IA n'écrit que le reste.

/** Foyers distincts qui, en signalant une recette, la retirent de la bibliothèque. */
export const SEUIL_RETRAIT = 3;
export const PIOCHE_MAX = 60;

/** Range des recettes validées, pose leur id de bibliothèque (en place) et met leur photo à faire. Une recette qui en
 * vient déjà (bibliotheque posé) n'est pas rangée deux fois. */
export const ajouterRecettes = (db: Database, recettes: readonly Recette[]): void => {
  const inserer = db.prepare('insert into v2_recettes (id, donnees, cree_le) values (?, ?, ?)');
  const aFaire = db.prepare("insert into v2_photos (recette_id, statut, maj_le) values (?, 'a-faire', ?)");
  const maintenant = new Date().toISOString();
  db.transaction(() => {
    for (const r of recettes) {
      if (r.bibliotheque) continue;
      const { titre, origine, ingredients, etapes, tempsJour, photo } = r;
      r.bibliotheque = randomUUID();
      inserer.run(
        r.bibliotheque,
        JSON.stringify({ titre, origine, ingredients, etapes, tempsJour, photo }),
        maintenant,
      );
      aFaire.run(r.bibliotheque, maintenant);
    }
  })();
};

/** Plats compatibles avec le profil, au hasard, titres dédoublonnés ; id = id de bibliothèque. */
export const piocher = (db: Database, foyerId: string, profil: ProfilFoyer, limite = PIOCHE_MAX): Recette[] => {
  const lignes = db
    .prepare(
      `select r.id, r.donnees from v2_recettes r
       where not exists (select 1 from v2_signalements s where s.recette_id = r.id and s.foyer_id = ?)
         and (select count(*) from v2_signalements s where s.recette_id = r.id) < ?
       order by random()`,
    )
    .iterate(foyerId, SEUIL_RETRAIT) as IterableIterator<{
    id: string;
    donnees: string;
  }>;
  const plats: Recette[] = [];
  const titres = new Set<string>();
  for (const l of lignes) {
    const r = {
      ...(JSON.parse(l.donnees) as Omit<Recette, 'id'>),
      id: l.id,
      bibliotheque: l.id,
    };
    const titre = normaliser(r.titre);
    if (titres.has(titre) || controlerRecette(r, profil).length > 0) continue;
    titres.add(titre);
    plats.push(r);
    if (plats.length >= limite) break; // for…of referme l'itérateur (et la requête)
  }
  return plats;
};

/** false si la recette n'existe pas. Signaler deux fois ne compte qu'une fois. */
export const signaler = (db: Database, foyerId: string, recetteId: string): boolean => {
  if (!db.prepare('select 1 from v2_recettes where id = ?').get(recetteId)) return false;
  db.prepare('insert or ignore into v2_signalements (recette_id, foyer_id, signale_le) values (?, ?, ?)').run(
    recetteId,
    foyerId,
    new Date().toISOString(),
  );
  return true;
};
