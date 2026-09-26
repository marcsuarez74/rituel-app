import Database from 'better-sqlite3';

// Schéma de sync (spec 2026-09-26 §3.1) — JSON en text (SQLite), foyer_id au
// lieu de household_id (nouvelle base, pas de legacy), pas de RLS (le serveur
// filtre par le JWT). Noms de colonnes métier identiques à l'actuel : les rows
// échangées avec l'app gardent la même forme.
const MIGRATION = `
create table if not exists foyers (
  id text primary key,            -- uuid (crypto.randomUUID)
  code_hash text not null unique, -- pbkdf2-sha256$100000$salt$hash (b64url)
  rev integer not null default 0, -- compteur de changements (SSE)
  created_at text not null
);
create table if not exists weeks (
  foyer_id text not null references foyers on delete cascade,
  semaine text not null, payload text not null, updated_at text not null,
  primary key (foyer_id, semaine)
);
create table if not exists checks (
  foyer_id text not null references foyers on delete cascade,
  semaine text not null, check_id text not null, done integer not null, updated_at text not null,
  primary key (foyer_id, semaine, check_id)
);
create table if not exists weights (
  foyer_id text not null references foyers on delete cascade,
  profil text not null, date_ text not null, kg real not null, updated_at text not null,
  primary key (foyer_id, profil, date_)
);
create table if not exists depenses (
  foyer_id text not null references foyers on delete cascade,
  date_ text not null, magasin_key text not null, magasin text not null, total real not null, updated_at text not null,
  primary key (foyer_id, date_, magasin_key)
);
create table if not exists profiles (
  foyer_id text not null references foyers on delete cascade,
  profil text not null, payload text not null, updated_at text not null,
  primary key (foyer_id, profil)
);
`;

export const ouvrirDb = (chemin: string): Database.Database => {
  const db = new Database(chemin);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION);
  return db;
};
