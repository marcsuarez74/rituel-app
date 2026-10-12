# Supprimer son profil — spec (2026-10-12)

## But
Depuis Profil, effacer « tout, serveur compris » : données de l'appareil, et côté serveur
la place de l'appareil dans le foyer (et le foyer lui-même s'il était le dernier).

## Modèle serveur (analyse)
Le serveur ne connaît **pas de membres** : un foyer = un code, des jetons JWT sans état
(`foyerId`), et des données toutes rattachées au foyer (`foyer_id`). Les « membres » sont une
donnée applicative partagée (`etat.foyer`). Il n'existe donc aucune donnée serveur « propre à
un membre » à supprimer sélectivement. Le « membre » côté serveur = un appareil = un jeton.

## Décisions
- Route `DELETE /foyers/moi` (auth Bearer), une transaction SQLite. Réponse
  `{ ok: true, foyerSupprime: boolean }`.
- Jetons : `signerToken` ajoute un `jti` (deux connexions la même seconde donnent deux jetons
  distincts). `/connexion` enregistre l'empreinte sha256 du jeton dans `sessions`
  (foyer, création, expiration). Révocation : `tokens_revoques` (empreinte, expiration), vérifiée
  par le middleware `auth` — qui exige aussi que le foyer existe (jeton d'un foyer supprimé → 401,
  l'engine se déconnecte tout seul).
- **Dernier appareil** : plus aucune session vivante pour le foyer **et** `foyers.appareils_suivis = 1`
  → `delete from foyers` (cascade sur toutes les tables liées, dont `bug_reports`), captures de
  bugs du foyer supprimées du disque après commit, flux SSE fermés (`fermerFoyer`).
- **Autres appareils** : seul le jeton est révoqué, le foyer reste intact (dans le doute on ne
  détruit pas le partagé). Pas de diffusion SSE : rien de partagé n'a changé.
- **Foyers hérités** (créés avant cette fonction : `appareils_suivis = 0` par migration) : leurs
  jetons existants ne sont pas dans `sessions`, on ne peut pas savoir s'il reste des appareils →
  jamais de suppression automatique du foyer (jeton révoqué seulement). Limite assumée; la purge
  existante (Profil › Foyer) vide les données. Les nouveaux foyers (`POST /foyers`) sont suivis.
- Sessions et révocations expirées sont purgées à chaque appel.

## Front
- `SupprimerProfil` (zone dangereuse en bas du hub Profil, `hub-action danger`), dialogue
  `role="alertdialog"` `aria-modal` (piège de focus, Échap/Annuler, focus rendu au déclencheur).
  Confirmation par **saisie du mot SUPPRIMER** (plus sûr qu'une double confirmation qu'on enchaîne
  par réflexe; cohérent avec le bloc « Danger » classique). Le texte liste ce qui est effacé et,
  foyer connecté, ce qui arrive côté serveur.
- Engine : `supprimerProfil({ localSeulement })`. Ordre : (1) appel serveur si session + sync active
  et pas `localSeulement` — échec réseau/5xx = `Error('serveur-injoignable')`, **rien n'est touché**;
  401 = succès (déjà révoqué). (2) `deconnecterFoyer()` : coupe SSE et timers, vide l'outbox,
  efface session et code — avant l'effacement, donc une flush en vol ou un pull tardif voient
  « plus de session » et ne poussent/n'écrivent rien. (3) suppression de **toutes** les clés
  `sportapp:*` (inventaire : profil, pesées, coches, dépenses, profils foyer, foyer, cycle,
  précédent, reports, marqueur v2, clés `sportapp:sync:*`); les autres clés de l'origine ne
  sont pas touchées. (4) état moteur `hors-foyer` (ou `off` sans sync).
- Échec serveur : le dialogue affiche l'erreur, propose « Réessayer » ou « Supprimer quand même
  sur ce téléphone » (local seul, le foyer reste sur le serveur), « Annuler ».
- `App.tsx` : `reinitialiserApp` remet tous les états à zéro → `profile = null` → onboarding.
- Sans `VITE_SYNC_URL` ou sans foyer : aucun appel réseau.

## Tests
Serveur : `server/test/routes-supprimer-foyer.test.ts` (dernier appareil, autre appareil, hérité,
401, jeton révoqué, SSE). Front : `tests/sync/supprimer-profil.test.ts` (engine),
`tests/supprimer-profil-ui.test.tsx`, `tests/supprimer-profil-app.test.tsx`.
E2E : `tests/e2e/supprimer-profil.spec.ts` (annulation, suppression, 320/375, foyer mocké,
réseau coupé).

## Amendement 2026-10-12 — « dernier appareil > on supprime tout »
Les foyers hérités n'étaient jamais supprimés (limite assumée plus haut). Décision : l'utilisateur
peut l'affirmer lui-même.
- **Dialogue** (foyer connecté seulement) : case non cochée par défaut « Je suis le dernier
  appareil de ce foyer — supprimer aussi toutes les données du foyer sur le serveur. Les autres
  membres perdront l'accès et leurs données. » Remise à zéro à la fermeture. Sans foyer : absente.
- **Requête** : `DELETE /foyers/moi` avec corps `{ "toutSupprimer": true }` (+ `Content-Type`)
  seulement si cochée; sinon aucun corps (inchangé). Pas envoyée en « supprimer quand même sur
  ce téléphone » (local seul).
- **Serveur** : `toutSupprimer === true` court-circuite le test « dernier appareil » (même
  transaction, même cascade, captures, SSE) — pas de duplication. Le foyer disparu, `auth`
  répond 401 à tous les autres jetons.
- **Autres appareils** : tout 401 (pull, flush) → `deconnecterFoyer()` (déjà existant). Corrigé
  ici : un 401 sur le flux SSE `/evenements` faisait une reconnexion toutes les 5 s sans fin;
  `abonnerSse` signale désormais le refus (`onStatut(false, true)`) et l'engine se déconnecte
  aussi. L'appareil reste utilisable en local (données conservées, état « hors foyer »,
  possibilité de créer/rejoindre un foyer) — aucune boucle de resync, aucun crash.
- **Tests** : serveur (foyer hérité tout supprimé, 401 sur autre jeton, option absente/invalide
  inchangée), front (case visible seulement avec foyer, transmise; corps JSON; SSE 401),
  e2e (requête mockée avec/sans paramètre, 320/375).
