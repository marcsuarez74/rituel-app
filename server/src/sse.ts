// Registre des flux SSE par foyer : diffusion des changements + heartbeat
// 25 s (surchargeable pour les tests). Un flux = un appareil abonné.
export interface FluxSse {
  envoyer: (bloc: string) => void;
  fermer: () => void;
}

export interface RegistreSse {
  /** Enregistre un flux (avec son heartbeat) ; retourne la fonction de retrait. */
  ajouter: (foyerId: string, flux: FluxSse) => () => void;
  /** Diffuse `event: changement` + rev à tous les flux du foyer. */
  diffuser: (foyerId: string, rev: number) => void;
}

export const creerRegistreSse = ({ heartbeatMs = 25_000 }: { heartbeatMs?: number } = {}): RegistreSse => {
  const fluxParFoyer = new Map<string, Set<FluxSse>>();
  const battements = new Map<FluxSse, ReturnType<typeof setInterval>>();

  return {
    ajouter: (foyerId, flux) => {
      let ensemble = fluxParFoyer.get(foyerId);
      if (!ensemble) {
        ensemble = new Set();
        fluxParFoyer.set(foyerId, ensemble);
      }
      ensemble.add(flux);
      const battement = setInterval(() => flux.envoyer(': ping\n\n'), heartbeatMs);
      battements.set(flux, battement);
      return () => {
        clearInterval(battement);
        battements.delete(flux);
        const set = fluxParFoyer.get(foyerId);
        if (!set) return;
        set.delete(flux);
        if (set.size === 0) fluxParFoyer.delete(foyerId);
      };
    },
    diffuser: (foyerId, rev) => {
      const bloc = `event: changement\ndata: ${JSON.stringify({ rev })}\n\n`;
      for (const flux of fluxParFoyer.get(foyerId) ?? []) flux.envoyer(bloc);
    },
  };
};
