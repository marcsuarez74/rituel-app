# Sync — réduire la latence de bout en bout

**Date** : 2026-09-17 · **Statut** : approuvé (design validé oralement, 3 réglages retenus)

## Problème

La promesse de la spec sync (« coche visible sur l'autre téléphone en ~1 s »,
répétée dans `docs/backend.md` l.91) n'est pas tenue : mesuré sur le terrain,
le délai est de 2 s à 4 s. Décomposition du chemin « coche sur A → apparaît
sur B » :

| Étape | Délai | Source |
|---|---|---|
| A : debounce flush après mutation | **2 000 ms** (ré-armé à chaque mutation) | `engine.ts` `flushDiffere` |
| A : upsert vers Supabase | ~100-300 ms | réseau |
| Realtime → B (websocket) | ~50-100 ms | Supabase |
| B : debounce avant pull | **500 ms** (ré-armé à chaque event) | `installerRealtime` |
| B : pull lit 5 tables **séquentiellement** | ~500-1 500 ms | `pull` en `for...await` |

Total typique : ~3-4 s. Le coupable principal est le debounce de flush de 2 s,
hérité de la spec initiale (batching des rafales) — le batching se garde, mais
pas à ce prix.

## Objectif

« Je coche sur A → ça apparaît sur B » en **~0,5-1 s**, sans changer
l'architecture (option « payload embarqué dans les events realtime » écartée :
plus gros chantier, validation à dupliquer, gain non nécessaire pour 2
téléphones dans une cuisine).

## Changements (3 réglages, `src/lib/sync/engine.ts` uniquement)

1. **Debounce flush 2 000 → 300 ms** (`flushDiffere`).
   Le reset du timer à chaque mutation est conservé : une rafale de coches
   part en un seul upsert groupé 300 ms après la dernière mutation. La dédup
   « dernier op gagne » par clé (outbox) rend les flush fréquentes peu
   coûteuses — une flush n'envoie que le delta.
2. **Debounce pull 500 → 150 ms** (`installerRealtime`, event data + rattrapage
   post-coupure). Le batching des 3-4 events d'une même flush (une par table
   touchée) subsiste : ils arrivent à quelques ms d'intervalle et ne
   déclenchent qu'un pull.
3. **Pull parallèle** : `pull()` lit aujourd'hui les 5 tables en
   `for...await` (5 RTT séquentiels). Passe à `Promise.all` sur `TABLES`
   (1 RTT). La garde « session disparue en vol → n'écrire rien » reste,
   vérifiée après l'attente et avant `appliquerRemote`. Même parallélisation
   dans `postConnexion` (bonus : connexion au foyer plus rapide).

## Règles inchangées

- Outbox-prime, fencing flush (une seule en vol), dédup outbox, purge serveur
  d'abord, reconnexion 5 s après coupure de canal.
- Écho : après sa propre flush, A reçoit ses events realtime et re-pull —
  ~1 RTT (lectures parallèles), merge no-op sans re-rendu. Accepté.
- Volume de requêtes légèrement accru (flush 6× plus fréquentes) — négligeable
  pour un foyer de 2.

## Tests (TDD — rouge d'abord, `tests/sync/engine.test.ts`)

- Test debounce flush réécrit pour 300 ms : advance 200 → `flushDiffere()`
  (reset) → advance 299 → rien ; +10 → une seule flush groupée.
- Nouveau test pull parallèle : faux client dont `toutLire` résout en
  microtask différée ; compter les lectures **démarrées** avant la première
  résolution → 5 (le `for...await` séquentiel en démarre une seule).
- Tests existants insensibles aux constantes (pull après debounce : `runAllTimersAsync`).

## Docs

- `docs/backend.md` : « Flush différée de 2 s » → « ~300 ms » (résumé) ; la
  promesse « ~1 s » devient vraie.
- `docs/superpowers/specs/2026-09-16-sync-supabase-design.md` l.113 :
  « flush différée ~2 s » → « ~300 ms ».
- `CHANGELOG.md` `[Non publié]` → `### Changé` : coche visible en < 1 s.

## Gates

`npm test && npm run typecheck && npm run lint && npm run build` puis
`npm run e2e` (zéro débordement inchangé). Livraison : branche → PR → CI
verte → merge (règle repo).
