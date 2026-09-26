// Fenêtre glissante en mémoire (~10 req/min/IP sur /connexion et /foyers).
// Suffisant à l'échelle du foyer, zéro dépendance ; les vieilles entrées sont
// taillées à l'accès (une IP sans trafic disparaît de la carte d'elle-même).
export type Limiteur = (clef: string) => boolean;

export const creerLimiteur = ({
  max,
  fenetreMs,
}: {
  max: number;
  fenetreMs: number;
}): Limiteur => {
  const hits = new Map<string, number[]>();
  return (clef) => {
    const maintenant = Date.now();
    const recents = (hits.get(clef) ?? []).filter((t) => maintenant - t < fenetreMs);
    if (recents.length >= max) {
      hits.set(clef, recents);
      return false;
    }
    recents.push(maintenant);
    hits.set(clef, recents);
    return true;
  };
};

