# Signaler un bug — spec (2026-10-08)

## But
Depuis Profil, un foyer connecté crée une issue GitHub sur `marcsuarez74/rituel-app`
(dépôt public). Modèle : `BugReportClient` de what-shall-we-play, avec ses défauts corrigés.

## Décisions
- Accès réservé à un foyer connecté (middleware `auth`). Sans foyer : l'entrée reste visible
  et explique qu'il faut se connecter (Profil › Foyer). Sans `VITE_SYNC_URL` : écran explicatif.
- Quota : 3 signalements **réussis** par jour (heure locale du serveur) et par foyer,
  table SQLite `bug_reports`. Un échec ne consomme pas le quota.
- Champs : titre 3–120, type `bug|amélioration`, description 10–4000, `device` (JSON de
  7 valeurs courtes), capture facultative PNG/JPEG/WebP ≤ 5 Mo vérifiée par magic bytes.
- Capture écrite dans `<dataDir>/bugs/<uuid>.<ext>`, servie par `GET /bugs/capture/:name`
  public (regex UUID stricte, `nosniff`, cache immuable).
- Ordre serveur : taille → champs → capture → quota → jeton (503) → écriture du fichier →
  GitHub (timeout 10 s). Échec GitHub (502) : fichier supprimé. Corrige le fichier orphelin de WSWP.
- Issue : préfixe `[Bug]`/`[Amélioration]` + label. Corps : description, contexte appareil,
  capture, user-agent. **Jamais** l'id du foyer ni de donnée de santé.
- Le jeton (`GITHUB_BUG_TOKEN`) ne vient que de l'environnement, n'est jamais loggé, ni le corps de réponse.

## Front
Écran poussé `SignalerBug` (état dans `App.tsx`, entrée `hub-action` dans `ProfilScreen`),
bloc « Informations envoyées » transparent, états envoi / succès / réseau / quota / 503.
Tokens Herbes uniquement, aucun scroll horizontal à 320 et 375 px.

## Tests
Serveur : `server/test/routes-bugs.test.ts`. Front : `tests/bugs.test.tsx`,
`tests/profil-screen.test.tsx`. E2E : `tests/e2e/signaler-bug.spec.ts` (dev : parcours
mocké complet ; build de prod sans sync : écran explicatif).
