import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';

const SECRET = 'secret-de-test-0123456789abcdef';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPVP8 ')]);
const UUID_PNG = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/;

const dossiers: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dossiers.splice(0)) rmSync(d, { recursive: true, force: true });
});

const reponseIssue = () =>
  new Response(JSON.stringify({ number: 42, html_url: 'https://github.com/o/r/issues/42' }), { status: 201 });

type Options = { token?: string | undefined; fetchImpl?: () => Promise<Response> };

const creerContexte = async (opts: Options = {}) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'rituel-bugs-'));
  dossiers.push(dataDir);
  const fetchImpl = vi.fn(opts.fetchImpl ?? (async () => reponseIssue()));
  const db = ouvrirDb(':memory:');
  const app = creerApp({
    db,
    secret: SECRET,
    dataDir,
    bugs: { token: 'token' in opts ? opts.token : 'ghp_secret', fetch: fetchImpl as unknown as typeof fetch },
  });
  await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const { token, foyerId } = (await res.json()) as { token: string; foyerId: string };
  return { db, app, token, foyerId, dataDir, fetchImpl };
};

type Ctx = Awaited<ReturnType<typeof creerContexte>>;

const formulaire = (champs: Record<string, string | Blob> = {}) => {
  const f = new FormData();
  const base: Record<string, string> = {
    titre: 'Le minuteur ne démarre pas',
    type: 'bug',
    description: 'Je clique sur Minuteur et rien ne se passe.',
    device: JSON.stringify({
      appareil: 'iPhone · iOS 18',
      navigateur: 'Safari 18',
      ecran: '390 × 844 @3x',
      langue: 'fr-FR',
      installation: 'PWA installée',
      version: '2.1.0',
      page: 'profil',
    }),
  };
  for (const [k, v] of Object.entries({ ...base, ...champs })) f.set(k, v);
  return f;
};

const poster = (ctx: Pick<Ctx, 'app' | 'token'>, body: FormData) =>
  ctx.app.request('/bugs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.token}`, 'User-Agent': 'UA-de-test/1.0' },
    body,
  });

const fichiersBugs = (dataDir: string): string[] =>
  existsSync(join(dataDir, 'bugs')) ? readdirSync(join(dataDir, 'bugs')) : [];

const corpsEnvoye = (ctx: Ctx) =>
  JSON.parse((ctx.fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) as {
    title: string;
    body: string;
    labels: string[];
  };

describe('server: POST /bugs', () => {
  it('refuse sans jeton de foyer (401)', async () => {
    const { app } = await creerContexte();
    const res = await app.request('/bugs', { method: 'POST', body: formulaire() });
    expect(res.status).toBe(401);
  });

  it('crée une issue GitHub (URL, entêtes, label, titre préfixé) et renvoie son URL', async () => {
    const ctx = await creerContexte();
    const res = await poster(ctx, formulaire());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, issueUrl: 'https://github.com/o/r/issues/42', issueNumber: 42 });

    expect(ctx.fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = ctx.fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/marcsuarez74/rituel-app/issues');
    expect(init.method).toBe('POST');
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer ghp_secret');
    expect(h['X-GitHub-Api-Version']).toBe('2022-11-28');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const corps = corpsEnvoye(ctx);
    expect(corps.title).toBe('[Bug] Le minuteur ne démarre pas');
    expect(corps.labels).toEqual(['bug']);
    expect(corps.body).toContain('## Description');
    expect(corps.body).toContain('Je clique sur Minuteur et rien ne se passe.');
    expect(corps.body).toContain('2.1.0');
    expect(corps.body).toContain('iPhone · iOS 18');
    expect(corps.body).toContain('<details><summary>User-Agent brut</summary>');
    expect(corps.body).toContain('UA-de-test/1.0');
  });

  it('amélioration : préfixe [Amélioration] et label « amélioration »', async () => {
    const ctx = await creerContexte();
    await poster(ctx, formulaire({ type: 'amélioration' }));
    const corps = corpsEnvoye(ctx);
    expect(corps.title).toBe('[Amélioration] Le minuteur ne démarre pas');
    expect(corps.labels).toEqual(['amélioration']);
  });

  it("n'expose ni l'id du foyer ni le jeton GitHub dans l'issue (dépôt public)", async () => {
    const ctx = await creerContexte();
    await poster(ctx, formulaire());
    const [, init] = ctx.fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body as string).not.toContain(ctx.foyerId);
    expect(init.body as string).not.toContain('romarin-basilic');
  });

  it.each([
    ['titre trop court', { titre: 'ab' }],
    ['titre trop long', { titre: 'x'.repeat(121) }],
    ['description trop courte', { description: 'court' }],
    ['description trop longue', { description: 'x'.repeat(4001) }],
    ['type inconnu', { type: 'autre' }],
  ])('400 sur %s, sans appel GitHub ni fichier', async (_nom, champs) => {
    const ctx = await creerContexte();
    const res = await poster(ctx, formulaire({ ...champs, capture: new File([PNG], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(400);
    expect(ctx.fetchImpl).not.toHaveBeenCalled();
    expect(fichiersBugs(ctx.dataDir)).toEqual([]);
  });

  it('device illisible ou démesuré : le corps reste correct', async () => {
    const ctx = await creerContexte();
    await poster(ctx, formulaire({ device: '{pas du json' }));
    expect(corpsEnvoye(ctx).body).toContain('inconnu');
    const ctx2 = await creerContexte();
    await poster(ctx2, formulaire({ device: JSON.stringify({ appareil: 'A'.repeat(500) }) }));
    expect(corpsEnvoye(ctx2).body).not.toContain('A'.repeat(130));
  });

  it('jeton GitHub absent : 503, aucun appel, aucun fichier', async () => {
    const ctx = await creerContexte({ token: undefined });
    const res = await poster(ctx, formulaire({ capture: new File([PNG], 'a.png') }));
    expect(res.status).toBe(503);
    expect(ctx.fetchImpl).not.toHaveBeenCalled();
    expect(fichiersBugs(ctx.dataDir)).toEqual([]);
  });

  it('erreur GitHub : 502 sans fuite, fichier supprimé, quota non consommé', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = await creerContexte({ fetchImpl: async () => new Response('secret-corps-github', { status: 401 }) });
    const res = await poster(ctx, formulaire({ capture: new File([PNG], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('secret-corps-github');
    expect(fichiersBugs(ctx.dataDir)).toEqual([]);
    expect((ctx.db.prepare('select count(*) as n from bug_reports').get() as { n: number }).n).toBe(0);
    const journal = JSON.stringify(erreur.mock.calls);
    expect(journal).not.toContain('ghp_secret');
    expect(journal).not.toContain('secret-corps-github');
  });

  it('échec réseau GitHub : 502 et fichier supprimé', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = await creerContexte({
      fetchImpl: async () => {
        throw new Error('ECONNRESET');
      },
    });
    const res = await poster(ctx, formulaire({ capture: new File([JPEG], 'a.jpg') }));
    expect(res.status).toBe(502);
    expect(fichiersBugs(ctx.dataDir)).toEqual([]);
  });

  it('quota : 3 signalements réussis par jour et par foyer, le 4e → 429 sans fichier orphelin', async () => {
    const ctx = await creerContexte();
    for (let i = 0; i < 3; i += 1) expect((await poster(ctx, formulaire())).status).toBe(200);
    const res = await poster(ctx, formulaire({ capture: new File([PNG], 'a.png') }));
    expect(res.status).toBe(429);
    expect(ctx.fetchImpl).toHaveBeenCalledTimes(3);
    expect(fichiersBugs(ctx.dataDir)).toEqual([]);
  });

  it('les échecs GitHub ne consomment pas le quota', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let n = 0;
    const ctx = await creerContexte({
      fetchImpl: async () => (n++ < 3 ? new Response('', { status: 500 }) : reponseIssue()),
    });
    for (let i = 0; i < 3; i += 1) expect((await poster(ctx, formulaire())).status).toBe(502);
    expect((await poster(ctx, formulaire())).status).toBe(200);
  });

  it("le quota d'hier ne compte pas", async () => {
    const ctx = await creerContexte();
    const hier = new Date(Date.now() - 36 * 3600_000).toISOString();
    for (let i = 0; i < 3; i += 1) {
      ctx.db
        .prepare('insert into bug_reports (foyer_id, type, titre, issue_url, capture_name, created_at) values (?, ?, ?, ?, ?, ?)')
        .run(ctx.foyerId, 'bug', 't', 'u', null, hier);
    }
    expect((await poster(ctx, formulaire())).status).toBe(200);
  });

  it('le quota est par foyer', async () => {
    const ctx = await creerContexte();
    for (let i = 0; i < 3; i += 1) await poster(ctx, formulaire());
    await ctx.app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const r = await ctx.app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const autre = ((await r.json()) as { token: string }).token;
    expect((await poster({ app: ctx.app, token: autre }, formulaire())).status).toBe(200);
  });

  describe('capture', () => {
    it('PNG valide : stockée sous un nom UUID, URL publique en markdown dans l’issue', async () => {
      const ctx = await creerContexte();
      const res = await poster(ctx, formulaire({ capture: new File([PNG], 'ecran.png', { type: 'image/png' }) }));
      expect(res.status).toBe(200);
      const fichiers = fichiersBugs(ctx.dataDir);
      expect(fichiers).toHaveLength(1);
      expect(fichiers[0]).toMatch(UUID_PNG);
      expect(corpsEnvoye(ctx).body).toContain(`![capture](https://rituel.marco-studio.fr/bugs/capture/${fichiers[0]})`);
      const ligne = ctx.db.prepare('select capture_name from bug_reports').get() as { capture_name: string };
      expect(ligne.capture_name).toBe(fichiers[0]);
    });

    it.each([
      ['jpeg', JPEG, 'jpg'],
      ['webp', WEBP, 'webp'],
    ])('%s accepté (extension déduite des magic bytes)', async (_n, buf, ext) => {
      const ctx = await creerContexte();
      const res = await poster(ctx, formulaire({ capture: new File([buf], 'x.bin') }));
      expect(res.status).toBe(200);
      expect(fichiersBugs(ctx.dataDir)[0]).toMatch(new RegExp(`\\.${ext}$`));
    });

    it('faux PNG (mauvais magic bytes) : 400, rien écrit, pas de GitHub', async () => {
      const ctx = await creerContexte();
      const res = await poster(
        ctx,
        formulaire({ capture: new File([Buffer.from('<?php echo 1;')], 'a.png', { type: 'image/png' }) }),
      );
      expect(res.status).toBe(400);
      expect(ctx.fetchImpl).not.toHaveBeenCalled();
      expect(fichiersBugs(ctx.dataDir)).toEqual([]);
    });

    it('capture > 5 Mo : 400', async () => {
      const ctx = await creerContexte();
      const gros = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
      const res = await poster(ctx, formulaire({ capture: new File([gros], 'gros.png') }));
      expect(res.status).toBe(400);
      expect(fichiersBugs(ctx.dataDir)).toEqual([]);
    });
  });
});

describe('server: GET /bugs/capture/:name', () => {
  it('sert publiquement (sans jeton) une capture existante avec le bon type', async () => {
    const ctx = await creerContexte();
    await poster(ctx, formulaire({ capture: new File([PNG], 'a.png') }));
    const nom = fichiersBugs(ctx.dataDir)[0]!;
    const res = await ctx.app.request(`/bugs/capture/${nom}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it.each(['..%2F..%2Fetc%2Fpasswd', 'rituel.db', 'abc.png', '00000000-0000-4000-8000-000000000000.svg', '../x.png'])(
    'nom non conforme %s → 404',
    async (nom) => {
      const ctx = await creerContexte();
      writeFileSync(join(ctx.dataDir, 'rituel.db'), 'x');
      const res = await ctx.app.request(`/bugs/capture/${nom}`);
      expect(res.status).toBe(404);
    },
  );

  it('UUID valide mais fichier absent → 404', async () => {
    const ctx = await creerContexte();
    const res = await ctx.app.request('/bugs/capture/00000000-0000-4000-8000-000000000000.png');
    expect(res.status).toBe(404);
  });
});
