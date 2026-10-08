# AGENTS.md

Guide pour les agents IA travaillant sur ce repo. Règles courtes, KISS : si une règle bloque plus qu'elle n'aide, elle est probablement fausse — signalez-le plutôt que de la contourner.

## Le projet

**Rituel** — PWA React (thème clair « Herbes ») de routine cuisine (menus, courses, rituel batch) et de suivi diet/sport, pour n'importe quel foyer (né pour Marc & Mélanie). 100 % front + backend optionnel de sync (serveur VPS + SQLite — voir `docs/backend.md`) ; sans configuration, l'app reste strictement locale :

- **Le cycle** (v2.0) : 4 menus A-D d'une semaine chacun + **un seul rituel batch** commun aux 4 semaines, générés par Claude (abonnement, prompt copié depuis Profil › Mon cycle) en 4 fichiers JSON, importés et vérifiés par l'app. Un nouveau cycle se débloque quand les 4 semaines (+ pauses) sont passées ; sinon on relance le même. Sans cycle importé : **cycle d'exemple** chargé à la demande (`src/assets/cycle-exemple.json`, anonymisé — alex/sam/lou/noa sont rattachés au foyer au chargement)
- **Navigation** : barre du bas à 5 onglets (Aujourd'hui · Menu · Courses · Rituel · Suivi), en-tête fin avec l'avatar (Profil) et le point de sync, ligne semaine ‹ Sem. N · Menu X › sur Menu/Courses/Rituel. Écrans poussés : fiche recette, mode guidé, Mon cycle, Ma semaine type, Profil
- **Foyer** (`ReglagesFoyer`) : membres (adultes suivis, enfants sans âge), jour des courses (début de chaque semaine du cycle), jour du rituel, semaine type jour par jour, exceptions récurrentes, magasin, budget hebdo **souple** (alerte, jamais de prix baissés)
- **UX personnalisée** : onboarding en **5 étapes** dont seule l'étape 1 est obligatoire (prénom libre, pour qui on cuisine — partenaire, enfants —, « juste la routine » ou suivi), puis « Partager avec ton foyer » (créer → code ; rejoindre → rattachement « Es-tu X ? », le foyer du serveur gagne ; plus tard) et l'étape optionnelle « Ta semaine » (rythme) ; accent unique (basilic #3e7a46 + citron #f2dc7b) ; le prénom (profil) sert aux salutations et au prompt
- **Suivi** : objectif + poids (séances, cibles, rappels : reportés)
- Coches, reports, pesées persistés en **localStorage**
- Déployée en PWA offline-first sur le VPS : https://rituel.marco-studio.fr (un conteneur Docker sert la PWA et l'API de sync)

## Commandes

```bash
npm install          # après un pull ou un changement de deps
npm run dev          # serveur de dev (hot reload)
npm test             # vitest, une passe
npm run test:watch   # vitest en watch (loop TDD)
npm run e2e          # Playwright (navigateur réel) — projets `mobile-se` (WebKit) et `mobile-375` (Chromium), 320 bouclé dans les specs, + soumission ; serveur dev auto
npm run e2e:preview  # idem contre le BUILD DE PROD (dist/ via vite preview) — utilisé par le workflow Deploy
npm run e2e:ui       # Playwright en mode UI (debug visuel)
npm run typecheck    # tsc -b (couvre src/ ET tests/)
npm run lint         # eslint
npm run build        # tsc + vite build (génère dist/ + service worker)
npm run preview      # sert dist/ en local (teste le build + la PWA)
npm run icons        # régénère les icônes PWA après modification de public/icon-src.svg
```

Avant tout commit : `npm test && npm run typecheck && npm run lint && npm run build` doit passer.
Un changement d'UI responsive → `npm run e2e` doit passer aussi (zéro débordement horizontal sur 320/375 px).

## Tests e2e (Playwright)

- Les specs vivent dans `tests/e2e/*.spec.ts` — **exclues de vitest** (cf. `exclude` dans `vite.config.ts`) et typecheckées comme le reste
- Règle mobile : la page ne doit **jamais** scroller horizontalement (`scrollWidth <= clientWidth` sur 320 et 375) — les flex rows multi-champs utilisent `flex-wrap` + `flex-basis` plancher + `min-width: 0`
- Deux modes : `npm run e2e` (serveur dev, loop local) et `npm run e2e:preview` (build de prod via preview, `E2E_PREVIEW=1`) — la baseURL/l'origine du `storageState` suivent le mode
- Le serveur est lancé automatiquement par la config (`webServer`) ; simuler un état app (profil, semaine) via `storageState` localStorage — pas d'import de modules app
- Les projets `devices[...]` tournent sur WebKit par défaut : `npx playwright install webkit chromium` après un clone (ou `npx playwright install`)

## Structure

```
src/lib/          # cœur logique, zéro React : model.ts (profil), storage.ts (localStorage : profil, coches,
                  # pesées, dépenses), dates.ts, prix.ts, stats.ts, resumes.ts, text.ts, promptIa.ts (prompt maître)
src/lib/cycle/    # le cycle v2 : types.ts (contrat JSON), schema.ts (forme), valider.ts (import, règles, alertes),
                  # calendrier.ts, courses.ts, budget.ts, menu.ts, rituel.ts, reports.ts, monCycle.ts,
                  # etat.ts (foyer, cycle en cours, reports, remise à zéro 2.0), foyer.ts, courant.ts (cycle d'exemple)
src/lib/sync/     # sync optionnelle (serveur VPS) : config/session/outbox/client/sse/engine/messages
src/components/   # shell/ (barre du bas, en-tête, ligne semaine), ecrans/ (un fichier par écran, chargés en React.lazy
                  # sauf Aujourd'hui), menu/ (carte repas, repas du jour + report), onboarding/, profil/ (pages du hub)
src/assets/       # cycle-exemple.json + prompt-cycle-template.md (structure du prompt, rempli par promptIa.ts)
tests/            # miroir de src/, vitest + Testing Library, environnement happy-dom (tests/lib/cycle/fabrique.ts :
                  # cycles minimaux valides) ; tests/ecrans.test.tsx pour les écrans v2
tests/e2e/        # specs Playwright (navigateur réel, config playwright.config.ts, projets mobile 375 + 320)
server/           # serveur de sync VPS (Hono + better-sqlite3), hors tsconfig app ; ses propres scripts `npm run check` (typecheck + lint + test)
CHANGELOG.md      # historique des versions (Keep a Changelog) ; source de vérité = package.json `version`
.github/workflows/publier.yml  # sur main : tag v<version> s'il manque + GitHub Release (via release.yml)
.github/workflows/release.yml  # crée la GitHub Release d'un tag v* (notes = section CHANGELOG)
Dockerfile, docker-compose.yml # image unique PWA + API (prod), deploy/ = scripts VPS (déploiement auto, backup, installation)
docs/ameliorations.md # axes d'amélioration futurs (mémoire d'idées, pas une spec)
docs/superpowers/ # specs + plans (refonte v2 : specs/2026-10-07-refonte-v2-design.md)
ai/               # configs d'agents IA (cf. section « Dossier ai/ »)
```

Règle de répartition : la logique va dans `src/lib/` (testable sans React), les composants restent présentatifs et minces.

## Style de code

- TypeScript strict. Fonctions nommées, exports nommés (pas de default export).
- React 18 : composants fonctionnels, hooks uniquement. Pas de lib d'état ni de contexte — `useState` + props suffisent.
- Si un composant doit re-synchroniser son état quand une prop change (semaine, profil, version de sync), utiliser le pattern **render-phase reset** déjà en place (`useCoches`, `useReports`, `Pesees.tsx`) — ne pas inventer un autre pattern.
- CSS : un seul fichier `src/index.css`, classes **sémantiques** (`.menu-card`, `.checklist`, `.done`…), variables du design system sur `:root` (tokens Herbes : `--accent` basilic #3e7a46, `--accent-2` citron #f2dc7b — jamais une couleur de texte, typo **Poppins** auto-hébergée). **Thème clair unique** — pas de dark mode, pas de `prefers-color-scheme`, pas de framework CSS. Icônes SVG via `src/components/Icon.tsx` (pas d'émoji dans l'UI, sauf onboarding/salutations). Typo, espacement (échelle 2 px) et interlignage sont tokenisés (`--fs-*`, `--sp-*`, `--lh-*`) — garde-fou : `tests/css-tokens.test.ts`.
- Cibles tactiles ≥ 48 px, contraste ≥ 4.5:1, transitions sur les éléments interactifs seulement. « Ultra visible » est une exigence produit, pas une préférence.
- Textes utilisateur en **français**, accents compris.
- YAGNI : pas de nouvelle dépendance sans discussion, pas d'abstraction avant le 2e cas d'usage réel.

## Le contrat du cycle (JSON v2, ne pas casser)

Le JSON produit par Claude est un **contrat** : `src/lib/cycle/types.ts` (types, extrait verbatim dans le prompt entre `// <schema>` et `// </schema>`), `schema.ts` (forme), `valider.ts` (fusion multi-fichiers, erreurs, alertes), le template `src/assets/prompt-cycle-template.md` et `cycle-exemple.json` doivent rester cohérents.

- Fichier : `format: 'rituel-cycle'`, `version: 2`, `titre`, `menus` (1 à 4, un par fichier en pratique), `recettes`, `rituel` (dans menu-A uniquement), `fixes?`, `remarques?`
- Erreurs **bloquantes** (pas de démarrage) : JSON illisible, forme, menus A-D manquants/en double, 7 jours, références cassées (recette, boîte, étape, micro-batch), membre inconnu, variante manquante pour un régime spécifique, macros manquantes d'un membre suivi
- Alertes **non bloquantes** : `remarques`, budget > plafond, < 5 dîners propres par menu, glucides keto > seuil, recette du cycle précédent
- Les ids de coches sont **stables** : `menu:{lettre}:{jour}:{repas.id}`, `courses:{lettre}:{rayon}:{clé}`, `rituel:{lettre}:{etape.id}`, `mise:{lettre}:{n}`, `micro:{lettre}:{microBatch.id}`, `reserve:{lettre}:{clé(plat)}`, `frigo:{lettre}:{clé}` — stockés par semaine du cycle (`cycle:{cycleId}:{n}`). Un report n'est qu'une redirection : il ne change jamais un id.
- Champ inconnu → toléré ; contenu illégal → message clair (« menu-B.json · … »), jamais un crash

## Tests (TDD)

- Nouvelle fonctionnalité ou bugfix = **test d'abord** (rouge), puis implémentation (vert). `npm run test:watch` pour boucler.
- Tests dans `tests/`, nommés en miroir : `storage.test.ts`, `lib/cycle/*.test.ts`, `lib/promptIa.test.ts`, `components.test.tsx`, `ecrans.test.tsx`, `app.test.tsx`.
- `tests/sync/` — sync optionnelle : mock de `lib/sync/config` pour forcer l'activation (sans env, tout est no-op).
- `server/test/` — vitest + SQLite en mémoire (serveur de sync, cf. `docs/backend.md`) ; exclu du vitest racine.
- Tester le **comportement visible** (rôles, textes, storage) — pas les détails d'implémentation. Utiliser `userEvent` (pas `fireEvent` sauf cas documenté : `fireEvent.submit` pour les formulaires sous happy-dom, `fireEvent.change` pour l'upload de plusieurs fichiers — `user.upload` n'en livre qu'un).
- Mocks d'horloge : `vi.setSystemTime(new Date('…T10:00:00'))` — toujours la forme avec heure (parse en heure locale), jamais la forme date seule (parse en UTC). Restaurer avec `vi.useRealTimers()`.
- `localStorage.clear()` en `beforeEach` pour l'isolation.

## Storage (localStorage)

Clés existantes — ne pas renommer (données réelles des téléphones) :

- `sportapp:profile` — profil actif, **shape v2.2** : `{ id, suivi?, prenom?, dateNaissance?, taille?, poidsObjectif?, objectif: { type: 'perte'|'affiner'|'masse'|'maintien', echeance? }, complements: string[], regime, magasin?, budgetMax?, preferences?: string[], personnes?, repasJour? }` (`personnes`/`repasJour` : anciens champs, ignorés, nettoyés à l'enregistrement de Courses & budget) — `id` = identifiant interne jamais affiché (`prénom-xxxx` pour un nouveau profil, `marc`/`melanie` pour les historiques ; garde `estIdProfil`) ; `suivi: false` = « juste la routine » (absent = suivi : pas d'onglet Suivi ni de macros sinon) ; l'ancienne forme `{ id, age, taille }` est lue par `loadProfilLegacy()` (read-only) pour préremplir l'onboarding de migration. Magasin et budget suivent dans le foyer une fois celui-ci enregistré
- `sportapp:foyer` — `ReglagesFoyer` (version 3) ; absent → `foyerParDefaut(profil)` (moi seul) ; au démarrage `assurerMoi` y garde mon membre (`telephone: true`, prénom/suivi/régime du profil)
- `sportapp:cycle` — `CycleActif { id, numero, debut, pauses, cycle, relanceDe? }`
- `sportapp:cycle:precedent` — ids des recettes du cycle précédent (à éviter dans le prompt)
- `sportapp:reports:{cycleId}` — `Report[]` (un par repas)
- `sportapp:checks:cycle:{cycleId}:{n}` — coches de la semaine n du cycle
- `sportapp:v2` — drapeau de la remise à zéro 2.0 (`migrerV2()` au démarrage : efface `sportapp:week`, `sportapp:weeks`, les anciennes `sportapp:checks:*` et `sportapp:selection`, une fois)
- `sportapp:depenses` — dépenses réelles de courses (`[{ date, magasin, total }]`, trié par date desc, upsert par (date, magasin))
- `sportapp:profils:foyer` — profils des AUTRES membres reçus par la sync (`{ [id]: UserProfile }`, lecture seule, jamais poussés) : le prompt détaille chaque membre suivi
- `sportapp:weights:{id du profil}` — pesées par profil (`profilsAvecPesees()` les liste)
- `sportapp:sync:token`, `sportapp:sync:foyer`, `sportapp:sync:outbox`, `sportapp:sync:code` (code du foyer gardé sur le téléphone pour le partager, effacé à la déconnexion) — sync optionnelle (voir `docs/backend.md`) ; tables : `checks`, `weights`, `depenses`, `profiles`, `etat` (foyer, cycle, cycle-precedent, reports:{id} — payload `{ valeur }`). La table serveur `weeks` n'est plus lue par l'app 2.0

Toute mutation passe par `storage.ts` ou `cycle/etat.ts`, qui empilent dans l'outbox via `empilerMutation` (no-op sans env/token).

Toute lecture passe par `safeParse` + garde de forme : une donnée corrompue se répare silencieusement (warn + remove + fallback), elle ne fait **jamais** crasher l'app. Une clé absente est silencieuse (pas de warning).

## PWA & déploiement

- `base: '/'` dans `vite.config.ts` : la PWA est servie à la racine de rituel.marco-studio.fr par le serveur (`server/`, option `statique`), sur la même origine que l'API.
- **CI sur les PR** (`.github/workflows/ci.yml`) : Prepare → Lint → Typecheck → Test → Build — elle doit être verte avant tout merge ; ne pas y ajouter de step lent sans discussion.
- **Déploiement** : le VPS suit `main` (`deploy/deploy.sh`, timer systemd toutes les 2 min) → `docker compose build` + `up -d` + vérification `/sante`. Aucun secret sur GitHub. Une PR fusionnée = en prod sous ~2 min ; ne jamais fusionner un état dont l'image ne build pas (la CI PR construit l'image).
- **Release** : `publier.yml` pose le tag `v<version de package.json>` s'il manque et crée la Release — le bump de version dans la PR suffit, jamais de tag à la main.
- Changement d'infra VPS (Dockerfile, compose, `deploy/`) : documenter dans `server/README.md` ; aucune IP, clé ni secret dans le dépôt.
- Après un changement PWA (manifest, service worker, icônes) : vérifier avec `npm run build && npm run preview` que `dist/` contient `sw.js` + `manifest.webmanifest`.

## Git

- Commits courts en français, préfixe conventionnel : `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `ci:`
- **Tout changement passe par une Pull Request**, même petit : branche dédiée → push → `gh pr create` → CI PR (`.github/workflows/ci.yml`) verte → merge. Ne jamais pousser directement sur `main`.
- Un commit = un changement cohérent. Le merge sur `main` déclenche le déploiement — ne jamais merger un état qui ne build pas.
- Pas de rebase/force-push sur `main`.
- Release : bump **volontaire** via `npm version` (section CHANGELOG renommée avant le bump), tag `v*` poussé après merge — pas de tag sans entrée CHANGELOG (`release.yml` échoue sinon).

## Dossier ai/

`ai/` contient des **configs d'agents IA** à parcourir AVANT tout travail dans leur domaine :

- `ai/agent/<nom>/` — un agent par dossier : `agent.config.json` (rôle, skills, settings) + prompts (`system.prompt.md`, `rules.prompt.md`, `output-format.prompt.md`)
- `ai/context/` — le contexte projet à lire avec l'agent : `project-architecture.md` (stack, patterns, build), `design-system.md` (tokens, source = `src/index.css`), `ui-guideline.md` (règles UI), `performance.md` (budgets, anti-patterns)
- Un travail de design/UI doit suivre `ai/agent/design-agent/` : lire ses prompts et le contexte, adopter son rôle et ses règles

Ces fichiers sont **adaptés à CE projet** (React + Vite + CSS sémantique, thème clair Herbes) — s'ils contiennent du générique non applicable (ex. Tailwind), la contrainte du repo gagne : tokens = variables CSS de `src/index.css`, pas de framework CSS. Si `src/index.css` et `ai/context/design-system.md` divergent, corriger les deux.

## Si quelque chose est ambigu

Demander avant d'implémenter. Mieux : proposer 2 options avec le compromis. Le pire : deviner et construire 200 lignes dans la mauvaise direction.
