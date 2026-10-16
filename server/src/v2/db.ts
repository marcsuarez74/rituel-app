import type { Database } from 'better-sqlite3';

// Tables de l'app native : préfixe v2_, aucune clé étrangère vers les tables de la PWA.
const MIGRATION_V2 = `
create table if not exists v2_foyers (
  id text primary key,                  -- uuid (crypto.randomUUID)
  code_empreinte text not null unique,  -- HMAC-SHA256 du code de 6 caractères (recherche directe)
  cree_le text not null
);
-- Un appareil connecté = un jeton. Quitter le foyer supprime la ligne : le jeton est refusé.
create table if not exists v2_appareils (
  jeton_empreinte text primary key,     -- sha256 du jeton, jamais le jeton brut
  foyer_id text not null references v2_foyers on delete cascade,
  cree_le text not null,
  expire_le text not null
);
create index if not exists v2_appareils_foyer on v2_appareils (foyer_id);
-- État partagé du foyer : une ligne par entité, « dernière écriture gagne » sur modifie_le.
-- rev = numéro du lot qui l'a écrite (croissant par foyer) : le curseur de GET /v2/sync?depuis=.
-- Une suppression est gardée (supprime = 1) pour que les autres appareils l'apprennent.
create table if not exists v2_entites (
  foyer_id text not null references v2_foyers on delete cascade,
  type text not null,
  id text not null,
  version integer not null,             -- 1 à la création, +1 à chaque écriture acceptée
  donnees text,                         -- JSON ; null si supprimée
  modifie_le text not null,             -- ISO 8601 de l'appareil, normalisé
  supprime integer not null default 0,
  rev integer not null,
  primary key (foyer_id, type, id)
);
create index if not exists v2_entites_rev on v2_entites (foyer_id, rev);
`;

export const migrerV2 = (db: Database): void => {
  db.exec(MIGRATION_V2);
};
