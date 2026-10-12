import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';
import { creerRegistreSse } from '../src/sse.js';

const SECRET = 'secret-de-test-0123456789abcdef';
const CODE = 'romarin-basilic-3f9a2c7e';

const dossiers: string[] = [];
afterEach(() => {
  for (const d of dossiers.splice(0)) rmSync(d, { recursive: true, force: true });
});

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const JSON_H = { 'Content-Type': 'application/json' };

const creerContexte = async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'rituel-sup-'));
  dossiers.push(dataDir);
  const db = ouvrirDb(':memory:');
  const app = creerApp({ db, secret: SECRET, dataDir });
  await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: CODE }) });
  const connexion = async (code = CODE) => {
    const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
    return (await res.json()) as { token: string; foyerId: string };
  };
  const a = await connexion();
  return { db, app, dataDir, connexion, tokenA: a.token, foyerId: a.foyerId };
};

const supprimer = (app: ReturnType<typeof creerApp>, token?: string) =>
  app.request('/foyers/moi', { method: 'DELETE', headers: token ? bearer(token) : {} });

const remplir = async (app: ReturnType<typeof creerApp>, token: string) => {
  await app.request('/sync/etat', {
    method: 'POST',
    headers: { ...JSON_H, ...bearer(token) },
    body: JSON.stringify({ rows: [{ cle: 'foyer', payload: { membres: [] } }] }),
  });
  await app.request('/sync/weights', {
    method: 'POST',
    headers: { ...JSON_H, ...bearer(token) },
    body: JSON.stringify({ rows: [{ profil: 'marc', date_: '2026-10-01', kg: 80 }] }),
  });
};

const compte = (db: ReturnType<typeof ouvrirDb>, table: string): number =>
  (db.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n;

describe('server: DELETE /foyers/moi', () => {
  it('sans jeton ou jeton invalide → 401, rien n’est supprimé', async () => {
    const { app, db, tokenA } = await creerContexte();
    expect((await supprimer(app)).status).toBe(401);
    expect((await supprimer(app, 'pas.un.jeton')).status).toBe(401);
    expect(compte(db, 'foyers')).toBe(1);
    expect((await app.request('/sync/etat', { headers: bearer(tokenA) })).status).toBe(200);
  });

  it('dernier appareil : foyer, données, signalements et captures disparaissent', async () => {
    const { app, db, dataDir, foyerId, tokenA } = await creerContexte();
    await remplir(app, tokenA);
    mkdirSync(join(dataDir, 'bugs'));
    const capture = '11111111-2222-3333-4444-555555555555.png';
    const autre = '99999999-2222-3333-4444-555555555555.png';
    writeFileSync(join(dataDir, 'bugs', capture), 'x');
    writeFileSync(join(dataDir, 'bugs', autre), 'x');
    db.prepare(
      "insert into bug_reports (foyer_id, type, titre, issue_url, capture_name, created_at) values (?, 'bug', 't', 'u', ?, '2026-10-12T10:00:00Z')",
    ).run(foyerId, capture);
    // Un autre foyer ne doit jamais être touché.
    db.prepare("insert into foyers (id, code_hash, created_at) values ('autre', 'h', '2026-01-01T00:00:00Z')").run();
    db.prepare("insert into etat (foyer_id, cle, payload, updated_at) values ('autre', 'k', '{}', 'x')").run();
    db.prepare(
      "insert into bug_reports (foyer_id, type, titre, issue_url, capture_name, created_at) values ('autre', 'bug', 't', 'u', ?, 'x')",
    ).run(autre);

    const res = await supprimer(app, tokenA);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, foyerSupprime: true });

    expect(db.prepare('select id from foyers').all()).toEqual([{ id: 'autre' }]);
    for (const t of ['weeks', 'checks', 'weights', 'depenses', 'profiles', 'sessions']) {
      expect(compte(db, t), t).toBe(0);
    }
    expect(compte(db, 'etat')).toBe(1); // celui de l'autre foyer
    expect(compte(db, 'bug_reports')).toBe(1);
    expect(existsSync(join(dataDir, 'bugs', capture))).toBe(false);
    expect(existsSync(join(dataDir, 'bugs', autre))).toBe(true);
  });

  it('après suppression : le jeton est refusé (401) et le code ne connecte plus', async () => {
    const { app, tokenA } = await creerContexte();
    await supprimer(app, tokenA);
    expect((await app.request('/sync/etat', { headers: bearer(tokenA) })).status).toBe(401);
    expect((await supprimer(app, tokenA)).status).toBe(401);
    const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: CODE }) });
    expect(res.status).toBe(401);
  });

  it('un autre appareil reste : foyer et données intacts, seul le jeton est révoqué', async () => {
    const { app, db, connexion, tokenA, foyerId } = await creerContexte();
    const { token: tokenB } = await connexion();
    expect(tokenB).not.toBe(tokenA);
    await remplir(app, tokenA);

    const res = await supprimer(app, tokenA);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, foyerSupprime: false });

    expect((await app.request('/sync/etat', { headers: bearer(tokenA) })).status).toBe(401);
    expect(compte(db, 'foyers')).toBe(1);
    expect(compte(db, 'weights')).toBe(1);
    expect(compte(db, 'sessions')).toBe(1);
    const lu = await app.request('/sync/etat', { headers: bearer(tokenB) });
    expect(lu.status).toBe(200);
    expect(((await lu.json()) as { rows: unknown[] }).rows).toHaveLength(1);
    expect(db.prepare('select id from foyers').get()).toEqual({ id: foyerId });

    // Le dernier appareil restant, lui, emporte le foyer.
    const fin = await supprimer(app, tokenB);
    expect(await fin.json()).toEqual({ ok: true, foyerSupprime: true });
    expect(compte(db, 'foyers')).toBe(0);
    expect(compte(db, 'weights')).toBe(0);
  });

  it('foyer hérité (jetons non suivis) : jamais supprimé, jeton quand même révoqué', async () => {
    const { app, db, tokenA, foyerId } = await creerContexte();
    db.prepare('update foyers set appareils_suivis = 0 where id = ?').run(foyerId);
    await remplir(app, tokenA);
    const res = await supprimer(app, tokenA);
    expect(await res.json()).toEqual({ ok: true, foyerSupprime: false });
    expect(compte(db, 'foyers')).toBe(1);
    expect(compte(db, 'weights')).toBe(1);
    expect((await app.request('/sync/etat', { headers: bearer(tokenA) })).status).toBe(401);
  });

  it('toutSupprimer sur foyer hérité : foyer, données et captures supprimés; autres jetons → 401', async () => {
    const { app, db, tokenA, foyerId, connexion, dataDir } = await creerContexte();
    db.prepare('update foyers set appareils_suivis = 0 where id = ?').run(foyerId);
    const b = await connexion();
    await remplir(app, tokenA);
    mkdirSync(join(dataDir, 'bugs'), { recursive: true });
    const nom = '11111111-2222-3333-4444-555555555555.png';
    writeFileSync(join(dataDir, 'bugs', nom), 'x');
    db.prepare(
      "insert into bug_reports (foyer_id, type, titre, issue_url, capture_name, created_at) values (?, 'bug', 't', 'u', ?, '2026-10-12T10:00:00Z')",
    ).run(foyerId, nom);

    const res = await app.request('/foyers/moi', {
      method: 'DELETE',
      headers: { ...JSON_H, ...bearer(tokenA) },
      body: JSON.stringify({ toutSupprimer: true }),
    });
    expect(await res.json()).toEqual({ ok: true, foyerSupprime: true });
    expect(compte(db, 'foyers')).toBe(0);
    expect(compte(db, 'weights')).toBe(0);
    expect(compte(db, 'etat')).toBe(0);
    expect(compte(db, 'bug_reports')).toBe(0);
    expect(compte(db, 'sessions')).toBe(0);
    expect(existsSync(join(dataDir, 'bugs', nom))).toBe(false);
    expect((await app.request('/sync/etat', { headers: bearer(b.token) })).status).toBe(401);
    expect((await app.request('/sync/etat', { headers: bearer(tokenA) })).status).toBe(401);
  });

  it('toutSupprimer ≠ true (absent, false, texte) : comportement inchangé', async () => {
    const { app, db, foyerId, connexion } = await creerContexte();
    db.prepare('update foyers set appareils_suivis = 0 where id = ?').run(foyerId);
    for (const corps of ['{"toutSupprimer":false}', '{"toutSupprimer":"true"}', 'pas du json']) {
      const { token } = await connexion(); // le jeton précédent est révoqué
      const res = await app.request('/foyers/moi', { method: 'DELETE', headers: { ...JSON_H, ...bearer(token) }, body: corps });
      expect(await res.json()).toEqual({ ok: true, foyerSupprime: false });
      expect(compte(db, 'foyers')).toBe(1);
    }
  });

  it('jeton valide d’un foyer qui n’existe plus → 401 (le client se déconnecte)', async () => {
    const { app, db, tokenA } = await creerContexte();
    db.prepare('delete from foyers').run();
    expect((await app.request('/sync/etat', { headers: bearer(tokenA) })).status).toBe(401);
  });
});

describe('server: registre SSE — fermerFoyer', () => {
  it('ferme tous les flux du foyer et pas ceux des autres', () => {
    const registre = creerRegistreSse({ heartbeatMs: 1_000_000 });
    const ferme: string[] = [];
    const flux = (nom: string) => ({ envoyer: () => undefined, fermer: () => ferme.push(nom) });
    const retraits = [
      registre.ajouter('f1', flux('a')),
      registre.ajouter('f1', flux('b')),
      registre.ajouter('f2', flux('c')),
    ];
    registre.fermerFoyer('f1');
    expect(ferme.sort()).toEqual(['a', 'b']);
    for (const r of retraits) r();
  });
});
