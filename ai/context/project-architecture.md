# Architecture Technique — Rituel

## Vue d'ensemble

**Rituel** est une PWA frontend (sync optionnelle sur un VPS, cf. `docs/backend.md`) de suivi cuisine / diet / sport pour Marc & Mélanie. Le contenu est un **cycle de 4 menus + un rituel batch** au format JSON v2, généré par Claude et importé dans l'app ; sans cycle, le cycle d'exemple est chargé à la demande. Les données utilisateur vivent en `localStorage`.

Déployée sur le VPS : https://rituel.marco-studio.fr (conteneur Docker : PWA + API de sync, même origine)

---

## Stack Technique

| Élément | Choix | Version |
|---|---|---|
| UI | React (composants fonctionnels, hooks uniquement) | 18.3 |
| Build | Vite + @vitejs/plugin-react | 7.x |
| Langage | TypeScript strict (mode strict complet) | 5.9 |
| Tests | Vitest + Testing Library (happy-dom) | 5.x |
| PWA | vite-plugin-pwa (Workbox, autoUpdate) | 1.x |
| Styling | CSS pur, un seul fichier `src/index.css`, **thème clair Herbes** | — |
| Lint | ESLint 9 (flat config) + typescript-eslint + react-hooks | 9.x |

**Volontairement absent** : routeur, lib d'état (Redux/Zustand/NGXS), framework CSS (Tailwind/MUI), i18n, Sentry. `useState` + props suffisent — ne rien ajouter sans discussion.

---

## Structure du Projet

```
src/
├── App.tsx               # Shell : onboarding → « Ta semaine » → barre du bas 5 onglets ; écrans poussés
├── main.tsx              # migrerV2() (remise à zéro 2.0, une fois) puis rendu
├── lib/                  # Cœur logique, ZÉRO React (testable isolément)
│   ├── model.ts          # Profil (UserProfile, objectifs, régimes, PROFILS_META)
│   ├── storage.ts        # localStorage : profil, coches, pesées, dépenses
│   ├── promptIa.ts       # Prompt maître du cycle (template + foyer + schéma de types.ts)
│   ├── cycle/            # Le cycle v2
│   │   ├── types.ts      # Contrat JSON (entre // <schema> et // </schema> : recopié dans le prompt)
│   │   ├── schema.ts     # Mini-schéma de forme, sans dépendance
│   │   ├── valider.ts    # Import multi-fichiers : fusion, erreurs bloquantes, alertes
│   │   ├── calendrier.ts # Dates calculées : semaine courante, pauses, fin, prochain cycle
│   │   ├── courses.ts / budget.ts  # Liste de courses calculée, estimation, payé
│   │   ├── menu.ts / rituel.ts / reports.ts  # Repas du jour, ids de coches, report
│   │   ├── etat.ts / foyer.ts      # Foyer, cycle en cours, reports (stockage + sync `etat`)
│   │   ├── monCycle.ts   # Verrou, démarrage, relance, pause
│   │   └── courant.ts    # Cycle d'exemple (chunk séparé, membres rattachés au foyer)
│   └── sync/             # Sync optionnelle (outbox, engine, client, SSE)
├── components/
│   ├── shell/            # BarreOnglets, EnTete (avatar + point de sync), LigneSemaine
│   ├── ecrans/           # Aujourdhui (bundle initial) ; Menu, Courses, Rituel, Suivi, Recette,
│   │                     # Guide, MonCycle, SemaineType en React.lazy
│   ├── menu/             # CarteRepas, RepasDuJour (feuille de report + toast)
│   ├── profil/           # Pages du hub Profil
│   ├── onboarding/       # 5 étapes (+ étape 6 sync)
│   └── useCoches.ts / useReports.ts  # Render-phase reset sur la semaine / la version de sync
├── assets/
│   ├── cycle-exemple.json        # Cycle d'exemple anonymisé
│   └── prompt-cycle-template.md  # Structure du prompt (aucune donnée perso)
└── index.css             # Design system complet (tokens + composants)

tests/                    # Miroir de src/ (lib/cycle/fabrique.ts : cycles minimaux valides)
tests/e2e/                # Playwright mobile 320 / 375 (zéro débordement horizontal)
public/                   # Icônes PWA (générées via npm run icons)
.github/workflows/ci.yml      # CI des PR : lint → types → tests → build → serveur → e2e preview → image Docker
.github/workflows/publier.yml # main : tag + Release ; le VPS se déploie seul (deploy/deploy.sh)
docs/superpowers/         # Specs + plans (refonte v2 : specs/2026-10-07-refonte-v2-design.md)
ai/                       # Contexte et configs pour agents IA
```

**Règle de répartition** : la logique va dans `src/lib/` (pure, testable sans React) ; les composants restent minces et présentatifs.

---

## Patterns Architecturaux

### 1. Flux de données unidirectionnel

```
Claude (prompt maître) → menu-A..D.json → importerCycle (fusion, erreurs, alertes)
                                        → saveCycle() → localStorage (+ outbox sync `etat`)
                                   ↓
App (loadCycle ?? cycle d'exemple, loadFoyer ?? foyerParDefaut) → calendrier (semaine courante)
                                   ↓
écrans (Aujourd'hui, Menu, Courses, Rituel…) → calculs purs de lib/cycle → coches / reports → storage
```

### 2. Render-phase reset (resynchronisation)

Un composant dont l'état dépend d'une prop qui peut changer (semaine du cycle, profil, version de sync) se resynchronise **pendant le rendu** via un garde `synced` — voir `useCoches`, `useReports`, `Pesees.tsx`. C'est LE pattern du repo : ne pas en inventer un autre (pas de `useEffect` de sync).

### 3. IDs stables de coche

`menu:{lettre}:{jour}:{repas}`, `courses:{lettre}:{rayon}:{clé}`, `rituel:{lettre}:{étape}`, `mise:{lettre}:{n}`, `micro:{lettre}:{id}`, `reserve:{lettre}:{clé}`, `frigo:{lettre}:{clé}`, stockés par semaine du cycle (`cycle:{id}:{n}`). Ces ids sont **la clé de persistance** : un report ne les change jamais.

### 4. Tolérance aux données corrompues

Toute lecture localStorage passe par `safeParse` + garde de forme : donnée illisible → warn + suppression + fallback. Une clé absente est silencieuse. L'app ne crash **jamais** sur une donnée locale abîmée.

### 5. Import tolérant, contrat strict

Les champs inconnus du JSON sont tolérés ; tout écart au contrat produit un message clair préfixé du fichier (« menu-B.json · … »), recopiable pour Claude (« Copier pour Claude »). Erreurs bloquantes et alertes non bloquantes sont décrites dans `valider.ts`.

---

## Configuration Build

- `base: '/'` — PWA servie à la racine par le serveur Hono (`STATIC_DIR`)
- `npm run build` = `tsc -b && vite build` → `dist/` avec `sw.js` + `manifest.webmanifest`
- Icônes : `npm run icons` (régénère les PNG depuis `public/icon-src.svg`)
- Preview locale du build : `npm run preview` (vérifier manifest, sw)

---

## Déploiement

- Image Docker unique (`Dockerfile`) : build Vite de la PWA + serveur Hono/better-sqlite3 ; `docker-compose.yml` publie `127.0.0.1:8787` derrière Caddy, base dans `./data`
- Le VPS suit `main` : `deploy/deploy.sh` (timer systemd, 2 min) → pull, build, up, `/sante`
- Tag + Release automatiques après fusion (`publier.yml`) quand la version de `package.json` change

---

## Tests

- Vitest, environnement `happy-dom`, globals activés, `@testing-library/jest-dom/vitest`
- `tests/` inclus dans `tsconfig.app.json` (le typecheck couvre les tests)
- TDD : test d'abord (rouge), implémentation ensuite (vert)
- Tester le comportement visible (rôles ARIA, textes, localStorage), jamais les détails internes
