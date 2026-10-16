import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';
import { CONTRAT } from '../src/v2/contrat.js';

// API de l'app native (plan 2026-10-16-app-native §A) : routeur à part sous /v2,
// tables v2_* sans lien avec celles de la PWA.
const SECRET = 'secret-de-test-0123456789abcdef';

const creerDist = () => {
  const dir = mkdtempSync(join(tmpdir(), 'rituel-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Rituel</title>');
  return dir;
};

describe('server: /v2 squelette', () => {
  it('GET /v2/contrat → numéro du contrat menu', async () => {
    const app = creerApp({ db: ouvrirDb(':memory:'), secret: SECRET });
    const res = await app.request('/v2/contrat');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ contrat: CONTRAT });
  });

  it('route /v2 inconnue → 404 JSON, jamais la PWA (même avec le statique)', async () => {
    const app = creerApp({ db: ouvrirDb(':memory:'), secret: SECRET, statique: creerDist() });
    const res = await app.request('/v2/nimporte-quoi');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ erreur: 'introuvable' });
  });

  it('la PWA garde ses routes : /sante et / inchangés', async () => {
    const app = creerApp({ db: ouvrirDb(':memory:'), secret: SECRET, statique: creerDist() });
    expect((await app.request('/sante')).status).toBe(200);
    expect(await (await app.request('/')).text()).toContain('<title>Rituel</title>');
  });

  it('ouvrirDb crée les tables v2_*, sans clé étrangère vers celles de la PWA', () => {
    const db = ouvrirDb(':memory:');
    const tables = (
      db.prepare("select name from sqlite_master where type='table' and name like 'v2\\_%' escape '\\'").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    expect(tables).toContain('v2_foyers');
    for (const t of tables) {
      const cibles = (db.prepare(`pragma foreign_key_list(${t})`).all() as { table: string }[]).map((f) => f.table);
      for (const cible of cibles) expect(cible.startsWith('v2_')).toBe(true);
    }
  });
});
