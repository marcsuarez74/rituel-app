// Registre des flux SSE par foyer — diffusion réelle en Task 6.
export interface FluxSse {
  envoyer: (bloc: string) => void;
  fermer: () => void;
}

export interface RegistreSse {
  ajouter: (foyerId: string, flux: FluxSse) => () => void;
  diffuser: (foyerId: string, rev: number) => void;
}

export const creerRegistreSse = ({ heartbeatMs = 25_000 }: { heartbeatMs?: number } = {}): RegistreSse => {
  const fluxParFoyer = new Map<string, Set<FluxSse>>();
  return {
    ajouter: (foyerId, flux) => {
      let ensemble = fluxParFoyer.get(foyerId);
      if (!ensemble) {
        ensemble = new Set();
        fluxParFoyer.set(foyerId, ensemble);
      }
      ensemble.add(flux);
      void heartbeatMs;
      return () => {
        ensemble!.delete(flux);
        if (ensemble!.size === 0) fluxParFoyer.delete(foyerId);
      };
    },
    diffuser: (foyerId, rev) => {
      void foyerId;
      void rev;
    },
  };
};
