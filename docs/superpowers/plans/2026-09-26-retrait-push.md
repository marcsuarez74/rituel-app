# Retrait des notifications push — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** retirer entièrement les notifications push (VAPID Web Push) de l'app — front, service worker, CSS, tests, backend Supabase, docs, CI — sans toucher à la synchronisation (≠ push).

**Architecture :** suppression pure et progressive (chaque tâche laisse l'arbre vert) : d'abord les consommateurs (hook engine → App → Profil → SW/CSS), puis les modules, puis le backend push et la doc. Aucun remplacement, aucune migration : un appareil ayant une souscription active ne reçoit simplement plus rien.

**Tech Stack :** React 18 + TS strict, workbox (SW custom `injectManifest`), vitest + Testing Library, Playwright (e2e inchangés).

**Spec :** `docs/superpowers/specs/2026-09-26-sync-vps-sqlite-design.md` §5 (« Retrait des notifications push ») — ce plan n'implémente QUE cette section ; le serveur VPS est un plan séparé (`2026-09-26-sync-vps-sqlite.md`).

## Global Constraints

- Branche : `chore/retrait-push` depuis `main` — **1 PR indépendante, déployable seule** (aucun lien avec le futur VPS).
- La **sync Supabase reste inchangée** dans cette PR : `src/lib/sync/**` (sauf le hook `surEnvoye` de `engine.ts`, seul écart documenté par la spec), bloc Foyer du Profil, bannière : aucun changement.
- Le point de sync de la bannière et le bloc Foyer du Profil **restent** (sync ≠ push).
- Aucune nouvelle dépendance ; aucune clé storage renommée (les clés `sportapp:push:*` orphelines restent dans des localStorage réels — jamais lues, jamais nettoyées, YAGNI).
- Textes UI en français ; exports nommés ; TypeScript strict ; avant tout commit : `npm test && npm run typecheck && npm run lint && npm run build` (règle du repo, appelée **« gate »** dans les étapes).
- Un commit = un changement cohérent, préfixe conventionnel en français (`feat:`, `chore:`, `docs:`, `ci:`).
- Tout passe par une PR (`gh pr create`), CI verte avant merge ; jamais de push direct sur `main`.

## Review Focus

Les cinq façons dont ce retrait peut mordre un utilisateur réel — chacune est couverte par une vérification explicite dans les tâches :

1. **Téléphone avec une souscription push encore active** (avant mise à jour de la PWA) : plus aucun serveur derrière → attente : aucun crash au démarrage, aucune erreur affichée, silence total. Pin : Task 6 (build de prod sans `VITE_VAPID_PUBLIC_KEY` + `npm run e2e` complet, le SW est reconstruit et écrase l'ancien via `autoUpdate`).
2. **App sans foyer / sync inactive** : aucun changement visible (le hub Profil perd la tuile Notifications, rien d'autre). Pin : Task 3 (`tests/sync/ui.test.tsx` — les descs « sync UI » restent verts) + e2e onboarding/profil de Task 6.
3. **Service worker** : le retrait des handlers `push`/`notificationclick` ne doit pas casser le precache ni les routes images. Pin : Task 4 (build + grep de `dist/sw.js` : plus de référence push, `precacheAndRoute` toujours là) et Task 6 (`npm run build && npm run preview`).
4. **Références mortes après suppression** : un import oublié de `src/lib/push` casse le typecheck strict — le gate de chaque tâche l'attrape ; pin systématique.
5. **CHANGELOG / release** : l'entrée « Retiré » doit exister AVANT le prochain bump de version (`release.yml` copie la section). Pin : Task 6 (contenu exact fourni).

---

### Task 1: Engine — retrait du hook post-flush `surEnvoye`

**Files:**
- Modify: `src/lib/sync/engine.ts`
- Test: `tests/sync/engine.test.ts`

**Interfaces:**
- Produces: `engine.ts` n'exporte plus `enregistrerSurEnvoye`. Tout le reste du port sync (flush/pull/états) est inchangé.

- [ ] **Step 1: Retirer le test du hook (rouge → suite cohérente)**

Dans `tests/sync/engine.test.ts` :
- retirer `enregistrerSurEnvoye` de l'import depuis `../../src/lib/sync/engine` (bloc d'import lignes ~35-50) ;
- supprimer le describe entier `describe('surEnvoye : hook post-flush (push)', …)` (dernier bloc du fichier, ~lignes 891-fin).

- [ ] **Step 2: Vérifier que la suite du fichier est verte**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: PASS (le reste du fichier ne référence plus le hook).

- [ ] **Step 3: Retirer le hook de l'engine**

Dans `src/lib/sync/engine.ts`, supprimer exactement :
1. la déclaration + commentaire (lignes 54-56) :
   ```ts
   // Hook post-flush (push) : appelé une fois par flush réussie avec les
   // mutations envoyées — jamais en échec ni sur outbox vide.
   let surEnvoye: ((ms: MutationSync[]) => void) | null = null;
   ```
2. l'export (lignes 58-61) :
   ```ts
   // Enregistré par le câblage push (App) : cf. surEnvoye ci-dessus.
   export const enregistrerSurEnvoye = (cb: ((ms: MutationSync[]) => void) | null): void => {
     surEnvoye = cb;
   };
   ```
3. dans `reinitialiser` : la ligne `surEnvoye = null;` (ligne 102).
4. dans `flush` : la ligne `surEnvoye?.(outbox);` (ligne 157, juste après `ok = true;`).

- [ ] **Step 4: Gate + commit**

Run: gate (cf. Global Constraints) — attendu vert (le typecheck attrape toute référence morte).
```bash
git add src/lib/sync/engine.ts tests/sync/engine.test.ts
git commit -m "refactor: retire le hook surEnvoye de l'engine (consommateur push supprimé)"
```

### Task 2: App.tsx — retrait du câblage push

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `App.tsx` n'importe plus rien de `src/lib/push` ni `enregistrerSurEnvoye`. L'effet `initSync` (bannière + re-rendu remote) reste tel quel.

- [ ] **Step 1: Retirer les imports push**

Lignes 16-19 deviennent :
```ts
import { initSync, ressynchroniser, type SyncEtat } from './lib/sync/engine';
```
et supprimer entièrement :
```ts
import { evenementsDepuisMutations } from './lib/push/evenements';
import { envoyerEvenement } from './lib/push/module';
import { pushActif } from './lib/push/config';
```

- [ ] **Step 2: Retirer l'effet push + le ref devenu inutile**

Supprimer le bloc entier (lignes 76-92, commentaire inclus) :
```ts
// Push : après flush confirmée, détection des événements (dîner coché,
// pesée, courses) et envoi au serveur — qui filtre les destinataires.
// Le hook lit l'état courant via un ref miroir (posé une seule fois).
const semainesRef = useRef(semaines);
semainesRef.current = semaines;
useEffect(() => {
  enregistrerSurEnvoye((mutations) => {
    if (!pushActif()) return;
    const evenements = evenementsDepuisMutations(mutations, (semaine, jour, cle) => {
      const w = semainesRef.current.find((s) => s.data.meta.semaine === semaine);
      const jourTrouve = w?.data.menu.find((d) => d.jour === jour);
      return (jourTrouve?.[cle as keyof typeof jourTrouve] as string | undefined) ?? null;
    });
    for (const e of evenements) void envoyerEvenement(e.type, e.label);
  });
  return () => enregistrerSurEnvoye(null);
}, []);
```
(`semainesRef` n'est utilisé que par ce bloc — `useRef` reste importé pour le swipe, ne pas toucher aux autres usages.)

- [ ] **Step 3: Gate + commit**

Run: gate — attendu vert (`noUnusedLocals` vérifie qu'aucun import mort ne traîne).
```bash
git add src/App.tsx
git commit -m "feat: retrait du câblage push de l'app (événements après flush)"
```

### Task 3: Profil — retrait de la tuile et de la page Notifications

**Files:**
- Delete: `src/components/profil/ProfilNotifs.tsx`
- Modify: `src/components/ProfilScreen.tsx`, `src/lib/resumes.ts`, `src/components/Icon.tsx`
- Test: `tests/sync/ui.test.tsx`, `tests/resumes.test.ts`

**Interfaces:**
- Produces: `ProfilScreen` n'a plus de vue `notifs` ni de props push ; `resumes.ts` n'exporte plus `resumeNotifications`. L'icône `bell` de `Icon.tsx` disparaît (dernier consommateur supprimé).

- [ ] **Step 1: Retirer les tests du bloc Notifications**

Dans `tests/sync/ui.test.tsx` :
- supprimer le bloc de mocks lignes 312-333 (commentaire « Bloc Notifications push », `vi.hoisted` `pushActifMock/souscrireMock/majConfigMock/desabonnerMock`, `vi.mock('../../src/lib/push/config', …)` et `vi.mock('../../src/lib/push/module', …)`) ;
- supprimer le describe entier `describe('profil: bloc Notifications', …)` (lignes 335 à la fin de CE describe seulement — le fichier peut contenir d'autres describes après, ne rien toucher d'autre).

Dans `tests/resumes.test.ts` :
- retirer les imports `import type { PushConfig } from '../src/lib/push/module';` et `configDefaut` ;
- supprimer le describe `describe('resumes — resumeNotifications', …)` (lignes ~116-137).

- [ ] **Step 2: Vérifier les suites touchées**

Run: `npx vitest run tests/sync/ui.test.tsx tests/resumes.test.ts`
Expected: PASS.

- [ ] **Step 3: Supprimer la page et nettoyer ProfilScreen**

1. `git rm src/components/profil/ProfilNotifs.tsx`
2. Dans `src/components/ProfilScreen.tsx` :
   - retirer les imports `configDefaut`, `PushConfig`/`RappelPush`, `desabonner`/`majConfig`/`souscrireEtEnregistrer`, `pushActif`, `resumeNotifications`, `ProfilNotifs` (lignes 8-15, 20, 28) ;
   - dans le type `Vue` : `type Vue = 'hub' | 'objectif' | 'infos' | 'maison' | 'foyer';` (retirer `'notifs'`) ;
   - supprimer tout l'état + effets push (lignes 54-115) : `pushVisible`, `pushOn`, `pushConfig`, `pushErreur`, `useEffect` de souscription, `pushActive`, `pushBasculer`, `pushToggleEvenement`, `pushAjouterRappel`, `pushSupprimerRappel`, `pushMajRappel`, `pushToggleJour` ;
   - supprimer l'objet `propsPush` (lignes 143-153) ;
   - supprimer la tuile conditionnelle dans `.hub-tuiles` (lignes 193-199) ;
   - supprimer la ligne `{vue === 'notifs' && <ProfilNotifs {...propsPush} />}` (ligne 241).

- [ ] **Step 4: resumes.ts + Icon.tsx**

1. Dans `src/lib/resumes.ts` : supprimer `import type { PushConfig } from './push/module';` (ligne 6) et la fonction `resumeNotifications` (lignes 55-61, commentaire inclus).
2. Dans `src/components/Icon.tsx` : supprimer l'entrée `bell:` (ligne 106) — dernier consommateur retiré à l'étape précédente (vérifier par `grep -rn "name=\"bell\"" src/` → vide).

- [ ] **Step 5: Gate + commit**

Run: gate — attendu vert.
```bash
git add -A
git commit -m "feat: retrait de la tuile et de la page Notifications du hub Profil"
```

### Task 4: Service worker + CSS + commentaire de config PWA

**Files:**
- Modify: `src/sw.ts`, `src/index.css`, `vite.config.ts`

**Interfaces:**
- Produces: `sw.ts` ne contient plus que precache + routes images (le manifeste et `injectManifest` restent — le SW reste obligatoire pour la PWA offline).

- [ ] **Step 1: sw.ts — retirer les handlers push**

1. Remplacer l'en-tête (lignes 2-4) par :
   ```ts
   // Service worker custom (injectManifest) : precache du build + stratégies
   // images. Aucun handler métier : la sync passe par la page, pas par le SW.
   ```
2. Supprimer les deux listeners `self.addEventListener('push', …)` (lignes 39-57) et `self.addEventListener('notificationclick', …)` (lignes 59-69).

- [ ] **Step 2: index.css — retirer le bloc push**

Supprimer la section complète « Bloc Notifications push (Profil) » (commentaire ligne 3110 + règles `.push-bloc .profil-ghost`, `.push-sous-titre`, `.push-rappel`, `.push-rappel-row`, `.push-rappel-row label`, `.push-rappel-row select`, `.push-rappel-row input[type='time']` (×2), `.push-suppr`, `.push-puces .chip`, `.push-ajout` — jusqu'à ~ligne 3176). Vérifier : `grep -n "push-" src/index.css` → vide.

- [ ] **Step 3: vite.config.ts — mettre à jour le commentaire du plugin PWA**

Ligne 20, remplacer :
```ts
      // SW custom : precache + handlers push/notificationclick (src/sw.ts).
```
par :
```ts
      // SW custom : precache du build + stratégies images (src/sw.ts).
```

- [ ] **Step 4: Build + vérif du SW compilé**

Run: `npm run build && ! grep -q "showNotification\|notificationclick" dist/sw.js && grep -q "__WB_MANIFEST" dist/sw.js`
Expected: succès (aucune référence push dans le SW compilé ; le precache `__WB_MANIFEST` est toujours là).

- [ ] **Step 5: Gate + commit**

Run: gate.
```bash
git add src/sw.ts src/index.css vite.config.ts
git commit -m "feat: SW sans handlers push, CSS .push-* retiré"
```

### Task 5: Suppression des modules push et du backend Supabase push

**Files:**
- Delete: `src/lib/push/config.ts`, `src/lib/push/module.ts`, `src/lib/push/evenements.ts`
- Delete: `tests/lib/push/module.test.ts`, `tests/lib/push/evenements.test.ts` (et le dossier `tests/lib/push/` s'il devient vide)
- Delete: `supabase/functions/push-register/`, `supabase/functions/push-notifier/`, `supabase/functions/push-rappels/`, `supabase/functions/_shared/`, `supabase/migrations/0002_push_subscriptions.sql`

**Interfaces:**
- Produces: aucun module push dans `src/` ; `supabase/` ne garde que `migrations/0001_sync_init.sql`, `functions/connexion-foyer/`, `scripts/creer-foyer.mjs` (la spec §5 liste exactement ces retraits ; `connexion-foyer` n'importe pas `_shared` — vérifié).

- [ ] **Step 1: Vérifier qu'il ne reste aucun import**

Run: `grep -rn "lib/push" src/ tests/`
Expected: vide (les consommateurs ont été retirés aux Tasks 2-3).

- [ ] **Step 2: git rm**

```bash
git rm -r src/lib/push tests/lib/push
git rm -r supabase/functions/push-register supabase/functions/push-notifier supabase/functions/push-rappels supabase/functions/_shared
git rm supabase/migrations/0002_push_subscriptions.sql
```

- [ ] **Step 3: Gate + commit**

Run: gate — attendu vert.
```bash
git add -A
git commit -m "chore: suppression des modules push (front, tests, edge functions, migration 0002)"
```

### Task 6: Docs, CI, CHANGELOG + vérification finale + PR

**Files:**
- Modify: `.github/workflows/deploy.yml`, `README.md`, `docs/backend.md`, `CHANGELOG.md`

- [ ] **Step 1: deploy.yml — retirer le secret VAPID**

Dans `.github/workflows/deploy.yml` (step Build, ligne 35), supprimer :
```yaml
          VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}
```
et mettre à jour le commentaire du step (lignes 31-32) en :
```yaml
          # Sync optionnelle (voir docs/backend.md) : injectées au build, jamais
          # dans le repo. Sans secrets, la sync reste inactive (build local, CI PR).
```
(les deux lignes `VITE_SUPABASE_*` restent — leur retrait est l'affaire de la PR VPS).

- [ ] **Step 2: README.md — retirer la section push**

Supprimer la section entière `## Notifications push (optionnelles)` (à partir de la ligne 212 jusqu'à la section suivante ou la fin). Ne PAS toucher à la note « Vie privée » (mention Supabase) — elle sera réécrite par la PR VPS.

- [ ] **Step 3: docs/backend.md — retirer §7**

Supprimer la section `## 7. Notifications push (optionnel, VAPID Web Push)` (ligne 130) jusqu'à la fin du fichier (c'est la dernière section). Vérifier : `grep -in "push\|vapid\|rappel" docs/backend.md` → vide.

- [ ] **Step 4: CHANGELOG.md — entrée « Retiré »**

Sous `## [Non publié]`, ajouter après la section `### Corrigé` (dernière du bloc) :
```markdown
### Retiré

- Notifications push (VAPID) : tuile et page Notifications du hub Profil, handlers push/notificationclick du service worker, modules `src/lib/push/`, edge functions `push-register`/`push-notifier`/`push-rappels` + `_shared/`, migration `0002_push_subscriptions`, secret `VITE_VAPID_PUBLIC_KEY`. Les appareils ayant une souscription active ne reçoivent plus rien (silencieux, sans erreur). La synchronisation du foyer (≠ push) est inchangée.
```

- [ ] **Step 5: Vérification complète (incl. e2e — changement UI du hub Profil)**

```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run e2e
```
Expected : tout vert ; aucun débordement horizontal ; le hub Profil n'affiche plus la tuile Notifications.

- [ ] **Step 6: Push + PR**

```bash
git push -u origin chore/retrait-push
gh pr create --title "feat: retrait des notifications push" --body "## Résumé

Retrait complet des notifications push (VAPID Web Push), spec 2026-09-26 §5 :

- tuile + page Notifications du hub Profil supprimées (rien à déménager : la page ne contenait que du push) ;
- hook \`surEnvoye\` de l'engine retiré (seul écart documenté à « engine intact ») ;
- service worker : handlers \`push\`/\`notificationclick\` supprimés (precache + routes images conservés) ;
- \`src/lib/push/\`, edge functions \`push-*\` + \`_shared/\`, migration \`0002\` supprimés ;
- secret \`VITE_VAPID_PUBLIC_KEY\` retiré du workflow Deploy ; docs (README, backend.md) et CHANGELOG à jour.

La sync Supabase (≠ push) est inchangée. PR indépendante, déployable seule — le serveur VPS arrive dans une 2ᵉ PR (spec §6)."
gh pr checks --watch
```
Merge (merge commit, `--delete-branch`) une fois la CI verte.
