// Message d'erreur de connexion au foyer, partagé par l'UI (ProfilScreen,
// onboarding étape 6) : l'engine distingue code refusé / indisponible —
// l'UI parle utilisateur.
export const messageConnexion = (e: unknown): string =>
  e instanceof Error && e.message === 'code-refuse'
    ? 'Code de foyer refusé.'
    : 'Connexion impossible pour le moment. Réessaie plus tard.';
