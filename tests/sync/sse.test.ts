// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { abonnerSse } from '../../src/lib/sync/sse';

// Stream contrôlé par le test : envoyer/fermer depuis le scénario.
const streamControle = (): {
  stream: ReadableStream<Uint8Array>;
  envoyer: (s: string) => void;
  fermer: () => void;
} => {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start: (c) => {
      ctrl = c;
    },
  });
  const encodeur = new TextEncoder();
  return {
    stream,
    envoyer: (s) => ctrl.enqueue(encodeur.encode(s)),
    fermer: () => {
      try {
        ctrl.close();
      } catch {
        /* déjà fermé */
      }
    },
  };
};

describe('sync: lecteur SSE (fetch)', () => {
  it('flux ouvert → onStatut(true) ; event changement → onChangement ; ping ignoré ; fermeture → onStatut(false)', async () => {
    const s = streamControle();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(s.stream)));
    const statuts: boolean[] = [];
    let changements = 0;
    abonnerSse('https://rituel.example.fr/evenements', 'tok', () => changements++, (o) => statuts.push(o));
    await vi.waitFor(() => expect(statuts).toEqual([true]));
    s.envoyer(': ping\n\n');
    s.envoyer('event: changement\ndata: {"rev":2}\n\n');
    await vi.waitFor(() => expect(changements).toBe(1));
    s.fermer();
    await vi.waitFor(() => expect(statuts).toEqual([true, false]));
    vi.unstubAllGlobals();
  });

  it('fetch en échec (500) → onStatut(false) sans crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const statuts: boolean[] = [];
    abonnerSse('https://rituel.example.fr/evenements', 'tok', () => {}, (o) => statuts.push(o));
    await vi.waitFor(() => expect(statuts).toEqual([false]));
    vi.unstubAllGlobals();
  });

  it('abort volontaire (désabonnement) → pas de onStatut(false) parasite', async () => {
    const s = streamControle();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(s.stream)));
    const statuts: boolean[] = [];
    const annuler = abonnerSse('https://rituel.example.fr/evenements', 'tok', () => {}, (o) => statuts.push(o));
    await vi.waitFor(() => expect(statuts).toEqual([true]));
    annuler();
    await new Promise((r) => setTimeout(r, 20));
    expect(statuts).toEqual([true]);
    vi.unstubAllGlobals();
  });
});
