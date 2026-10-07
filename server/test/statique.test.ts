import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';

// Le même serveur sert la PWA (dist/) et l'API de sync, sur la même origine.
const creerDist = () => {
  const dir = mkdtempSync(join(tmpdir(), 'rituel-dist-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Rituel</title>');
  writeFileSync(join(dir, 'sw.js'), 'self.addEventListener("fetch", () => {});');
  writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"Rituel"}');
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
  return dir;
};

const app = () => creerApp({ db: ouvrirDb(':memory:'), secret: 'secret-de-test-0123456789abcdef', statique: creerDist() });

describe('server: PWA statique', () => {
  it('/ → index.html, jamais en cache', async () => {
    const res = await app().request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Rituel</title>');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('sw.js et le manifest : revalidés à chaque visite (mises à jour de la PWA)', async () => {
    const a = app();
    for (const f of ['/sw.js', '/manifest.webmanifest']) {
      const res = await a.request(f);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-cache');
    }
  });

  it('assets versionnés : cache long immuable', async () => {
    const res = await app().request('/assets/index-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('chemin sans extension inconnu → index.html (PWA) ; fichier absent → 404', async () => {
    const a = app();
    const res = await a.request('/une/page');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Rituel</title>');
    expect((await a.request('/manquant.png')).status).toBe(404);
  });

  it('l’API garde la main sur ses routes', async () => {
    const a = app();
    expect((await a.request('/sync/checks')).status).toBe(401);
    const sante = await a.request('/sante');
    expect(sante.status).toBe(200);
    expect(await sante.json()).toEqual({ ok: true });
  });
});
