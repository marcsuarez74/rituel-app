# Supprimer son profil — plan (2026-10-12)

Spec : `docs/superpowers/specs/2026-10-12-supprimer-profil-design.md`. TDD à chaque étape.

1. [x] Serveur : tables `sessions` / `tokens_revoques`, colonne `foyers.appareils_suivis`, `jti`
   dans les jetons, middleware `auth` (foyer existant + non révoqué), `DELETE /foyers/moi`,
   `fermerFoyer` du registre SSE. Tests `routes-supprimer-foyer.test.ts`.
2. [x] Engine : `quitterFoyerServeur` (session.ts) + `supprimerProfil` (engine.ts). Tests
   `tests/sync/supprimer-profil.test.ts`.
3. [x] UI : `SupprimerProfil.tsx`, CSS Herbes (`.zone-danger`, `.bouton-danger`), câblage minimal
   dans `ProfilScreen` (prop `onProfilSupprime`) et `App.tsx` (`reinitialiserApp`).
4. [x] E2E : `supprimer-profil.spec.ts` (dev avec API mockée, preview en local seul).
5. [x] Docs : `docs/backend.md`.
