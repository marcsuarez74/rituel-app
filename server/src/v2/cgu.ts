import type { Database } from 'better-sqlite3';

// Version des CGU en vigueur (docs/cgu.md). La changer oblige chaque appareil à accepter
// de nouveau avant de générer des menus : l'app lit GET /v2/cgu et compare.
export const VERSION_CGU = '2026-10-15';

export const cguAcceptees = (db: Database, jetonEmpreinte: string): boolean =>
  db
    .prepare('select 1 from v2_acceptations where jeton_empreinte = ? and version = ?')
    .get(jetonEmpreinte, VERSION_CGU) !== undefined;

// Idempotent : la première date d'acceptation d'une version fait foi.
export const accepterCgu = (db: Database, jetonEmpreinte: string): void => {
  db.prepare('insert or ignore into v2_acceptations (jeton_empreinte, version, accepte_le) values (?, ?, ?)').run(
    jetonEmpreinte,
    VERSION_CGU,
    new Date().toISOString(),
  );
};
