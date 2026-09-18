// Décodage du JWT foyer : la signature est déjà vérifiée par Supabase
// (déploiement SANS --no-verify-jwt pour ces fonctions) — on ne lit que les claims.
// Retourne le household_id, ou null si absent/illisible (→ 401 côté appelant).

const b64uDecode = (s: string): string =>
  atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

export const foyerDuJwt = (req: Request): string | null => {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const parties = token.split('.');
  if (parties.length !== 3) return null;
  try {
    const payload = JSON.parse(b64uDecode(parties[1]!)) as { household_id?: unknown };
    return typeof payload.household_id === 'string' && payload.household_id
      ? payload.household_id
      : null;
  } catch {
    return null;
  }
};
