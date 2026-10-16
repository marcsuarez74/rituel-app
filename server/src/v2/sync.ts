import type { Database } from 'better-sqlite3';

// État partagé du foyer (plan §A.3). Pas de SSE en v1 : l'app tire à l'ouverture,
// au retour au premier plan et en tirant l'écran vers le bas.

export const MAX_ENTITES_PAR_LOT = 500;
export const MAX_OCTETS_PAR_ENTITE = 512 * 1024;

export interface EntitePoussee {
  type: string;
  id: string;
  donnees: unknown;
  modifie_le: string;
  supprime: boolean;
}

export interface EntiteTiree extends EntitePoussee {
  version: number;
}

const TYPE = /^[a-z][a-z0-9-]{0,31}$/;

// Tout le lot ou rien : une seule entité invalide → null.
export const validerLot = (brut: unknown): EntitePoussee[] | null => {
  if (!Array.isArray(brut) || brut.length > MAX_ENTITES_PAR_LOT) return null;
  const lot: EntitePoussee[] = [];
  for (const e of brut) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    const { type, id, donnees, modifie_le, supprime } = e as Record<string, unknown>;
    if (typeof type !== 'string' || !TYPE.test(type)) return null;
    if (typeof id !== 'string' || id.length === 0 || id.length > 128) return null;
    if (!('donnees' in e) || donnees === undefined) return null;
    if (supprime !== undefined && typeof supprime !== 'boolean') return null;
    if (typeof modifie_le !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(modifie_le)) return null;
    const date = new Date(modifie_le);
    if (Number.isNaN(date.getTime())) return null;
    if (Buffer.byteLength(JSON.stringify(donnees)) > MAX_OCTETS_PAR_ENTITE) return null;
    lot.push({ type, id, donnees: supprime ? null : donnees, modifie_le: date.toISOString(), supprime: supprime === true });
  }
  return lot;
};

export const revCourante = (db: Database, foyerId: string): number =>
  (db.prepare('select coalesce(max(rev), 0) as rev from v2_entites where foyer_id = ?').get(foyerId) as { rev: number })
    .rev;

// Écrit le lot sous un seul nouveau rev. Une écriture plus ancienne (ou du même instant)
// que celle connue est ignorée et renvoyée à l'appareil, qui la remplacera au prochain tirage.
export const pousser = (
  db: Database,
  foyerId: string,
  lot: EntitePoussee[],
): { rev: number; ignorees: { type: string; id: string }[] } =>
  db.transaction(() => {
    const rev = revCourante(db, foyerId) + 1;
    const lire = db.prepare('select version, modifie_le from v2_entites where foyer_id = ? and type = ? and id = ?');
    const ecrire = db.prepare(
      `insert into v2_entites (foyer_id, type, id, version, donnees, modifie_le, supprime, rev)
       values (@foyerId, @type, @id, 1, @donnees, @modifie_le, @supprime, @rev)
       on conflict (foyer_id, type, id) do update set
         version = version + 1, donnees = excluded.donnees, modifie_le = excluded.modifie_le,
         supprime = excluded.supprime, rev = excluded.rev`,
    );
    const ignorees: { type: string; id: string }[] = [];
    let ecrites = 0;
    for (const e of lot) {
      const connue = lire.get(foyerId, e.type, e.id) as { modifie_le: string } | undefined;
      if (connue && e.modifie_le <= connue.modifie_le) {
        ignorees.push({ type: e.type, id: e.id });
        continue;
      }
      ecrire.run({
        foyerId,
        type: e.type,
        id: e.id,
        donnees: e.supprime ? null : JSON.stringify(e.donnees),
        modifie_le: e.modifie_le,
        supprime: e.supprime ? 1 : 0,
        rev,
      });
      ecrites++;
    }
    return { rev: ecrites > 0 ? rev : rev - 1, ignorees };
  })();

export const tirer = (db: Database, foyerId: string, depuis: number): EntiteTiree[] =>
  (
    db
      .prepare(
        `select type, id, version, donnees, modifie_le, supprime from v2_entites
         where foyer_id = ? and rev > ? order by rev, type, id`,
      )
      .all(foyerId, depuis) as {
      type: string;
      id: string;
      version: number;
      donnees: string | null;
      modifie_le: string;
      supprime: number;
    }[]
  ).map((l) => ({
    type: l.type,
    id: l.id,
    donnees: l.donnees === null ? null : (JSON.parse(l.donnees) as unknown),
    modifie_le: l.modifie_le,
    supprime: l.supprime === 1,
    version: l.version,
  }));
