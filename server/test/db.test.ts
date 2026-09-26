import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';

const TABLES = ['foyers', 'weeks', 'checks', 'weights', 'depenses', 'profiles'];

describe('server: db', () => {
  it('ouvre la base et crée les 6 tables', () => {
    const db = ouvrirDb(':memory:');
    const noms = (
      db.prepare("select name from sqlite_master where type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    for (const t of TABLES) expect(noms).toContain(t);
    db.close();
  });

  it('foreign_keys actif : enfant sans foyer refusée, cascade à la suppression du foyer', () => {
    const db = ouvrirDb(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.prepare("insert into foyers (id, code_hash, created_at) values ('f1', 'h', '2026-01-01T00:00:00Z')").run();
    expect(() =>
      db.prepare("insert into weeks (foyer_id, semaine, payload, updated_at) values ('inconnu', '2026-S39', '{}', 'x')").run(),
    ).toThrow(/FOREIGN KEY/);
    db.prepare("insert into weeks (foyer_id, semaine, payload, updated_at) values ('f1', '2026-S39', '{}', 'x')").run();
    db.prepare("delete from foyers where id = 'f1'").run();
    expect(db.prepare('select count(*) as n from weeks').get()).toEqual({ n: 0 });
    db.close();
  });

  it('mode WAL sur un fichier', () => {
    const chemin = join(mkdtempSync(join(tmpdir(), 'rituel-')), 'rituel.db');
    const db = ouvrirDb(chemin);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
  });
});
