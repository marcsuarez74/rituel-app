// Message d'erreur de connexion au foyer, partagé par l'UI (ProfilScreen,
// onboarding étape 6) : l'engine distingue code refusé / indisponible —
// l'UI parle utilisateur.
export const messageConnexion = (e: unknown): string =>
  e instanceof Error && e.message === 'code-refuse'
    ? 'Code de foyer refusé.'
    : 'Connexion impossible pour le moment. Réessaie plus tard.';

// Message d'erreur de création de foyer (ProfilFoyer) — symétrique de
// messageConnexion : la session distingue, l'UI parle utilisateur.
export const messageCreation = (e: unknown): string =>
  e instanceof Error && e.message === 'code-occupe'
    ? 'Ce code est déjà pris — relance « Créer un foyer » (un nouveau code sera généré).'
    : 'Création impossible pour le moment. Réessaie plus tard.';
