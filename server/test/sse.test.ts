import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';

const SECRET = 'secret-de-test-0123456789abcdef';

interface FluxOuvert {
  res: Response;
  lire: () => Promise<string>;
}

const ouvrirFlux = async (app: ReturnType<typeof creerApp>, token: string): Promise<FluxOuvert> => {
  const res = await app.request('/evenements', { headers: { Authorization: `Bearer ${token}` } });
  const lecteur = res.body!.getReader();
  const decodeur = new TextDecoder();
  let tampon = '';
  return {
    res,
    lire: async (): Promise<string> => {
      const { done, value } = await lecteur.read();
      if (done) return tampon;
      tampon += decodeur.decode(value, { stream: true });
      return tampon;
    },
  };
};

const creerContexte = async () => {
  const db = ouvrirDb(':memory:');
  const app = creerApp({ db, secret: SECRET, heartbeatMs: 10 });
  await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const res = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'romarin-basilic-3f9a2c7e' }) });
  const token = ((await res.json()) as { token: string }).token;
  return { db, app, token };
};

describe('server: SSE /evenements', () => {
  it('headers text/event-stream', async () => {
    const { app, token } = await creerContexte();
    const { res } = await ouvrirFlux(app, token);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('mutation → event changement + rev diffusé aux flux du foyer', async () => {
    const { app, token } = await creerContexte();
    const a = await ouvrirFlux(app, token);
    const b = await ouvrirFlux(app, token); // 2ᵉ appareil, même foyer
    await app.request('/sync/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rows: [{ semaine: 's', check_id: 'c', done: true }] }),
    });
    const luA = await a.lire();
    const luB = await b.lire();
    expect(luA).toContain('event: changement');
    expect(luA).toContain('"rev":1');
    expect(luB).toContain('event: changement');
  });

  it('rien pour un autre foyer', async () => {
    const { app, token } = await creerContexte();
    await ouvrirFlux(app, token);
    await app.request('/foyers', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const resAutre = await app.request('/connexion', { method: 'POST', body: JSON.stringify({ code: 'thym-menthe-12345678' }) });
    const autre = await ouvrirFlux(app, ((await resAutre.json()) as { token: string }).token);
    await app.request('/sync/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rows: [{ semaine: 's', check_id: 'c', done: true }] }),
    });
    expect(await autre.lire()).not.toContain('changement');
  });

  it('heartbeat : ping périodique (heartbeatMs=10)', async () => {
    const { app, token } = await creerContexte();
    const { lire } = await ouvrirFlux(app, token);
    await new Promise((r) => setTimeout(r, 50));
    expect(await lire()).toContain(': ping');
  });

  it('purge diffuse aussi un changement (rev incrémenté)', async () => {
    const { app, token } = await creerContexte();
    const { lire } = await ouvrirFlux(app, token);
    await app.request('/sync', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const lu = await lire();
    expect(lu).toContain('event: changement');
    expect(lu).toContain('"rev":1');
  });

  it('sans token → 401', async () => {
    const { app } = await creerContexte();
    const res = await app.request('/evenements');
    expect(res.status).toBe(401);
  });
});
