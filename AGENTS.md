# AGENTS.md

Guide pour les agents IA travaillant sur ce repo. Règles courtes, KISS : si une règle bloque plus qu'elle n'aide, elle est probablement fausse — signalez-le plutôt que de la contourner.

## Le projet

**Rituel** — PWA React (thème clair « Herbes ») de suivi cuisine/diet/sport pour Marc & Mélanie. 100 % front + backend optionnel de sync (Supabase — voir `docs/backend.md`) ; sans configuration, l'app reste strictement locale :

- **UX personnalisée** : au premier lancement, un onboarding en **5 étapes** (profil, infos — date de naissance & taille optionnelles, objectif, compléments & régime, maison & courses) dont **seule l'étape 1 est obligatoire** : carte de profil + prénom « C'est ton prénom ? » (prérempli, modifiable), les suivantes portent un CTA discret « Passer » (le doublon d'objectif de l'étape 4 a disparu) ; le prénom se modifie ensuite dans Mes infos — salutations, titre du suivi et prompt IA l'utilisent — clé `sportapp:profile` ; une **migration préremplie** relance l'onboarding quand un profil de l'ancienne forme est détecté. L'app utilise un **accent unique** (basilic #3e7a46 + citron #f2dc7b, palette Herbes) — plus de teinte par profil — et n'affiche que « ce qui me concerne » + la cuisine
- L'app affiche **2 onglets en nav segmented** sous la bannière : 🛒 Cuisine (Courses / Menu / Mon Rituel, partagé — carte budget courses, panneau dépenses réelles, fiches recettes dépliables, timeline rituel, encadré keto) · 🎯 Mon suivi (cibles/séances/rappels/pesées du profil actif) ; écran **Profil** (infos, maison & courses, changer de profil, « Copier le prompt IA ») via l'icône en haut à droite
- Le contenu : une **semaine d'exemple auto-chargée** au premier lancement (fallback en mémoire, l'app est donc toujours utilisable). L'import .md reste branché dans le hub Profil (action « Importer un cycle (.md) ») — il sera redressé avec la future convention « template » ; le parser `parse.ts` reste la référence du format
- Coches + pesées persistées en **localStorage** (aucune donnée ne quitte le téléphone)
- Déployée en PWA offline-first sur GitHub Pages : https://marcsuarez74.github.io/rituel-app/

## Commandes

```bash
npm install          # après un pull ou un changement de deps
npm run dev          # serveur de dev (hot reload)
npm test             # vitest, une passe
npm run test:watch   # vitest en watch (loop TDD)
npm run e2e          # Playwright (navigateur réel) — projet mobile 375/320 + soumission ; serveur dev auto
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
src/lib/          # cœur logique, zéro React : model.ts (types), parse.ts (.md → WeeklyData),
                  # storage.ts (localStorage), dates.ts (jours FR), rayons.ts (images de rayons),
                  # text.ts (capitalize mutualisé)
src/lib/sync/     # sync optionnelle Supabase : config/session/outbox/client/engine/messages
src/components/   # composants UI ; cuisine/ pour l'onglet Cuisine ; onboarding/ pour le premier lancement ; profil/ pour l'écran Profil (hub cards)
src/assets/       # semaine-exemple.md (référence du format) + prompt-cycle-template.md (prompt maître IA, assemblé par src/lib/promptIa.ts) + rayons/ (miniatures jpg des rayons)
tests/            # miroir de src/, vitest + Testing Library, environnement happy-dom
                  # parse.test.ts, storage.test.ts, weeks.test.ts, lib/rayons.test.ts,
tests/e2e/        # specs Playwright (navigateur réel, config playwright.config.ts, projets mobile 375 + 320)
supabase/         # SQL + edge function + script foyer, hors tsconfig
CHANGELOG.md      # historique des versions (Keep a Changelog) ; source de vérité = package.json `version`
.github/workflows/deploy.yml   # déploie sur GitHub Pages à chaque push sur main
.github/workflows/release.yml  # crée la GitHub Release à chaque push de tag v* (notes = section CHANGELOG)
docs/templates/   # template-semaine.md (référence humaine du format .md) ; le prompt maître IA vit dans src/assets/
docs/ameliorations.md # axes d'amélioration futurs (mémoire d'idées, pas une spec)
docs/superpowers/ # spec design + plan d'implémentation (contexte historique)
ai/               # configs d'agents IA (cf. section « Dossier ai/ »)
```

Règle de répartition : la logique va dans `src/lib/` (testable sans React), les composants restent présentatifs et minces.

## Style de code

- TypeScript strict. Fonctions nommées, exports nommés (pas de default export).
- React 18 : composants fonctionnels, hooks uniquement. Pas de lib d'état ni de contexte — `useState` + props suffisent.
- Si un composant doit re-synchroniser son état quand une prop change (semaine, profil), utiliser le pattern **render-phase reset** (`syncedSemaine`/`syncedProfile`) déjà en place dans `Checklist.tsx`, `ShoppingList.tsx`, `ProfileView.tsx` — ne pas inventer un 4e pattern.
- CSS : un seul fichier `src/index.css`, classes **sémantiques** (`.menu-card`, `.checklist`, `.done`…), variables du design system sur `:root` (tokens Herbes : `--accent` basilic #3e7a46, `--accent-2` citron #f2dc7b — jamais une couleur de texte, typo **Poppins** auto-hébergée). **Thème clair unique** — pas de dark mode, pas de `prefers-color-scheme`, pas de framework CSS. Icônes SVG via `src/components/Icon.tsx` (pas d'émoji dans l'UI, sauf onboarding/salutations). Typo, espacement (échelle 2 px) et interlignage sont tokenisés (`--fs-*`, `--sp-*`, `--lh-*`) — garde-fou : `tests/css-tokens.test.ts`.
- Cibles tactiles ≥ 48 px, contraste ≥ 4.5:1, transitions sur les éléments interactifs seulement. « Ultra visible » est une exigence produit, pas une préférence.
- Textes utilisateur en **français** (accents compris : `Mélanie` == `Melanie` pour le parser).
- YAGNI : pas de nouvelle dépendance sans discussion, pas d'abstraction avant le 2e cas d'usage réel.

## Le contrat .md (ne pas casser)

Le format des fichiers hebdo est un **contrat** : l'app s'en sert pour la semaine d'exemple auto-chargée (`src/assets/semaine-exemple.md` → `parseWeeklyFile` dans `App.tsx`) et il servira à la future convention d'import. Parser (`src/lib/parse.ts`), exemple et README doivent rester cohérents.

- Frontmatter requis : `semaine`, `menu`, `du`, `au` (dates ISO `AAAA-MM-JJ`), `titre` optionnel
- Sections : `## Courses` (### rayons + items, un rayon `### Keto` = encadré dédié), `## Menu` (### jours + `- clé: texte` avec les 5 clés valides, refs `→ <slug recette>` autorisées), `## Batch` (`- [ ]` tâches, ref `→ <slug recette>` optionnelle + `### Rituel dimanche` (étapes `- <créneau> · <label> — <détail>`, ref optionnelle en fin de ligne, lignes-clés `- production:` / `- termine:`) + `### Micro-batch` (`- jour: quoi | durée | quantité → slug | détail` — ` | détail` seul reste accepté) + `### Réserve` (`- <jour|mel>: <plat> | <conservation>`)), `## Recettes` (optionnel : `temps:`, `kcal:`, `proteines:`, `glucides:`, `lipides:`, `score:` (entier 0-10), `image:` (URL https), `bases:`, `- pour 4:`, étapes numérotées, `- mel:`, `- batch:`), `## Bases` (optionnel), `## Marc`, `## Melanie`
- Les ids de coches (`courses:…`, `batch:…`, `batch:rituel:…`, `reserve:{jour|mel}:{slug-plat}`, `menu:{jour}:{clé}`, `seances:marc:…`, `seances:melanie:…`) sont **stables** : ne jamais les modifier, sinon les états cochés se perdent. La ref `→ slug` des tâches/étapes/micro-batch n'entre jamais dans l'id.
- Format v1 (sans Recettes/Bases/Rituel) toujours accepté — les champs optionnels n'apparaissent pas dans l'UI
- Contenu non reconnu → warnings (affichés à l'import), jamais une exception silencieuse ni un crash

## Tests (TDD)

- Nouvelle fonctionnalité ou bugfix = **test d'abord** (rouge), puis implémentation (vert). `npm run test:watch` pour boucler.
- Tests dans `tests/`, nommés en miroir : `parse.test.ts`, `storage.test.ts`, `weeks.test.ts`, `lib/rayons.test.ts`, `lib/text.test.ts`, `components.test.tsx`, `app.test.tsx`.
- `tests/sync/` — sync optionnelle : mock de `lib/sync/config` pour forcer l'activation (sans env, tout est no-op).
- Tester le **comportement visible** (rôles, textes, storage) — pas les détails d'implémentation. Utiliser `userEvent` (pas `fireEvent` sauf cas documenté : `fireEvent.submit` pour les formulaires sous happy-dom, `fireEvent.change` pour l'upload de plusieurs fichiers — `user.upload` n'en livre qu'un).
- Mocks d'horloge : `vi.setSystemTime(new Date('…T10:00:00'))` — toujours la forme avec heure (parse en heure locale), jamais la forme date seule (parse en UTC). Restaurer avec `vi.useRealTimers()`.
- `localStorage.clear()` en `beforeEach` pour l'isolation.

## Storage (localStorage)

Clés existantes — ne pas renommer (données réelles des téléphones) :

- `sportapp:week` — semaine courante (raw + parsée + date d'import)
- `sportapp:weeks` — stock multi-semaines (`{ semaines: { [id]: { raw, data, importedAt } } }`) ; l'ancienne clé `sportapp:week` est migrée à la première lecture puis laissée en place
- `sportapp:profile` — profil actif, **shape v2.2** : `{ id: 'marc'|'melanie', prenom?, dateNaissance?, taille?, poidsObjectif?, objectif: { type: 'perte'|'affiner'|'masse'|'maintien', echeance? }, complements: string[], regime, magasin?, budgetMax?, preferences?: string[], personnes?, repasJour? }` — v2.2 : `prenom` édité (défaut = `PROFILS_META[id].nom`, source unique des prénoms) ; `dateNaissance` et `taille` optionnelles (onboarding sautable — sections silencieuses quand absentes). L'ancienne forme `{ id, age, taille }` est lue par `loadProfilLegacy()` (read-only) pour préremplir l'onboarding de migration, puis écrasée au save
- `sportapp:depenses` — dépenses réelles de courses (`[{ date, magasin, total }]`, trié par date desc, upsert par (date, magasin))
- `sportapp:checks:{semaine}` — coches par semaine
- `sportapp:selection` — dernière semaine consultée (chevrons/commutateur), restaurée à la relance ; fallback = semaine du jour si absente ou inconnue (jamais sync)
- `sportapp:weights:{marc|melanie}` — pesées par profil
- `sportapp:sync:token` — JWT du foyer (sync optionnelle Supabase, voir `docs/backend.md`)
- `sportapp:sync:foyer` — id du foyer connecté
- `sportapp:sync:outbox` — file d'attente des mutations à envoyer

Toute mutation passe par storage.ts, qui empile dans l'outbox via `empilerMutation` (no-op sans env/token).

Toute lecture passe par `safeParse` + garde de forme : une donnée corrompue se répare silencieusement (warn + remove + fallback), elle ne fait **jamais** crasher l'app. Une clé absente est silencieuse (pas de warning).

## PWA & déploiement

- `base: '/rituel-app/'` dans `vite.config.ts` = nom du repo GitHub. Si le repo est renommé, mettre à jour `base` ET l'URL dans le README.
- **CI sur les PR** (`.github/workflows/ci.yml`) : Prepare → Lint → Typecheck → Test → Build — elle doit être verte avant tout merge ; ne pas y ajouter de step lent sans discussion.
- **Deploy sur main** (`.github/workflows/deploy.yml`) : Test unitaire → Build → **Test e2e sur le build de prod** (`npm run e2e:preview`, nécessite `npx playwright install --with-deps chromium webkit`) → Pages. Si un e2e casse le déploiement, corriger et re-pousser (pas de contournement).
- Le déploiement se fait tout seul (push sur `main` → Actions → Pages). Ne pas ajouter de build step qui ne serait pas aussi rapide en CI (le workflow lance déjà `npm ci && npm test && build`).
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
