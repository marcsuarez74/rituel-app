import { useCallback, useEffect, useRef, useState } from 'react';
import { lancer, restant as restantDe, sonnes as sonnesDe } from '../lib/minuteurs';
import { loadMinuteurs, saveMinuteurs, type MinuteurStocke } from '../lib/storage';

// Les minuteurs du rituel vivent au niveau d'App (spec refonte §5.2) pour
// survivre aux changements d'étape, d'écran et de mise en arrière-plan :
// l'état dérive de l'heure de fin, un tic de 1 s suffit à tout rafraîchir.

export interface MinuteursRetour {
  minuteurs: MinuteurStocke[];
  sonnes: MinuteurStocke[];
  lance: (nom: string, minutes: number, recette?: string) => void;
  oter: (id: string) => void;
  /** Secondes restantes pour ce minuteur, à l'horloge du tic. */
  restant: (m: MinuteurStocke) => number;
}

export function useMinuteurs(): MinuteursRetour {
  const [minuteurs, setMinuteurs] = useState<MinuteurStocke[]>(loadMinuteurs);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const signales = useRef(new Set<string>());

  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Persistance à chaque changement (lecture initiale via loadMinuteurs).
  useEffect(() => {
    saveMinuteurs(minuteurs);
  }, [minuteurs]);

  const sonnes = sonnesDe(minuteurs, maintenant);
  useEffect(() => {
    for (const m of sonnes) {
      if (signales.current.has(m.id)) continue;
      signales.current.add(m.id);
      navigator.vibrate?.([300, 150, 300]);
    }
  }, [sonnes]);

  const lance = useCallback((nom: string, minutes: number, recette?: string) => {
    setMinuteurs((l) => lancer(l, nom, minutes, recette, Date.now()));
  }, []);

  const oter = useCallback((id: string) => {
    setMinuteurs((l) => l.filter((m) => m.id !== id));
  }, []);

  const restant = useCallback((m: MinuteurStocke) => restantDe(m, maintenant), [maintenant]);

  return { minuteurs, sonnes, lance, oter, restant };
}
