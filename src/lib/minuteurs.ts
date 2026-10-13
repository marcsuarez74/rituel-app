import type { MinuteurStocke } from './storage';

// Minuteurs du rituel batch (spec refonte §5.2, §8) : pur, sans React. On
// persiste l'HEURE DE FIN, jamais un décompte (le téléphone peut dormir) ;
// le temps restant se calcule à la demande.

const M = 60_000;

/** Lance un minuteur : fin = maintenant + minutes. Renvoie une nouvelle liste. */
export function lancer(
  liste: MinuteurStocke[],
  nom: string,
  minutes: number,
  recette: string | undefined,
  maintenant: number,
): MinuteurStocke[] {
  const fin = maintenant + minutes * M;
  return [
    ...liste,
    { id: `m${maintenant.toString(36)}${liste.length}`, nom, recette, fin },
  ];
}

/** Secondes restantes, arrondies au-dessus, 0 une fois la fin passée. */
export const restant = (m: MinuteurStocke, maintenant: number): number =>
  Math.max(0, Math.ceil((m.fin - maintenant) / 1000));

/** Ceux dont la fin est atteinte ou passée (ils restent listés jusqu'au OK). */
export const sonnes = (liste: MinuteurStocke[], maintenant: number): MinuteurStocke[] =>
  liste.filter((m) => m.fin <= maintenant);
