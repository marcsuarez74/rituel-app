import type { Database } from 'better-sqlite3';

// Tables de l'app native : préfixe v2_, aucune clé étrangère vers les tables de la PWA.
const MIGRATION_V2 = `
create table if not exists v2_foyers (
  id text primary key,                  -- uuid (crypto.randomUUID)
  code_empreinte text not null unique,  -- HMAC-SHA256 du code de 6 caractères (recherche directe)
  cree_le text not null
);
`;

export const migrerV2 = (db: Database): void => {
  db.exec(MIGRATION_V2);
};
