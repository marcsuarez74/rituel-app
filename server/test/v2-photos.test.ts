import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ouvrirDb } from '../src/db.js';
import { creerApp } from '../src/routes.js';
import { VERSION_CGU } from '../src/v2/cgu.js';
import type { AppelIA } from '../src/v2/generer.js';
import { ajouterRecettes } from '../src/v2/bibliotheque.js';
import type { Recette } from '../src/v2/contrat.js';
import {
  creerFilePhotos,
  creerPexels,
  creerVerificationClaude,
  ESSAIS_MAX,
  promptVerification,
  traiterPhoto,
  type Candidate,
  type OutilsPhotos,
} from '../src/v2/photos.js';
import { menus, profil } from './v2-fixtures.js';

// Photos des recettes (plan 2026-10-16-app-native §A.10, spec §10.4) : Pexels et Claude simulés.

const curry = (): Recette => menus().semaines[0]!.recettes.find((r) => r.id === 'curry-1')!;
const poulet = (): Recette => menus().semaines[0]!.recettes.find((r) => r.id === 'poulet-1')!;

const candidates: Candidate[] = [
  { url: 'https://images.pexels.com/1.jpeg', photographe: 'Ana', page: 'https://www.pexels.com/photo/1/' },
  { url: 'https://images.pexels.com/2.jpeg', photographe: 'Bo', page: 'https://www.pexels.com/photo/2/' },
];
const octets = (url: string) => new TextEncoder().encode(`jpeg:${url}`);

const outils = (s: Partial<OutilsPhotos> = {}) => {
  const vues: { requete?: string; verifiees: string[] } = { verifiees: [] };
  const o: OutilsPhotos = {
    chercher: async (q) => ((vues.requete = q), candidates),
    telecharger: async (url) => octets(url),
    // La première candidate montre de la viande : refusée.
    verifier: async (image) => {
      const url = new TextDecoder().decode(image).slice(5);
      vues.verifiees.push(url);
      return url.endsWith('1.jpeg') ? { conforme: false, raison: 'viande visible' } : { conforme: true, raison: '' };
    },
    ...s,
  };
  return { o, vues };
};

const contexte = () => {
  const db = ouvrirDb(':memory:');
  const dossier = mkdtempSync(join(tmpdir(), 'photos-'));
  const r = curry();
  ajouterRecettes(db, [r]);
  return { db, dossier, id: r.bibliotheque! };
};
const ligne = (db: ReturnType<typeof ouvrirDb>, id: string) =>
  db.prepare('select statut, photographe, source, essais from v2_photos where recette_id = ?').get(id);

describe('traiterPhoto', () => {
  it('cherche avec la requête de la recette ; la première candidate conforme est copiée avec son crédit', async () => {
    const { db, dossier, id } = contexte();
    const { o, vues } = outils();
    expect(await traiterPhoto(db, dossier, o, id)).toBe('ok');
    expect(vues.requete).toBe(curry().photo);
    expect(vues.verifiees).toEqual(['https://images.pexels.com/1.jpeg', 'https://images.pexels.com/2.jpeg']);
    expect(readFileSync(join(dossier, `${id}.jpg`))).toEqual(Buffer.from(octets('https://images.pexels.com/2.jpeg')));
    expect(ligne(db, id)).toEqual({
      statut: 'ok',
      photographe: 'Bo',
      source: 'https://www.pexels.com/photo/2/',
      essais: 0,
    });
  });

  it('aucune candidate conforme → « aucune » : jamais de photo trompeuse', async () => {
    const { db, dossier, id } = contexte();
    const { o } = outils({ verifier: async () => ({ conforme: false, raison: 'autre plat' }) });
    expect(await traiterPhoto(db, dossier, o, id)).toBe('aucune');
    expect(existsSync(join(dossier, `${id}.jpg`))).toBe(false);
    expect(ligne(db, id)).toMatchObject({ statut: 'aucune' });
  });

  it('panne (Pexels, téléchargement, vision) → reste à faire ; abandon après ESSAIS_MAX', async () => {
    const { db, dossier, id } = contexte();
    const { o } = outils({
      chercher: async () => {
        throw new Error('503');
      },
    });
    for (let i = 1; i < ESSAIS_MAX; i++) {
      expect(await traiterPhoto(db, dossier, o, id)).toBe('erreur');
      expect(ligne(db, id)).toMatchObject({ statut: 'a-faire', essais: i });
    }
    expect(await traiterPhoto(db, dossier, o, id)).toBe('erreur');
    expect(ligne(db, id)).toMatchObject({ statut: 'aucune', essais: ESSAIS_MAX });
  });
});

describe('creerFilePhotos', () => {
  it('traite toutes les photos à faire, une à la fois ; relancer pendant un passage ne double rien', async () => {
    const db = ouvrirDb(':memory:');
    const dossier = mkdtempSync(join(tmpdir(), 'photos-'));
    ajouterRecettes(db, menus().semaines[0]!.recettes);
    let enCours = 0;
    let max = 0;
    const { o } = outils({
      verifier: async () => {
        max = Math.max(max, ++enCours);
        await new Promise((r) => setTimeout(r, 1));
        enCours--;
        return { conforme: true, raison: '' };
      },
    });
    const file = creerFilePhotos(db, dossier, o);
    file.relancer();
    file.relancer();
    await file.inactive();
    expect(max).toBe(1);
    expect(db.prepare("select count(*) as n from v2_photos where statut = 'ok'").get()).toEqual({ n: 6 });
  });
});

describe('promptVerification', () => {
  it('le plat, ses ingrédients ; « ni viande ni poisson » seulement pour un plat qui n’en a pas', () => {
    const p = promptVerification(curry());
    expect(p).toContain('Curry de lentilles (1)');
    expect(p).toContain('Lentilles corail');
    expect(p).toMatch(/ni viande ni poisson/);
    expect(promptVerification(poulet())).not.toMatch(/ni viande ni poisson/);
  });
});

describe('creerPexels', () => {
  it('recherche paysage, 5 candidates, clé en en-tête ; image « large » et crédit', async () => {
    const appels: { url: string; init?: RequestInit }[] = [];
    const fetch = (async (url: string, init?: RequestInit) => {
      appels.push({ url, init });
      return Response.json({
        photos: [
          {
            url: 'https://www.pexels.com/photo/1/',
            photographer: 'Ana',
            src: { large: 'https://images.pexels.com/1.jpeg' },
          },
        ],
      });
    }) as typeof globalThis.fetch;
    const { chercher } = creerPexels({ cle: 'cle-pexels', fetch });
    expect(await chercher('chickpea curry')).toEqual([
      { url: 'https://images.pexels.com/1.jpeg', photographe: 'Ana', page: 'https://www.pexels.com/photo/1/' },
    ]);
    expect(appels[0]!.url).toBe(
      'https://api.pexels.com/v1/search?query=chickpea+curry&per_page=5&orientation=landscape',
    );
    expect(appels[0]!.init?.headers).toEqual({ Authorization: 'cle-pexels' });
  });

  it('réponse en erreur ou image trop lourde → exception (la file réessaiera)', async () => {
    const ko = (async () => new Response('', { status: 429 })) as unknown as typeof globalThis.fetch;
    await expect(creerPexels({ cle: 'c', fetch: ko }).chercher('x')).rejects.toThrow();
    await expect(
      creerPexels({ cle: 'c', fetch: ko }).telecharger('https://images.pexels.com/1.jpeg'),
    ).rejects.toThrow();
    const lourd = (async () => new Response(new Uint8Array(6 * 1024 * 1024))) as unknown as typeof globalThis.fetch;
    await expect(
      creerPexels({ cle: 'c', fetch: lourd }).telecharger('https://images.pexels.com/1.jpeg'),
    ).rejects.toThrow();
  });

  it('ne télécharge que depuis images.pexels.com', async () => {
    const fetch = (async () => new Response(new Uint8Array(3))) as unknown as typeof globalThis.fetch;
    await expect(creerPexels({ cle: 'c', fetch }).telecharger('https://exemple.fr/x.jpeg')).rejects.toThrow();
  });
});

describe('creerVerificationClaude', () => {
  const simuler = (reponse: Record<string, unknown>) => {
    const params: Record<string, unknown>[] = [];
    const client = {
      beta: {
        messages: {
          create: async (p: Record<string, unknown>) => (params.push(p), reponse),
        },
      },
    } as unknown as Parameters<typeof creerVerificationClaude>[0]['client'];
    return { verifier: creerVerificationClaude({ client, modele: 'claude-haiku-5-5' }), params };
  };

  it('envoie l’image en base64 et la recette ; lit { conforme, raison }', async () => {
    const { verifier, params } = simuler({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"conforme":true,"raison":"lentilles visibles"}' }],
    });
    expect(await verifier(new Uint8Array([1, 2, 3]), curry())).toEqual({
      conforme: true,
      raison: 'lentilles visibles',
    });
    const p = params[0] as {
      model: string;
      messages: { content: { type: string; source?: unknown; text?: string }[] }[];
    };
    expect(p.model).toBe('claude-haiku-5-5');
    expect(p.messages[0]!.content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'AQID' },
    });
    expect(p.messages[0]!.content[1]!.text).toBe(promptVerification(curry()));
    expect(p).toMatchObject({ output_config: { format: { type: 'json_schema' } } });
  });

  it('refus, sortie coupée ou illisible → non conforme (dans le doute, pas de photo)', async () => {
    for (const r of [
      { stop_reason: 'refusal', content: [] },
      { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"conf' }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'oui' }] },
    ])
      expect((await simuler(r).verifier(new Uint8Array([1]), curry())).conforme).toBe(false);
  });
});

describe('GET /v2/photos/:id', () => {
  const SECRET = 'secret-de-test-0123456789abcdef';
  const app = (photos?: ReturnType<typeof creerFilePhotos>, ia?: AppelIA) => {
    const db = ouvrirDb(':memory:');
    const dataDir = mkdtempSync(join(tmpdir(), 'data-'));
    return { db, dataDir, app: creerApp({ db, secret: SECRET, dataDir, v2: { photos, ia } }) };
  };

  it('photo prête → 200 image/jpeg, cache long ; à faire, aucune ou inconnue → 404', async () => {
    const { db, dataDir, app: a } = app();
    const [r1, r2] = [curry(), poulet()];
    ajouterRecettes(db, [r1, r2]);
    await traiterPhoto(db, join(dataDir, 'photos'), outils().o, r1.bibliotheque!);
    const res = await a.request(`/v2/photos/${r1.bibliotheque}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(octets('https://images.pexels.com/2.jpeg'));
    for (const id of [r2.bibliotheque, '00000000-0000-0000-0000-000000000000', '..%2F..%2Fetc'])
      expect((await a.request(`/v2/photos/${id}`)).status).toBe(404);
  });

  it('un menu généré lance la recherche des photos de ses nouveaux plats', async () => {
    const db = ouvrirDb(':memory:');
    const dataDir = mkdtempSync(join(tmpdir(), 'data-'));
    const file = creerFilePhotos(
      db,
      join(dataDir, 'photos'),
      outils({ verifier: async () => ({ conforme: true, raison: '' }) }).o,
    );
    const ia: AppelIA = async () => ({ fin: 'ok', texte: JSON.stringify({ semaines: menus().semaines }) });
    const a = creerApp({ db, secret: SECRET, dataDir, v2: { photos: file, ia } });
    const { jeton } = (await (await a.request('/v2/foyers', { method: 'POST' })).json()) as { jeton: string };
    const json = { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` };
    await a.request('/v2/cgu/acceptation', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ version: VERSION_CGU }),
    });
    expect(
      (
        await a.request('/v2/menus/generer', {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ profil: profil() }),
        })
      ).status,
    ).toBe(200);
    await file.inactive();
    expect(db.prepare("select count(*) as n from v2_photos where statut = 'ok'").get()).toEqual({ n: 24 });
  });
});
