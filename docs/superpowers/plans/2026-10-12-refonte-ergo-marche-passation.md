# Passation — intégration de la refonte « Marché coloré »

Date : 2026-10-12 · destinataire : l'agent qui exécute l'intégration (GLM 5.2) · donneur
d'ordre : Marc.

La conception est **terminée et validée par Marc**. Ton travail est d'**intégrer**, pas de
redessiner. En cas de conflit entre ce fichier et la spec, **la spec fait foi** ; entre la spec
et la maquette pour un rendu visuel, **la maquette fait foi**.

---

## 1. Prompt à donner à l'agent (copier-coller)

```text
Tu travailles sur le dépôt Rituel (PWA React + TypeScript, sans routeur ni lib d'état).
Ta mission : intégrer la refonte ergonomique « Marché coloré », déjà conçue et validée.

Lis d'abord, dans cet ordre, sans rien modifier :
1. docs/superpowers/plans/2026-10-12-refonte-ergo-marche-passation.md (ce brief, en entier)
2. AGENTS.md puis CLAUDE.md (règles obligatoires du dépôt)
3. docs/superpowers/specs/2026-10-12-refonte-ergo-marche.md (spec + plan + annexe A des valeurs)
4. docs/superpowers/mockups/2026-10-12-refonte-ergo-marche.html (maquette : ouvre-la dans un
   navigateur et lis son code source ; couleurs, SVG et textes y sont)
5. ai/agent/design-agent/ et ai/context/ (règles UI)

Exécute ensuite UNIQUEMENT la PR indiquée par Marc (par défaut : PR 1), en suivant la section
« Partie II — Plan » de la spec, en TDD, puis arrête-toi et rends ton rapport au format du §7
du brief. Ne commence jamais la PR suivante sans feu vert de Marc. Ne fusionne jamais de PR toi-même.
Réponds et écris en français, avec les accents.
```

---

## 2. Où en est le dépôt

- `main` contient la spec, son annexe et les maquettes (PR #68 et #69).
- La **tâche 0** du plan (vérifications préalables) est **faite** : ses résultats sont dans la
  spec (Partie II, « Tâche 0 ») et ont déjà corrigé la spec. Ne la refais pas.
- Rien n'est implémenté. Point de départ de chaque PR : `origin/main` à jour.

## 3. Ordre de lecture du code (avant la PR 1)

| Fichier | Pourquoi |
|---|---|
| `src/index.css` | tous les tokens et toutes les classes (un seul fichier CSS) |
| `tests/css-tokens.test.ts` | contraintes CSS testées : `font-size` et `line-height` via `var(--fs-*)`/`var(--lh-*)`, **aucun px brut** dans padding/margin/gap (tokens `--sp-*`) |
| `src/App.tsx` | onglets et écrans poussés en `useState`, rendus anticipés dans l'ordre |
| `src/components/shell/*` | barre d'onglets, en-tête, ligne semaine |
| `src/lib/cycle/types.ts` | contrat des menus (bloc `// <schema>` extrait **verbatim** dans le prompt IA) |
| `src/lib/cycle/etat.ts`, `src/lib/storage.ts` | toutes les lectures/écritures localStorage |
| `src/lib/sync/outbox.ts`, `engine.ts` | ce qui est synchronisé (liste blanche de tables) |

## 4. Règles non négociables

1. **Clés localStorage** : ne jamais renommer, supprimer ou changer le format d'une clé
   existante. Ce sont les données réelles des téléphones de Marc et Mélanie. Ajouts seulement,
   lectures via `safeParse`, écritures via `storage.ts` / `cycle/etat.ts`.
2. **Contrat des menus** : uniquement des champs **optionnels** ajoutés, `version` reste `2`.
   Tout changement touche ensemble `types.ts`, `schema.ts`, `valider.ts`,
   `src/assets/prompt-cycle-template.md` et `src/assets/cycle-exemple.json`. Un ancien fichier
   (sans `plats` ni `minuteurs`) doit rester valide : **test obligatoire**.
3. **Vocabulaire** : le mot « cycle » n'apparaît dans **aucun texte visible** par
   l'utilisateur. Le programme de 4 semaines = « menus ». « Rituel » = la session de cuisine du
   dimanche. Les identifiants de code (`cycle/`, `saveCycle`, `CycleActif`…) ne changent pas.
4. **TDD** : test rouge d'abord, puis le code, puis vert. Tests par rôles et textes
   (`getByRole`), `userEvent`, `vi.setSystemTime` avec une heure, `localStorage.clear()` en
   `beforeEach`. Bizarreries happy-dom : voir AGENTS.md §Tests.
5. **Style de code** : TypeScript strict, exports nommés (pas de `export default`), hooks,
   logique pure dans `src/lib/` (sans React), composants minces. **Aucune nouvelle
   dépendance npm** (confettis, illustrations, minuteurs : faits maison). Pas de Tailwind, pas
   de dark mode, icônes via `src/components/Icon.tsx`, pas d'émoji comme icône.
6. **UI** : cibles ≥ 48 px, contraste ≥ 4,5:1, **jamais de scroll horizontal** à 320 et 375 px,
   une seule action pleine par écran, `prefers-reduced-motion` respecté.
7. **Maquette d'abord** : un écran ou un état **absent de la maquette** (et non décrit dans la
   spec) → tu t'arrêtes et tu le signales à Marc. Tu n'inventes pas d'UI.
8. **Git** : une branche par PR depuis `origin/main`, commits courts en français au format
   conventionnel (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`). Avant d'ouvrir la PR :
   `git fetch origin && git merge origin/main` (**jamais** de rebase ni de force-push).
   **Jamais** de modification manuelle de `package.json` `version`, `CHANGELOG.md`,
   `.release-please-manifest.json`, ni de tag : release-please s'en charge. Tu ne fusionnes
   pas : **une PR fusionnée part en prod en 2 minutes**, c'est Marc qui fusionne.
9. **Secrets** : aucune IP, clé ni secret dans un fichier committé.

## 5. Vérifications à chaque PR

```sh
# boucle TDD et avant chaque commit (~18 s au total)
npm test && npm run typecheck && npm run lint && npm run build

# avant d'ouvrir la PR (UI responsive)
lsof -nP -iTCP:5173 -sTCP:LISTEN   # tuer un éventuel serveur orphelin (état périmé adopté)
npm run e2e
npm run e2e:preview                # contre le build de prod, la CI le lance aussi
```

- Première fois : `npx playwright install webkit chromium`.
- Projets Playwright : `mobile-se` (WebKit) et `mobile-375` (Chromium) ; 320 px est bouclé
  dans les specs.
- Cibler un test : `npx vitest run tests/<fichier>.test.ts -t "nom"` ;
  `npx playwright test tests/e2e/<spec>.spec.ts --project=mobile-375 -g "nom"`.
- Pas de `VITE_SYNC_URL` en local : la sync est un no-op, ce n'est pas un bug.
- Si tu touches `server/` (ce chantier ne devrait pas) : `cd server && npm ci && npm run check`.

## 6. Pièges propres à ce chantier

- **Moments des repas** : `Repas.moment` vaut `'dejeuner' | 'diner' | 'collation'`. « Midi » =
  `dejeuner`, « Soir » = `diner`, les collations sont hors grille et hors rangement. Les jours
  sont un tableau `JourMenu[]` (`{ jour, repas }`), pas une map.
- **Enveloppe stockée** : `sportapp:cycle` contient `CycleActif { id, numero, debut, pauses,
  cycle, relanceDe? }`, pas le JSON brut. L'instantané de semaine type s'y ajoute en champ
  optionnel `semaineAuLancement` (spec §6) : pas de nouvelle clé, pas de changement de sync.
- **Coches** : ids stables dérivés des ids du JSON (`geste:{L}:{etapeId}:{i}`,
  `range:{L}:{idRangement}`), stockés dans les coches de semaine existantes → synchronisés
  automatiquement. Jamais d'index d'étape dans un id.
- **Minuteurs** : on persiste l'**heure de fin**, jamais un décompte (téléphone en veille). Ils
  vivent au niveau d'`App.tsx` pour survivre aux changements d'écran. Vibration seule, pas de
  son. La barre des minuteurs est **sticky dans le contenu**, jamais par-dessus le titre (défaut
  déjà corrigé dans la maquette, ne pas le réintroduire).
- **Avatar** : initiale centrée (`display: inline-grid; place-items: center; line-height: 1`),
  défaut repéré par Marc dans une version précédente de la maquette.
- **Tokens** : `tests/css-tokens.test.ts` impose les échelles `--fs-*`, `--lh-*`, `--sp-*` ;
  reprends les **valeurs** de l'annexe A, pas forcément les noms de la maquette. Le texte
  secondaire doit tenir 4,5:1 sur le fond papier **et** sur les cartes blanches.
- **Polices** : Bricolage Grotesque en woff2 dans `src/assets/fonts/` (700 et 800, + fichier de
  licence OFL). La maquette charge Google Fonts ; l'app, **jamais** (offline-first). Le précache
  du service worker prend les woff2 automatiquement.
- **Renommages et tests** : passer à « Semaine » / « Moi » / 4 onglets casse environ 50
  assertions (`tests/app.test.tsx`, `profil-screen.test.tsx`, `sync/ui.test.tsx`,
  `onboarding.test.tsx`, `tests/e2e/shell.spec.ts`, `onboarding-mobile.spec.ts`,
  `suivi-objectif.spec.ts`). C'est attendu en PR 2 : mets-les à jour **en premier**, en rouge.
- **Grosses réécritures** : `Rituel.tsx`, `Guide.tsx`, `MonCycle.tsx` sont réécrits ; conserve
  leur logique métier (coches, reports, wake lock, import) en la déplaçant dans `src/lib/` si
  besoin, et garde leurs tests verts ou remplace-les par des tests équivalents ou plus stricts.

## 7. Rapport attendu à la fin de chaque PR

```markdown
## PR <n> — <titre> : <lien de la PR>
- Fait : <liste courte des tâches du plan, avec leur numéro>
- Écarts à la spec ou à la maquette : <aucun | liste + raison>
- Questions pour Marc : <aucune | liste>
- Vérifications : test <n réussis/n>, typecheck, lint, build, e2e, e2e:preview — résultat réel
  de chaque commande (ne jamais annoncer vert sans l'avoir lancée)
- Captures 320 et 375 px des écrans touchés : <chemins>
- CI de la PR : <verte | rouge + cause>
```

## 8. Découpage et critères d'arrêt

| PR | Branche | Contenu (détail : spec, Partie II) | Arrêt et feu vert de Marc |
|---|---|---|---|
| 1 | `feat/theme-marche` | polices, tokens, composants de base, méta PWA, docs de design | captures avant/après des écrans actuels |
| 2 | `feat/navigation-4-onglets` | 4 onglets, Aujourd'hui, Semaine, Moi, couleur par plat, vocabulaire | parcours complet sur téléphone |
| 3 | `feat/rituel-parallele` | contrat additif, logique dérivée, minuteurs, écran Rituel, mode guidé, rangement | un dimanche simulé de bout en bout |
| 4 | `feat/menus-assistant` | courses par rayon coloré, semaine type option B, correctif `jourCourses`, assistant | test « aucun cycle visible » sur tous les écrans |

Si une PR devient trop grosse à relire (plus de ~1 500 lignes hors tests), propose à Marc de la
scinder avant de continuer.
