# Spec — Sync : statut honnête et résilient

Date : 2026-09-17 · Statut : validée (design approuvé par Marc — option A)

## Contexte

Trois remontées de terrain après le déploiement de la sync Supabase :

1. **Le point bannière s'affiche sur un appareil non appairé** : sur un build où
   l'env Supabase est compilé, `initSync` pose `attente` (« sync prête, en
   attente d'appairage ») et le point bannière est visible (gris) en
   permanence. Marc s'attend à **aucun point** tant que le foyer n'est pas
   connecté.
2. **Statut figé jusqu'au refresh** : si `connecter()` échoue au démarrage
   (réseau/Supabase momentanément indisponible), `client` reste `null` et
   l'état reste `erreur`. Le tap sur le point ne peut jamais réparer
   (`ressynchroniser` → flush/pull retournent immédiatement sans client) — seul
   un rechargement de page recrée le client.
3. **Coupure du canal websocket invisible** : `canal.subscribe()` n'écoute pas
   le statut du canal — une déconnexion realtime passe inaperçue (l'app croit
   être `sync` alors que les push ne viennent plus).

Bug annexe découvert à l'analyse : après une **déconnexion volontaire**
(`deconnecterFoyer` → `'off'`), le bloc Profil « Synchronisation » disparaît —
impossible de se reconnecter sans recharger.

## Décisions (approuvées)

1. **Option A** — nouvel état `hors-foyer` dans `SyncEtat`, porté par le
   moteur (source de vérité) ; le point bannière n'existe que pour
   `attente`/`sync`/`erreur`.
2. **Tap = reconnexion seulement** (pas de navigation) : avec A, le point
   n'apparaît que si le foyer est appairé, donc le tap a toujours une action
   utile (retenter la connexion ou flush/pull).
3. **Réparation par événements + tap, pas de timer permanent** (YAGNI) :
   retour du réseau, statut du canal, tap.
4. **Pas de WebSockets custom** : Supabase Realtime est déjà un push
   websocket (canal `sync-foyer`, `postgres_changes` filtré par foyer).
5. **Indicateur de présence reporté** : le live à deux téléphones doit être
   testé en réel avant toute nouveauté (checklist de test à la fin du
   chantier).

## Machine à états cible

`SyncEtat = 'off' | 'hors-foyer' | 'attente' | 'sync' | 'erreur'`

| État | Signification | Point bannière | Bloc Profil |
|---|---|---|---|
| `off` | Sync **non compilée** (pas d'env dans le build) | caché | caché |
| `hors-foyer` | Sync disponible, **aucune session** (appareil neuf, ou déconnexion volontaire) | caché | affiché : formulaire « Se connecter au foyer » |
| `attente` | Session présente, opérations en vol (post-connexion, flush/pull en cours) | gris | affiché : statut + déconnexion/purge |
| `sync` | Session présente, outbox vide, pull à jour | vert | idem |
| `erreur` | Échec réseau/serveur (outbox conservée, retry possible) | rouge | idem |

Transitions nouvelles ou modifiées :
- `initSync` sans session → `hors-foyer` (au lieu de `attente`)
- `deconnecterFoyer` → `hors-foyer` (au lieu de `off`) — le formulaire de
  reconnexion reste accessible
- `ressynchroniser` avec `client` null mais session présente → retente
  `connecter()` (recrée client + realtime + post-connexion). Échec →
  `erreur`.
- Statut du canal : fermeture (`TIMED_OUT`/`CLOSED`/`CHANNEL_ERROR`) →
  `erreur` + reconnexion planifiée (5 s, une seule en vol, annulée par
  `deconnecterFoyer`/`reinitialiser`) ; réouverture (`SUBSCRIBED`) → `sync` si
  on n'y était pas.
- Event `online` : si client null + session → `connecter()` ; sinon `flush()`
  (comportement actuel conservé).

## Implémentation

### Engine (`src/lib/sync/engine.ts`)

- Type `SyncEtat` étendu ; `initSync` et `deconnecterFoyer` mis à jour.
- Facteur l'installation du realtime dans une fonction interne
  `installerRealtime()` réutilisable (posée par `connecter`, re-posée par la
  reconnexion planifiée) — le desabonnement courant reste dans `desabonner`.
- `ressynchroniser` : reconnect-first (ci-dessus), sinon flush/pull comme
  aujourd'hui.
- `reinitialiser` (tests) annule aussi la reconnexion planifiée.
- Reconnexion planifiée : `setTimeout` 5 s ; garde « une seule en vol »
  (`reconnexionTimer`), no-op si client non null ou session absente.

### Client (`src/lib/sync/client.ts`)

- `SyncClient.abonner` signe maintenant deux handlers :
  `abonner(onEvenement: () => void, onStatut?: (ouvert: boolean) => void)`.
  Le callback de `canal.subscribe((status) => …)` mappe `SUBSCRIBED` →
  `onStatut?.(true)`, `TIMED_OUT`/`CLOSED`/`CHANNEL_ERROR` → `onStatut?.(false)`.
- Le reste du port étroit est inchangé (upsert/supprimer/toutLire/purger).

### UI

- `WeekBanner` : `syncVisible = syncEtat === 'attente' || 'sync' || 'erreur'`
  (littéralement : `!== 'off' && !== 'hors-foyer'`) ; `ETIQUETTES` passe en
  `Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string>`.
- `ProfilScreen` : le bloc Synchronisation s'affiche si `syncEtat !== 'off'`
  (inchangé) — la branche formulaire (sans session) couvre désormais
  `hors-foyer`. `ETAT_SYNC` gagne la clé `hors-foyer` (jamais affichée, mais
  le `Record<SyncEtat, string>` doit rester exhaustif).
- Onboarding étape 6 : inchangé (appelle `connecterFoyer` directement, sans
  afficher l'état).

## Tests (TDD — `tests/sync/engine.test.ts`, `tests/sync/ui.test.tsx`, composants)

1. `initSync` sans session (sync active) → `etatSync() === 'hors-foyer'`.
2. `deconnecterFoyer` → `hors-foyer` (et plus `off`).
3. UI : point bannière masqué en `hors-foyer` ; bloc Profil affiche le
   formulaire. Point visible en `attente`/`sync`/`erreur` (régression).
4. `ressynchroniser` avec client null + session → appelle `creerClient` (mock)
   et la post-connexion remonte l'état à `sync`.
5. Fermeture du canal (`onStatut(false)`) → `erreur` ; reconnexion auto ~5 s
   → `onStatut(true)` → `sync` (fake timers, une seule tentative en vol).
6. Event `online` sans client + session → `connecter` relancé.
7. `reinitialiser` ne laisse aucun timer fuir (re-run propre).

## Docs

- `CHANGELOG.md` `[Non publié]` › `### Corrigé` : point masqué sans foyer +
  reconnexion auto (statut figé, canal websocket, bloc après déconnexion).
- `docs/backend.md` : mise à jour de la description des états si le tableau
  des états y figure (vérifier `rg "attente" docs/backend.md`).
- `ai/context/ui-guideline.md` : si une puce décrit le point bannière sync,
  l'aligner (vérifier `rg -ni "sync" ai/context/`).

## Checklist de test réel à deux téléphones (post-merge, hors code)

1. A coche un dîner → B le voit apparaître (< ~1 s après debounce 150 ms).
2. B ajoute une pesée → la carte Objectif de A se met à jour.
3. A passe en avion, coche, revient réseau → la coche part (flush) et l'état
   repasse vert.
4. Couper Supabase (pause du projet) → le point passe `erreur` ; le
   réactiver → retour `sync` sans refresh.
5. Déconnecter le foyer sur B → le bloc profil propose la reconnexion.

## Hors périmètre

- Indicateur de présence (autre téléphone en ligne) — à étudier seulement si
  la checklist révèle un besoin réel.
- Toute refonte du transport (websockets custom, polling) — Realtime suffit.
