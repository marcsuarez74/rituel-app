# CLAUDE.md — Rituel

PWA React de suivi cuisine/diet/sport pour Marc & Mélanie — https://rituel.marco-studio.fr
(un conteneur Docker sur le VPS sert la PWA et l'API de sync, même origine).

Ce fichier a un seul but : **te faire gagner du temps de travail**. Les règles obligatoires
(TDD, PR obligatoire, clés localStorage immuables, contrat cycle v2, tokens Herbes) vivent
dans **AGENTS.md** — lis-le d'abord, ne les duplique pas ici. Ci-dessous : la carte du dépôt,
le coût réel des vérifications et les pièges déjà payés une fois.

## La règle la plus rentable

**Ce dépôt vit avec plusieurs sessions d'agents en parallèle** (worktrees git dans
`.worktrees/`, git-ignorés — vitest les exclut déjà). Ton contexte périt vite :

- `git fetch origin` **avant tout** — `main` reçoit un merge de PR à chaque chantier
  (cas réel : une PR d'infra a fusionné pendant la rédaction de ce fichier — l'infra
  décrite ci-dessous avait déjà changé).
- Avant d'ouvrir une PR : ta branche doit contenir `origin/main` — `git merge origin/main`
  (jamais de rebase sur `main`, jamais de force-push). La CI PR est exigeante : lint →
  typecheck → test → build **+ check du `server/`** **+ e2e sur le build de prod**
  **+ build de l'image Docker** (`rituel:ci`).
- Un chantier = brainstorming → spec datée dans `docs/superpowers/specs/` → plan dans
  `docs/superpowers/plans/` → TDD.

## Carte du dépôt

| Chemin | Rôle |
|---|---|
| `docs/superpowers/specs/` · `plans/` | un fichier daté par chantier ; le plan s'exécute, la spec fait foi |
| `docs/superpowers/mockups/` | maquettes HTML versionnées (thème Herbes) |
| `ai/agent/` · `ai/context/` | configs d'agents IA — à lire **avant** tout travail dans leur domaine (design-agent pour l'UI) |
| `docs/ameliorations.md` | mémoire d'idées, **pas une spec** |
| `docs/backend.md` + `server/` | API de sync (Hono + SQLite) ; `server/` est un sous-projet : node_modules et scripts à part, `npm run check` |
| `Dockerfile` · `docker-compose.yml` · `deploy/` | image unique PWA + API (prod) ; scripts VPS : déploiement auto, backup, installation — détails dans `server/README.md` |
| `.github/workflows/` | `ci.yml` (PR), `publier.yml` (tag + Release auto sur main), `release.yml` |
| `.superpowers/` | ledger **local, git-ignoré** : brainstorms, décisions, accès VPS, états en cours |
| `CHANGELOG.md` + `package.json` | une entrée par version (Keep a Changelog) ; **la version de `package.json` déclenche tag et Release** |

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
Côté CI PR, s'ajoute le build de l'image Docker : plus long, mais c'est la CI qui l'arbitre.

## E2E : les pièges payés une fois

- WebKit par défaut : après un clone, `npx playwright install webkit chromium`.
- Mode dev (`npm run e2e`) : `reuseExistingServer: !CI` — un serveur **orphelin** sur :5173
  est **adopté avec son état localStorage périmé** (échecs incompréhensibles garantis).
  Avant un run douteux : `lsof -nP -iTCP:5173 -sTCP:LISTEN` et tue l'orphelin.
- `npm run e2e:preview` tourne sur :4173 contre le **build de prod** (`dist/`). La CI PR
  le lance aussi (après installation de Chromium + WebKit) — passe-le **avant** la PR sur
  un changement d'UI plutôt que de le découvrir rouge en CI.
  Une spec verte en dev et rouge en preview (ou l'inverse) : soupçonner le build, pas le test.
- Pas de login : l'état app (profil, semaine) est injecté via `storageState` localStorage —
  pas d'import de modules app dans les specs.
- La règle « jamais de scroll horizontal » est testée **dans les specs** (`setViewportSize`
  sur 320 et 375), pas seulement par les projets Playwright.
- Traces des échecs : `test-results/<test>/trace.zip` → `npx playwright show-trace <fichier>`.

## Release : tout est automatique après le bump

1. branche → PR → CI verte (elle construit l'image) → fusion ;
2. le VPS suit `main` (`deploy/deploy.sh`, timer systemd toutes les 2 min) : pull,
   `docker compose build` + `up -d` + vérification `/sante` — **une PR fusionnée est en
   prod sous ~2 min** ; ne jamais fusionner un état dont l'image ne build pas ;
3. la Release est automatique : `publier.yml` pose le tag `v<version de package.json>`
   s'il manque et crée la GitHub Release depuis le CHANGELOG. **Le bump de version dans la
   PR suffit — jamais de tag à la main** (version non incrémentée = « rien à publier »,
   pas d'erreur).

## Prod et débogage

- Vérifier la prod : `curl -fsS https://rituel.marco-studio.fr/sante` → `{"ok":true}` ;
  le bundle change de hash à chaque déploiement —
  `curl -s https://rituel.marco-studio.fr/ | grep -o 'assets/index-[^"]*\.js'` ;
  la version affichée en bas de l'écran Profil vient de `package.json` au build.
- **La sync est optionnelle** : en local sans `VITE_SYNC_URL`, tout est no-op — un « bug de
  sync » sans env n'en est pas un. En prod, l'image est construite avec
  `VITE_SYNC_URL=https://rituel.marco-studio.fr` (même origine que l'API). Voir `docs/backend.md`.
- **Les accès au VPS (SSH, secrets) vivent dans le ledger local `.superpowers/`
  (git-ignoré)** — jamais d'IP, de clé ou de secret dans un fichier committé.
- **Les clés localStorage sont les données réelles des téléphones** (AGENTS.md §Storage) :
  les renommer détruit silencieusement le suivi de Marc & Mélanie. Mutations via
  `storage.ts`/`cycle/etat.ts`, lectures via `safeParse` — une donnée corrompue se répare,
  elle ne crash jamais.
- **Le contrat cycle v2 est extrait verbatim dans le prompt** (`prompt-cycle-template.md`) :
  toucher à `types.ts`/`schema.ts` = vérifier ensemble types, schema, template et
  `cycle-exemple.json`.
- Bizarreries happy-dom (`fireEvent.submit`, `fireEvent.change` multi-fichiers, horloges
  avec heure) : documentées dans AGENTS.md §Tests — ne pas les redécouvrir.
