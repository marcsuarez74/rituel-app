import { vi } from 'vitest';
import {
  creerFoyer,
  demanderSession,
  definirSession,
  effacerSession,
  genererCodeFoyer,
  lireSession,
} from '../../src/lib/sync/session';

// Force l'activation : en vitest, VITE_SYNC_URL est undefined.
vi.mock('../../src/lib/sync/config', () => ({
  SYNC_URL: 'https://rituel.example.fr',
  syncActif: () => true,
}));

describe('sync: session foyer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lireSession est null sans connexion', () => {
    expect(lireSession()).toBeNull();
  });

  it('definirSession puis lireSession restitue token et foyer', () => {
    definirSession('jwt.xxx.yyy', '11111111-2222-3333-4444-555555555555');
    expect(lireSession()).toEqual({
      token: 'jwt.xxx.yyy',
      foyerId: '11111111-2222-3333-4444-555555555555',
    });
  });

  it('effacerSession supprime tout', () => {
    definirSession('t', 'f');
    effacerSession();
    expect(lireSession()).toBeNull();
  });

  it('lireSession est null si un seul des deux champs manque', () => {
    localStorage.setItem('sportapp:sync:token', 't');
    expect(lireSession()).toBeNull();
  });

  it('demanderSession : POST /connexion → { token, foyerId }', async () => {
    const appels: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: RequestInit) => {
        appels.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ token: 'jwt', foyerId: 'f-1' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    await expect(demanderSession('bon-code')).resolves.toEqual({ token: 'jwt', foyerId: 'f-1' });
    expect(appels[0]?.url).toBe('https://rituel.example.fr/connexion');
    expect(appels[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(appels[0]?.init.body))).toEqual({ code: 'bon-code' });
    vi.unstubAllGlobals();
  });

  it('demanderSession : 401 → code-refuse ; 500 → indisponible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));
    await expect(demanderSession('mauvais')).rejects.toThrow('code-refuse');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    await expect(demanderSession('code')).rejects.toThrow('indisponible');
    vi.unstubAllGlobals();
  });

  it('demanderSession : corps incomplet → reponse-invalide', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: 'jwt' }))));
    await expect(demanderSession('code')).rejects.toThrow('reponse-invalide');
    vi.unstubAllGlobals();
  });

  it('creerFoyer : 201 → { foyerId } ; 409 → code-occupe ; 400 → code-trop-court', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ foyerId: 'f-9' }), { status: 201 })));
    await expect(creerFoyer('romarin-basilic-3f9a2c7e')).resolves.toEqual({ foyerId: 'f-9' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"erreur":"code-occupe"}', { status: 409 })));
    await expect(creerFoyer('x')).rejects.toThrow('code-occupe');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"erreur":"code-trop-court"}', { status: 400 })));
    await expect(creerFoyer('x')).rejects.toThrow('code-trop-court');
    vi.unstubAllGlobals();
  });

  it('genererCodeFoyer : mot-mot-8hex, ≥ 12 caractères', () => {
    for (let i = 0; i < 20; i++) {
      const code = genererCodeFoyer();
      expect(code).toMatch(/^[a-z]+-[a-z]+-[0-9a-f]{8}$/);
      expect(code.length).toBeGreaterThanOrEqual(12);
    }
  });
});
