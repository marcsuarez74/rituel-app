# Signaler un bug — plan (2026-10-08)

Spec : `docs/superpowers/specs/2026-10-08-signaler-un-bug-design.md`. TDD à chaque étape.

1. [x] Serveur : table `bug_reports`, `server/src/bugs.ts`, routes `POST /bugs` et
   `GET /bugs/capture/:name`, config d'environnement, tests `routes-bugs.test.ts`.
2. [x] Client : `src/lib/bugs.ts` (état, infos appareil, envoi), `SignalerBug.tsx`, CSS Herbes.
3. [x] Câblage : entrée dans `ProfilScreen`, écran poussé dans `App.tsx`.
4. [x] E2E : `signaler-bug.spec.ts` (+ `VITE_SYNC_URL` pour le serveur dev Playwright).
5. [x] Infra et docs : `docker-compose.yml`, `server/README.md`, `docs/backend.md`.
6. [ ] Actions manuelles : créer le PAT (Issues : Read and write, dépôt `rituel-app`), l'ajouter
   au `.env` du VPS, vérifier/créer les labels `bug` et `amélioration`.
