# Notifications push — plan phase 3 (front)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Front des notifications push : module `src/lib/push/`, service worker custom (`injectManifest`), bloc Profil « Notifications » (toggle maître, 3 toggles événements, rappels éditables), hooks d'événements après flush confirmée, suppression des fichiers temporaires du POC, docs + PR.

**Architecture:** le SW custom reçoit le `push` et affiche `{ title, body }` tel quel (le serveur formate le français). Le front souscrit (geste utilisateur) → `push-register` (upsert par `device_id`). Les événements partent **après flush confirmée** (`surEnvoye` callback dans engine, pattern `surEmpile`) — jamais en optimiste ; le serveur filtre les destinataires (toggle + exclusion appelant). Sans env/session, tout est no-op (même posture que la sync).

**Tech stack:** React 18 (hooks, pas de contexte), vitest + Testing Library (mock `vi.mock` de `lib/push/config`, pattern `tests/sync/`), vite-plugin-pwa `injectManifest`, zéro dépendance npm nouvelle.

**Spec:** `docs/superpowers/specs/2026-09-18-notifications-push-design.md` — phase 2 mergée (PR #18) : table + `push-register` + `push-notifier` + `push-rappels` + cron, validées.
**Prérequis:** main = merge PR #18. Clé VAPID publique : `BDcDi8ilA-WsWON4Q3V7qzqzJxpKGJHwIVYH8xrHkWaGSqoJTq0RBKx2vB58nEBzYl0K2KFWuO5PkWFoFriN1mY` (déjà posée en secret `VAPID_PUBLIC_KEY` côté Supabase).
**Avec Marc (étapes collaboratives):** secret GitHub `VITE_VAPID_PUBLIC_KEY` (Task 0), test DELETE déployé (Task 1), suppression `push-poc` déployée (Task 6), tests sur téléphones après merge de la PR.

---

### Task 0: Préparation (avec Marc)

- [ ] **Step 1: Secret GitHub pour le build CI** — Marc : GitHub → repo → Settings → Secrets and variables → Actions → New repository secret : `VITE_VAPID_PUBLIC_KEY` = `BDcDi8ilA-WsWON4Q3V7qzqzJxpKGJHwIVYH8xrHkWaGSqoJTq0RBKx2vB58nEBzYl0K2KFWuO5PkWFoFriN1mY` (même méthode que `VITE_SUPABASE_URL`).
- [ ] **Step 2: Local dev** — créer `.env.local` (git-ignoré) à la racine avec la même variable. Le serveur dev relaie l'app sans session → le bloc push reste caché tant que la sync n'est pas connectée : pour voir l'UI pendant le dev, mocker la session est possible via localStorage (`sportapp:sync:token` + `sportapp:sync:foyer` = token du foyer fabriqué via `connexion-foyer`, déjà en `/tmp/foyer-token.txt` + foyer `11da55e6-efe8-49e1-a37d-1e2ed1f2239f`).

### Task 1: Backend — DELETE sur push-register (désabonnement)

**Files:**
- Modify: `supabase/functions/push-register/index.ts`

- [ ] **Step 1: Étendre la fonction** — après le bloc OPTIONS, ajouter :

```ts
if (req.method === 'DELETE') {
  const foyerId = foyerDuJwt(req);
  if (!foyerId) return new Response('unauthorized', { status: 401, headers: CORS });
  const { device_id } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof device_id !== 'string' || !device_id) {
    return new Response('bad request', { status: 400, headers: CORS });
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  await admin.from('push_subscriptions').delete().eq('household_id', foyerId).eq('device_id', device_id);
  return new Response('ok', { headers: CORS });
}
```

(mettre `createClient` dans une petite factory locale pour éviter la duplication POST/DELETE)

- [ ] **Step 2: Deploy + test curl (avec Marc)** — `supabase functions deploy push-register --project-ref dkprqbfpjspvknbjwgcg` ; puis register d'un `test-delete` (curl POST, cf. plan phase 2) → `curl -s -X DELETE .../push-register -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"device_id":"test-delete"}'` → `ok` + row disparue (SELECT).
- [ ] **Step 3: Commit** — `git add supabase/functions/push-register/index.ts && git commit -m "feat: push-register accepte DELETE (désabonnement par device)"`

### Task 2: Module `src/lib/push/` (TDD)

**Files:**
- Create: `src/lib/push/config.ts` (gate, 100 % symétrique de `src/lib/sync/config.ts`)
- Create: `src/lib/push/module.ts`
- Create: `tests/lib/push/module.test.ts`

- [ ] **Step 1: Tests rouges** — `tests/lib/push/module.test.ts` :

```ts
// (retirer la ligne du vi.mock de l'exemple ci-dessus)
// Mock config (pattern tests/sync/) : pushActif contrôlé, VITE_VAPID_PUBLIC_KEY injectable.
```
vi.mock('../../../src/lib/push/config', () => ({ ...réel, pushActif: vi.fn(() => true), VAPID_PUBLIC_KEY: 'BDcD…' }));
```

Cas à couvrir (comportement visible — storage + fetch) :

```ts
vi.mock('../../../src/lib/push/config', () => ({
  pushActif: vi.fn(() => true),
  VAPID_PUBLIC_KEY: 'BDcDi8ilA-WsWON4Q3V7qzqzJxpKGJHwIVYH8xrHkWaGSqoJTq0RBKx2vB58nEBzYl0K2KFWuO5PkWFoFriN1mY',
}));
```
- `deviceId()` : 1er appel génère un uuid, le persiste (`sportapp:push:device`), 2e appel relit le même.
- `souscrireEtEnregistrer(config)` : appelle `pushManager.subscribe` sur le SW enregistré (mock `navigator.serviceWorker` + `pushManager.subscribe` avec `userVisibleOnly: true` + base64url → Uint8Array de la clé VAPID) puis POST `push-register` avec `{ endpoint, p256dh, auth, profil, device_id, tz, config }` et `Authorization: Bearer <token>` ; no-op silencieux si `pushActif()` faux ou permission refusée.
- `majConfig(config)` : même POST (upsert, l'endpoint existant est réutilisé via `pushManager.getSubscription` — si pas de subscription → POST complet de subscribe).
- `desabonner()` : `getSubscription` → `unsubscribe()` + DELETE `push-register` `{ device_id }` ; no-op sans subscription.
- `envoyerEvenement(type, label)` : POST `push-notifier` `{ type, auteur, device_id, label }` ; no-op sans session/actif.
- Shape config : `configDefaut()` → `{ evenements: { diner: false, pesee: false, courses: false }, rappels: [] }`.

- [ ] **Step 2: Implémenter** — `config.ts` : mirror de sync/config (`VITE_VAPID_PUBLIC_KEY` depuis `import.meta.env` typé, `pushActif()` = `syncActif() && !!session && !!VAPID_PUBLIC_KEY` — attention import de `lib/sync/config` et `lib/sync/session`). `module.ts` : fonctions nommées, fetch direct (pas de client supabase), `tz = Intl.DateTimeFormat().resolvedOptions().timeZone`, `profil = loadProfil().id` (storage), base64url decode de la clé (fonction pure locale, testée).
- [ ] **Step 3: Vert + gates** — `npm test` (491 + nouveaux), `npm run typecheck && npm run lint`.
- [ ] **Step 4: Commit** — `feat: module push (souscrire, register, config, événements)`

### Task 3: Hooks post-flush (engine) + détection d'événements (TDD)

**Files:**
- Modify: `src/lib/sync/engine.ts`
- Create: `src/lib/push/evenements.ts`
- Modify: `tests/sync/engine.test.ts`
- Create: `tests/lib/push/evenements.test.ts`

- [ ] **Step 1: Tests rouges engine** — dans `tests/sync/engine.test.ts` (pattern existant, FauxClient) :
  - `enregistrerSurEnvoye(cb)` : après un flush réussi contenant des mutations, `cb` reçoit **la liste des mutations envoyées** ; appelé **une seule fois** par flush ; pas appelé si flush en échec (upsert lève) ni si outbox vide ; `reinitialiser()` remet à zéro.
- [ ] **Step 2: Implémenter engine** — variable module `surEnvoye: ((ms: MutationSync[]) => void) | null`, setter `enregistrerSurEnvoye` (même style que `injecterClient`), appelé dans `flush()` juste après `definirEtat('sync'); ok = true;` avec l'`outbox` locale ; `reinitialiser()` → `surEnvoye = null`.
- [ ] **Step 3: Tests rouges détection** — `tests/lib/push/evenements.test.ts`, `evenementsDepuisMutations(mutations, ctx)` (pur) :
  - checks `menu:lundi:dinerFamille` avec `payload.done === true` → 1 événement `diner`, label = `ctx.menuLabel('lundi', 'dinerFamille')` (si label vide → pas d'événement) ; idem `dinerMelanie` ; `done === false` → rien ; `menu:mardi:dejeunerMarc` → rien (seuls les deux dîners déclenchent).
  - weights `{ payload: { kg } }` → événement `pesee`, label = `82,4 kg` (fr, virgule) ; delete → rien.
  - depenses `{ payload: { magasin, total } }` → `courses`, label = `23,4 € chez Lidl` (virgule décimale) ; delete → rien.
  - plusieurs mutations → plusieurs événements, ordre conservé.
- [ ] **Step 4: Implémenter + vert + commit** — `feat: hooks post-flush + détection d'événements push`

### Task 4: Service worker custom (injectManifest)

**Files:**
- Modify: `vite.config.ts`
- Create: `src/sw.ts`

- [ ] **Step 1: Écrire `src/sw.ts`** —

```ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] };

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (e) => {
  let titre = 'Rituel';
  let corps = '';
  try {
    const p = (e as PushEvent).data?.json() as { title?: string; body?: string } | undefined;
    if (p?.title) titre = p.title;
    if (p?.body) corps = p.body;
  } catch { /* payload non JSON : notification générique */ }
  e.waitUntil(
    self.registration.showNotification(titre, {
      body: corps || undefined,
      icon: '/rituel-app/pwa-192x192.png',
      badge: '/rituel-app/pwa-64x64.png',
      data: { url: '/rituel-app/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const c = clients[0];
      if (c) return c.focus();
      return self.clients.openWindow('/rituel-app/');
    })(),
  );
});
```

- [ ] **Step 2: Basculer `vite.config.ts`** — `generateSW` → `injectManifest({ srcSW: 'src/sw.ts', ... })`, garder `registerType: 'autoUpdate'`, `filename` par défaut (`sw.js`), base déjà `'/rituel-app/'`. Vérifier l'import `import { VitePWA } from 'vite-plugin-pwa'` reste inchangé.
- [ ] **Step 3: Vérifier le build** — `npm run build` puis inspecter `dist/` : `sw.js` contient le handler `push` (grep `showNotification`) ET le precache manifest (grep `precacheAndRoute` ou la liste d'assets). `npm test` ne doit pas ramasser `src/sw.ts` (vitest exclude déjà en place ? vérifier — sinon l'exclure).
- [ ] **Step 4: Gates + commit** — `npm test && npm run typecheck && npm run lint && npm run build` — `feat: service worker custom (push + notificationclick, injectManifest)`

### Task 5: UI — bloc Profil « Notifications » (TDD)

**Files:**
- Modify: `src/components/ProfilScreen.tsx` (bloc après « Synchronisation », l.565 — même style)
- Modify: `src/index.css` (classes sémantiques, tokens)
- Modify: `tests/sync/ui.test.tsx` (convention existante : UI sync + mocks config/session)

- [ ] **Step 1: Tests rouges** — mock `lib/push/config` (`pushActif: true`) + `lib/sync/session` (session présente) :
  - Sans `pushActif` → pas de bloc « Notifications » (rôle).
  - Avec → bloc visible : titre, toggle maître (checkbox, `.checklist` style ?), 3 toggles événements (« Dîner coché », « Pesée ajoutée », « Courses faites »), zone rappels avec bouton « Ajouter un rappel ».
  - Toggle maître ON → appelle `souscrireEtEnregistrer` (mock), OFF → `desabonner`.
  - Toggle événement → `majConfig` avec la config mise à jour (affirmer sur le mock).
  - Ajout d'un rappel : type (select Séance/Pesée/Rituel), jours (7 puces toggle L-D, ≥ 1 requis), heure (input time) → bouton « Ajouter » → la ligne apparaît → `majConfig`.
  - Suppression d'un rappel → ligne disparaît → `majConfig`.
  - `userEvent` partout ; `localStorage.clear()` en beforeEach.
- [ ] **Step 2: Implémenter** — état local `useState` miroir de la config du device (chargée une fois au montage — KISS : la config source de vérité est le serveur ; le front la reconstruit locale par défaut et `majConfig` POSTe la diff complète). Pattern render-phase reset si besoin. Labels FR ; cibles ≥ 48 px ; `flex-wrap` + `min-width: 0` sur les rows multi-champs (règle mobile).
- [ ] **Step 3: CSS** — classes `.push-bloc`, `.push-rappel-row`, `.push-puces`… tokens `--sp-*`/`--fs-*` uniquement, pas de nouvelle couleur.
- [ ] **Step 4: Gates + e2e** — `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e` (zéro débordement 320/375 — le bloc est caché sans env dans les specs e2e, vérifier quand même le Profil).
- [ ] **Step 5: Commit** — `feat: bloc Notifications dans le Profil (rappels + événements)`

### Task 6: Câblage App + ménage POC + docs + PR

**Files:**
- Modify: `src/App.tsx` (wiring push après initSync)
- Delete: `public/sw-poc.js`, `supabase/functions/push-poc/`
- Modify: `docs/backend.md`, `CHANGELOG.md`, `README.md` (mention push ?)

- [ ] **Step 1: Câbler dans App** — au montage (après initSync) : `enregistrerSurEnvoye((ms) => { … })` : filtrer via `evenementsDepuisMutations(ms, { menuLabel: (jour) => texte du menu du jour (clé diner) depuis la semaine en état, auteur: profile.id, deviceId: deviceId() })` puis pour chaque événement `void envoyerEvenement(...)`. Ne rien faire si `!pushActif()`. Le callback doit lire l'état courant (ref miroir si besoin — pattern existant dans App pour les callbacks de sync).
- [ ] **Step 2: Supprimer le POC** — `git rm public/sw-poc.js && git rm -r supabase/functions/push-poc/` ; Marc : `supabase functions delete push-poc --project-ref dkprqbfpjspvknbjwgcg`.
- [ ] **Step 3: Docs** — `docs/backend.md` : section push (table, 3+1 fonctions, cron, secrets VAPID/CRON, flux complet + mémo « fr-CA → 08 h 03 » et purge 404/410) ; `CHANGELOG.md` : section Non publié / Ajouté — notifications push (événements foyer + rappels, opt-in) ; README : une ligne.
- [ ] **Step 4: Gates complets + e2e + commit**
- [ ] **Step 5: Push + PR** — `gh pr create` (résumé : SW custom, module, UI, hooks, ménage). CI verte → **merge par Marc**.
- [ ] **Step 6: Après merge — tests réels (avec Marc)** — Deploy vert ; sur chaque téléphone : ouvrir l'app → Profil → Notifications → activer → tester un dîner coché / pesée / rappel à 1 min. Vérifier aussi Chrome desktop (proxy Proxyman fermé).

---

## Après la phase 3

- Chantier push terminé (spec/plan/verdict dans `docs/superpowers/`).
- Idées futures (docs/ameliorations.md) : iOS (permission via A2HS), badges, resubscribe auto si endpoint expiré, résumé quotidien.
