# CLAUDE.md — Rituel

PWA React de suivi cuisine/diet/sport pour Marc & Mélanie — https://marcsuarez74.github.io/rituel-app/

Ce fichier a un seul but : **te faire gagner du temps de travail**. Les règles obligatoires
(TDD, PR obligatoire, clés localStorage immuables, contrat cycle v2, tokens Herbes) vivent
dans **AGENTS.md** — lis-le d'abord, ne les duplique pas ici. Ci-dessous : la carte du dépôt,
le coût réel des vérifications et les pièges déjà payés une fois.

## La règle la plus rentable

**Ce dépôt vit avec plusieurs sessions d'agents en parallèle** (worktrees git dans
`.worktrees/`, git-ignorés — vitest les exclut déjà). Ton contexte périt vite :

- `git fetch origin` **avant tout** — `main` reçoit un merge de PR à chaque chantier.
- Avant d'ouvrir une PR : ta branche doit contenir `origin/main` — `git merge origin/main`
  (jamais de rebase sur `main`, jamais de force-push). La CI PR est exigeante : lint →
  typecheck → test → build **+ check du `server/`**.
- Un chantier = brainstorming → spec datée dans `docs/superpowers/specs/` → plan dans
  `docs/superpowers/plans/` → TDD.

## Carte du dépôt

| Chemin | Rôle |
|---|---|
| `docs/superpowers/specs/` · `plans/` | un fichier daté par chantier ; le plan s'exécute, la spec fait foi |
| `docs/superpowers/mockups/` | maquettes HTML versionnées (thème Herbes) |
| `ai/agent/` · `ai/context/` | configs d'agents IA — à lire **avant** tout travail dans leur domaine (design-agent pour l'UI) |
| `docs/ameliorations.md` | mémoire d'idées, **pas une spec** |
| `docs/backend.md` + `server/` | sync optionnelle (Hono + SQLite, VPS) ; `server/` est un sous-projet : node_modules et scripts à part, `npm run check` |
| `.superpowers/` | ledger **local, git-ignoré** : brainstorms, décisions, états en cours |
| `CHANGELOG.md` + `package.json` | une entrée par version (Keep a Changelog) ; `package.json` fait foi pour le tag |

## Coût réel des vérifications (mesuré en local, 2026-10-07)

| Commande | Durée | Quand |
|---|---|---|
| `npm test` (422 tests, 34 fichiers) | ~4 s | boucle TDD et avant chaque commit |
| `npm run typecheck` | ~3 s | avant chaque commit |
| `npm run lint` | ~4 s | avant chaque commit |
| `npm run build` | ~7 s | avant chaque commit |
| `npm run e2e` (48 tests, 2 projets mobiles) | ~15 s | tout changement d'UI responsive |
| `npm run check` dans `server/` (37 tests) | ~8 s | si tu touches à `server/` (après `npm ci` dans `server/`) |

Le gate complet avant commit (`npm test && npm run typecheck && npm run lint && npm run build`)
coûte **~18 s** : aucune raison de le sauter — et la suite E2E n'est pas un luxe ici.

## E2E : les pièges payés une fois

- WebKit par défaut : après un clone, `npx playwright install webkit chromium`.
- Mode dev (`npm run e2e`) : `reuseExistingServer: !CI` — un serveur **orphelin** sur :5173
  est **adopté avec son état localStorage périmé** (échecs incompréhensibles garantis).
  Avant un run douteux : `lsof -nP -iTCP:5173 -sTCP:LISTEN` et tue l'orphelin.
- `npm run e2e:preview` tourne sur :4173 contre le **build de prod** (`dist/`) — c'est ce que
  lance le workflow Deploy. Une spec verte en dev et rouge en preview (ou l'inverse) :
  soupçonner le build, pas le test.
- Pas de login : l'état app (profil, semaine) est injecté via `storageState` localStorage —
  pas d'import de modules app dans les specs.
- La règle « jamais de scroll horizontal » est testée **dans les specs** (`setViewportSize`
  sur 320 et 375), pas seulement par les projets Playwright.
- Traces des échecs : `test-results/<test>/trace.zip` → `npx playwright show-trace <fichier>`.

## Release : le déploiement est auto, le bump est manuel

1. branche → PR → CI verte → fusion ;
2. le merge sur `main` **déploie tout seul** (Deploy : test unitaire → build → e2e sur build
   de prod → GitHub Pages) ;
3. la release est un **geste volontaire** : entrée `CHANGELOG.md` (section renommée au
   numéro final) → `npm version patch|minor|major` → push du tag `v*` → la CI crée la
   release GitHub depuis le CHANGELOG. **Tag sans entrée CHANGELOG = release.yml en échec.**

## Prod et débogage

- Vérifier qu'un déploiement est passé : le bundle change de hash à chaque build —
  `curl -s https://marcsuarez74.github.io/rituel-app/ | grep -o 'assets/index-[^"]*\.js'`.
  Le hash local peut différer à code égal : la CI injecte `VITE_SYNC_URL` au build.
- **La sync est optionnelle** : sans `VITE_SYNC_URL`, tout est no-op. Un « bug de sync » en
  local sans env n'en est pas un (voir `docs/backend.md`).
- **Les clés localStorage sont les données réelles des téléphones** (AGENTS.md §Storage) :
  les renommer détruit silencieusement le suivi de Marc & Mélanie. Mutations via
  `storage.ts`/`cycle/etat.ts`, lectures via `safeParse` — une donnée corrompue se répare,
  elle ne crash jamais.
- **Le contrat cycle v2 est extrait verbatim dans le prompt** (`prompt-cycle-template.md`) :
  toucher à `types.ts`/`schema.ts` = vérifier ensemble types, schema, template et
  `cycle-exemple.json`.
- Bizarreries happy-dom (`fireEvent.submit`, `fireEvent.change` multi-fichiers, horloges
  avec heure) : documentées dans AGENTS.md §Tests — ne pas les redécouvrir.
