import Database from 'better-sqlite3';
import { migrerV2 } from './v2/db.js';

// Schéma de sync (spec 2026-09-26 §3.1) — JSON en text (SQLite), foyer_id au
// lieu de household_id (nouvelle base, pas de legacy), pas de RLS (le serveur
// filtre par le JWT). Noms de colonnes métier identiques à l'actuel : les rows
// échangées avec l'app gardent la même forme.
const MIGRATION = `
create table if not exists foyers (
  id text primary key,            -- uuid (crypto.randomUUID)
  code_hash text not null unique, -- pbkdf2-sha256$100000$salt$hash (b64url)
  rev integer not null default 0, -- compteur de changements (SSE)
  created_at text not null,
  appareils_suivis integer not null default 0 -- 1 = tous les jetons du foyer sont dans sessions (spec 2026-10-12)
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
-- v2 : état générique (foyer, cycle, reports…), une ligne par clé, dernier écrit gagne.
create table if not exists etat (
  foyer_id text not null references foyers on delete cascade,
  cle text not null, payload text not null, updated_at text not null,
  primary key (foyer_id, cle)
);
-- Signalements "Signaler un bug" : sert au quota quotidien (3 par foyer et par jour).
create table if not exists bug_reports (
  foyer_id text not null references foyers on delete cascade,
  type text not null, titre text not null, issue_url text not null,
  capture_name text, created_at text not null
);
create index if not exists bug_reports_foyer on bug_reports (foyer_id, created_at);
-- Appareils connectés (un jeton émis par /connexion = une ligne) : sert à savoir si
-- un appareil qui quitte le foyer en est le dernier. Clé = sha256 du jeton.
create table if not exists sessions (
  token_hash text primary key,
  foyer_id text not null references foyers on delete cascade,
  created_at text not null,
  expire_at text not null
);
create index if not exists sessions_foyer on sessions (foyer_id);
-- Jetons révoqués (suppression de profil) : refusés en 401 jusqu'à leur expiration.
create table if not exists tokens_revoques (
  token_hash text primary key,
  expire_at text not null
);
`;

export const ouvrirDb = (chemin: string): Database.Database => {
  const db = new Database(chemin);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION);
  // Bases antérieures à la suppression de profil : colonne ajoutée à 0 (foyers « hérités »,
  // dont des jetons non suivis peuvent encore circuler → jamais supprimés automatiquement).
  const colonnes = db.prepare('pragma table_info(foyers)').all() as { name: string }[];
  if (!colonnes.some((c) => c.name === 'appareils_suivis')) {
    db.exec('alter table foyers add column appareils_suivis integer not null default 0');
  }
  migrerV2(db);
  return db;
};
