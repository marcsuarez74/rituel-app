// Lecteur SSE basé sur fetch (~40 lignes) : EventSource ne sait pas poser
// d'en-tête Authorization — ici le token voyage en en-tête, rien dans les
// logs proxy. La reconnexion n'est PAS gérée ici : sur coupure on émet
// onStatut(false) et c'est engine.ts (planifierReconnexion, 5 s) qui
// réappelle abonner() — mécanisme existant inchangé.
export const abonnerSse = (
  url: string,
  token: string,
  onChangement: () => void,
  onStatut: (ouvert: boolean) => void,
): (() => void) => {
  const ctrl = new AbortController();
  void (async () => {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`sse-${res.status}`);
      onStatut(true);
      const lecteur = res.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = '';
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const blocs = tampon.split('\n\n');
        tampon = blocs.pop() ?? '';
        for (const bloc of blocs) {
          const changement = bloc
            .split('\n')
            .some((l) => l.startsWith('event:') && l.slice(6).trim() === 'changement');
          if (changement) onChangement();
        }
      }
      onStatut(false); // flux fermé proprement = coupure vue par l'engine
    } catch (e) {
      if ((e as { name?: string } | null)?.name !== 'AbortError') onStatut(false);
    }
  })();
  return () => ctrl.abort();
};
