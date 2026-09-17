# Sync : statut honnête et résilient — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le point de sync n'apparaît que si le foyer est appairé, et le statut se répare tout seul (reconnexion client/canal) au lieu d'exiger un refresh.

**Architecture:** Nouvel état `hors-foyer` porté par le moteur (source de vérité) ; le canal realtime expose son statut (`SUBSCRIBED`/fermeture) que le moteur traduit en `sync`/`erreur` + reconnexion planifiée (5 s, une en vol). Le tap bannière et l'event `online` re-tentent `connecter()` quand le client n'existe pas.

**Tech Stack:** TypeScript strict, React 18, Vitest (fake timers pour la reconnexion), Supabase Realtime (port étroit existant).

**Spec:** `docs/superpowers/specs/2026-09-17-sync-statut-honnete-design.md`

**Pièges connus (du chantier, à respecter) :**
- `reinitialiser()` (tests) doit annuler TOUS les timers module (flush, pull, reconnexion).
- `vi.mock` partiel de `./client` dans engine.test.ts : les tests existants passent par `injecterClient` (creerClient jamais appelé) — le mock ne les touche pas.
- L'ordre des const fléchées compte (pas de hoisting) : `planifierReconnexion` avant `installerRealtime`, lui-même avant `connecter`.
- `ETIQUETTES` (WeekBanner) et `ETAT_SYNC` (ProfilScreen) sont typés `Record<Exclude<…>>` : ajouter `hors-foyer` aux exclusions, pas de nouvelle entrée visible.
- Aucun e2e ne dépend du point sync (vérifié : `rg "sync-dot|pastille" tests/e2e/` vide).

---

## Fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/lib/sync/engine.ts` | modifier | état `hors-foyer`, reconnect-first, statut canal, reconnexion planifiée |
| `src/lib/sync/client.ts` | modifier | `abonner(onEvenement, onStatut?)` — mapping du statut du canal |
| `src/components/WeekBanner.tsx` | modifier | dot masqué en `off`/`hors-foyer` |
| `src/components/ProfilScreen.tsx` | modifier | `ETAT_SYNC` : exclusion typée `hors-foyer` |
| `tests/sync/engine.test.ts` | modifier | tests états + reconnexion + statut canal |
| `tests/sync/ui.test.tsx` | modifier | matrice de visibilité du point |
| `CHANGELOG.md`, `docs/backend.md` | modifier | docs |

---

### Task 1: État `hors-foyer` (engine + UI, TDD)

**Files:**
- Test: `tests/sync/engine.test.ts`, `tests/sync/ui.test.tsx`
- Modify: `src/lib/sync/engine.ts`, `src/components/WeekBanner.tsx`, `src/components/ProfilScreen.tsx`

- [ ] **Step 1: Tests (rouge)**

`tests/sync/engine.test.ts` — dans le describe adapté (repérer le test existant qui asserte `attente` après `initSync` sans session, `rg -n "attente" tests/sync/engine.test.ts`, et l'adapter), ajouter/vérifier :

```ts
describe('sync: états de présence', () => {
  beforeEach(() => {
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    injecterClient(fauxClient());
  });
  afterEach(() => {
    reinitialiser();
  });

  it('sync active, sans session : hors-foyer (pas de point bannière)', () => {
    initSync({ onEtat: () => {}, onRemote: () => {} });
    expect(etatSync()).toBe('hors-foyer');
  });

  it('déconnexion volontaire : hors-foyer (reconnexion possible au profil)', () => {
    injecterClient(null); // simule un client créable ; connecterFoyer n'est pas utilisé ici
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    deconnecterFoyer();
    expect(etatSync()).toBe('hors-foyer');
    expect(lireSessionPub()).toBeNull();
  });
});
```

(Le test « déconnexion » : si `initSync` déclenche une connexion qui gêne, poser la session APRÈS initSync puis appeler `deconnecterFoyer()` — l'assertion porte sur l'état final.)

`tests/sync/ui.test.tsx` — dans le describe WeekBanner existant (ou nouveau), avec les fixtures du fichier :

```tsx
it('hors-foyer : aucun point bannière', () => {
  render(<WeekBanner meta={metaFix} syncEtat="hors-foyer" />);
  expect(screen.queryByRole('button', { name: /Synchronisation/ })).not.toBeInTheDocument();
});

it('attente et erreur : le point reste visible (régression)', () => {
  const { rerender } = render(<WeekBanner meta={metaFix} syncEtat="attente" />);
  expect(screen.getByRole('button', { name: /Synchronisation/ })).toBeInTheDocument();
  rerender(<WeekBanner meta={metaFix} syncEtat="erreur" />);
  expect(screen.getByRole('button', { name: /Synchronisation/ })).toBeInTheDocument();
});

it('hors-foyer au profil : le formulaire de connexion est proposé', () => {
  render(
    <ProfilScreen profile={profilFix} syncEtat="hors-foyer" onBack={() => {}} onChangeProfile={() => {}} onImported={() => {}} />,
  );
  expect(screen.getByLabelText('Code de foyer')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Se connecter au foyer/ })).toBeInTheDocument();
});
```

(`metaFix`/`profilFix` : réutiliser les fixtures déjà présentes dans `ui.test.tsx` — ne pas dupliquer.)

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/`
Expected: FAIL — `hors-foyer` inexistant dans `SyncEtat` (erreur de type ou assertion).

- [ ] **Step 3: Implémenter**

`src/lib/sync/engine.ts` :
1. Ligne 32 : `export type SyncEtat = 'off' | 'hors-foyer' | 'attente' | 'sync' | 'erreur';`
2. `initSync` (bloc sans session, ~ligne 417-420) :
```ts
    if (!lireSession()) {
      definirEtat('hors-foyer'); // sync prête, foyer non appairé : pas de point
      return;
    }
```
3. `deconnecterFoyer` (dernière ligne du corps) : `definirEtat('off')` → `definirEtat('hors-foyer');` — avec le commentaire :
```ts
  // hors-foyer (pas off) : le bloc Profil reste affiché avec le formulaire
  // de reconnexion — plus besoin de recharger la page pour se reconnecter.
  definirEtat('hors-foyer');
```

`src/components/WeekBanner.tsx` :
1. Ligne 6 : `const ETIQUETTES: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {` (contenu inchangé)
2. Ligne 32 : `const syncVisible = !!syncEtat && syncEtat !== 'off' && syncEtat !== 'hors-foyer';`

`src/components/ProfilScreen.tsx` :
1. Ligne 24 : `const ETAT_SYNC: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {` (entrées inchangées — `hors-foyer` n'affiche jamais de label : la branche sans session montre le formulaire).

- [ ] **Step 4: Vérifier le vert + suite complète**

Run: `npx vitest run tests/sync/ && npm test`
Expected: PASS (adapter les assertions `attente`→`hors-foyer` des tests existants si le rouge le demande).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/engine.ts src/components/WeekBanner.tsx src/components/ProfilScreen.tsx tests/sync/engine.test.ts tests/sync/ui.test.tsx
git commit -m "fix: sync — pas de point bannière tant que le foyer n'est pas appairé"
```

---

### Task 2: Reconnexion automatique (client, statut canal, tap, online — TDD)

**Files:**
- Test: `tests/sync/engine.test.ts`
- Modify: `src/lib/sync/client.ts`, `src/lib/sync/engine.ts`

- [ ] **Step 1: Tests (rouge)**

`tests/sync/engine.test.ts` — mock partiel de `creerClient` (en tête, après le mock config) :

```ts
// creerClient contrôlé : seul le chemin de reconnexion l'appelle (les tests
// existants passent par injecterClient).
const creerClientMock = vi.fn();
vi.mock('../../src/lib/sync/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sync/client')>()),
  creerClient: (...args: unknown[]) => creerClientMock(...args),
}));
```

Nouveau describe (aligner le style d'attente async sur les patterns existants du fichier — `await Promise.resolve()` en chaîne ou `vi.waitFor` selon ce qui y est déjà utilisé) :

```ts
describe('sync: reconnexion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    creerClientMock.mockReset();
  });
  afterEach(() => {
    reinitialiser();
    vi.useRealTimers();
  });

  it('ressynchronise recrée le client après un échec au démarrage', async () => {
    // Démarrage sans réseau : creerClient rejette → erreur, client null.
    creerClientMock.mockRejectedValueOnce(new Error('reseau'));
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('erreur'));
    // Le réseau revient : le tap sur le point recrée le client et repasse sync.
    const client = fauxClient();
    creerClientMock.mockResolvedValueOnce(client);
    ressynchroniser();
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
    expect(client.lectures.length).toBeGreaterThan(0); // post-connexion a pullé
  });

  it('fermeture du canal : erreur puis réabonnement automatique (~5 s)', async () => {
    const statuts: Array<((ouvert: boolean) => void) | null> = [];
    const client = fauxClient();
    client.abonner = vi.fn((_ev: () => void, st?: (ouvert: boolean) => void) => {
      statuts.push(st ?? null);
      return () => {};
    }) as unknown as SyncClient['abonner'];
    injecterClient(client);
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
    expect(statuts.length).toBe(1);

    statuts[0]?.(false); // TIMED_OUT / CLOSED / CHANNEL_ERROR
    expect(etatSync()).toBe('erreur');

    await vi.runAllTimersAsync(); // reconnexion planifiée (5 s)
    expect(client.abonner).toHaveBeenCalledTimes(2);
    statuts[1]?.(true); // le nouveau canal s'ouvre
    expect(etatSync()).toBe('sync');
  });

  it('retour du réseau sans client : connexion relancée', async () => {
    creerClientMock.mockRejectedValueOnce(new Error('reseau'));
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('erreur'));

    const client = fauxClient();
    creerClientMock.mockResolvedValueOnce(client);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
  });

  it('reinitialiser annule la reconnexion planifiée (aucun timer fantôme)', async () => {
    const statuts: Array<((ouvert: boolean) => void) | null> = [];
    const client = fauxClient();
    client.abonner = vi.fn((_ev: () => void, st?: (ouvert: boolean) => void) => {
      statuts.push(st ?? null);
      return () => {};
    }) as unknown as SyncClient['abonner'];
    injecterClient(client);
    definirSession('token-test', 'foyer-1');
    initSync({ onEtat: () => {}, onRemote: () => {} });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));

    statuts[0]?.(false);
    reinitialiser(); // annule tout
    injecterClient(client); // l'état module est remis à zéro
    definirSession('token-test', 'foyer-1');
    await vi.runAllTimersAsync(); // ne doit ni crasher ni réabonner
    expect(client.abonner).toHaveBeenCalledTimes(1);
  });
});
```

(`vi.waitFor` sous fake timers avance les timers automatiquement dans vitest récent — si la version du repo le refuse, remplacer par la pompe à microtasks du fichier.)

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: FAIL — `ressynchronise` ne reconnecte pas (état reste `erreur`), `abonner` jamais rappelé, etc.

- [ ] **Step 3: Implémenter**

`src/lib/sync/client.ts` :
1. Interface (ligne 12) : `abonner: (onEvenement: () => void, onStatut?: (ouvert: boolean) => void) => () => void;`
2. Implémentation `abonner` (lignes 59-72) :

```ts
    abonner: (onEvenement, onStatut) => {
      const canal = supabase.channel('sync-foyer');
      for (const t of TABLES) {
        canal.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: t, filter: `household_id=eq.${foyerId}` },
          () => onEvenement(),
        );
      }
      // Statut du canal : une coupure websocket doit être visible (erreur +
      // reconnexion), sinon l'app croit être à jour sans recevoir les push.
      canal.subscribe((status) => {
        if (status === 'SUBSCRIBED') onStatut?.(true);
        else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          onStatut?.(false);
        }
      });
      return () => {
        void supabase.removeChannel(canal);
      };
    },
```

`src/lib/sync/engine.ts` :
1. Variable module (près de `desabonner`, ligne 43) :
```ts
// Reconnexion du canal planifiée après une coupure (une seule en vol).
let reconnexionTimer: ReturnType<typeof setTimeout> | null = null;
```
2. `surEnLigne` (lignes 51-53) :
```ts
// Retour du réseau : si le client n'existe pas (échec au démarrage), on
// relance la connexion ; sinon on rafale ce qui s'est empilé hors ligne.
const surEnLigne = (): void => {
  if (!client && lireSession()) {
    void connecter().catch(() => definirEtat('erreur'));
    return;
  }
  void flush();
};
```
3. `reinitialiser` — ajouter après `pullTimer = null;` :
```ts
  if (reconnexionTimer) clearTimeout(reconnexionTimer);
  reconnexionTimer = null;
```
4. Nouvelles fonctions (placer `planifierReconnexion` puis `installerRealtime` AVANT `connecter` — pas de hoisting des const fléchées) :

```ts
// Coupure du canal : une seule reconnexion planifiée en vol (5 s), annulée
// par deconnecterFoyer/reinitialiser. No-op sans client ou sans session.
const planifierReconnexion = (): void => {
  if (reconnexionTimer) return;
  reconnexionTimer = setTimeout(() => {
    reconnexionTimer = null;
    if (client && lireSession()) installerRealtime();
  }, 5000);
};

// Installe (ou réinstalle) le realtime sur le client courant : événements
// data (pull debouncé) + statut du canal (coupure → erreur + reconnexion).
const installerRealtime = (): void => {
  if (!client) return;
  desabonner?.();
  desabonner = client.abonner(
    () => {
      if (pullTimer) clearTimeout(pullTimer);
      pullTimer = setTimeout(() => {
        void pull();
      }, 500);
    },
    (ouvert) => {
      if (ouvert) {
        if (etat !== 'sync') definirEtat('sync');
      } else {
        definirEtat('erreur');
        planifierReconnexion();
      }
    },
  );
};
```

5. `connecter` (lignes 353-364) — l'installation du realtime passe par la fonction :

```ts
const connecter = async (): Promise<void> => {
  if (!client) {
    client = await creerClient();
  }
  installerRealtime();
  await postConnexion();
};
```

6. `ressynchroniser` (lignes 433-438) :

```ts
// Tap sur l'indicateur de la bannière. Client absent (échec au démarrage) :
// reconnecter d'abord — flush/pull sans client ne feraient rien. Sinon :
// re-sync manuelle séquentielle (flush puis pull — jamais en parallèle).
export const ressynchroniser = (): void => {
  void (async () => {
    if (!client && lireSession()) {
      try {
        await connecter();
      } catch {
        definirEtat('erreur');
      }
      return;
    }
    await flush();
    if (client) await pull();
  })();
};
```

7. `deconnecterFoyer` — annuler la reconnexion planifiée, avant `viderOutbox()` :
```ts
  if (reconnexionTimer) clearTimeout(reconnexionTimer);
  reconnexionTimer = null;
```

- [ ] **Step 4: Vérifier le vert + suite complète**

Run: `npx vitest run tests/sync/ && npm test && npm run typecheck && npm run lint`
Expected: PASS (le faux `abonner: () => () => {}` des autres tests reste compatible avec la nouvelle signature).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/client.ts src/lib/sync/engine.ts tests/sync/engine.test.ts
git commit -m "fix: sync — reconnexion auto du client et du canal websocket"
```

---

### Task 3: Docs + gates

**Files:**
- Modify: `CHANGELOG.md`, `docs/backend.md`

- [ ] **Step 1: CHANGELOG — sous `## [Non publié]`, ajouter une section `### Corrigé` (avant `### Ajouté` si absente, sinon à la fin de la section Non publié, format Keep a Changelog) :**

```markdown
### Corrigé

- Le point de synchronisation de la bannière n'apparaît que si un foyer est appairé (plus de point « non connecté » en permanence) ; après une déconnexion volontaire, le bloc Profil propose de nouveau la connexion sans recharger la page
- Statut de sync vivant : échec de connexion au démarrage réparé par un appui sur le point ou au retour du réseau (plus besoin de recharger), coupure du canal websocket détectée et reconnexion automatique (~5 s)
```

- [ ] **Step 2: `docs/backend.md`**

- §5 (ligne 77) : après « (visible dès que la sync est compilée) », ajouter la précision : « — sur un appareil non appairé, aucun point n'est affiché dans la bannière ».
- §6 : remplacer le point 1 par :

```markdown
1. Téléphone A : connexion au code → la pastille de la bannière passe à
   « Synchronisé » (sans coche ni émoji — libellé au survol/lecteur d'écran ;
   un appui dessus force une re-sync, et recrée la connexion si elle a échoué
   au démarrage). Le bloc Profil → Synchronisation affiche « Synchronisé. »
```

et ajouter un point 5 après le point 4 :

```markdown
5. Indisponibilité momentanée de Supabase à l'ouverture → le point passe en
   erreur ; un appui dessus (ou le retour du réseau) reconnecte sans
   recharger la page. Coupure du canal en plein usage → erreur puis
   reconnexion automatique en ~5 s.
```

- Vérifier `rg -ni "sync" ai/context/` : aucune mention des états → rien à changer (sinon, aligner).

- [ ] **Step 3: Gates**

Run: `npm test`
Expected: PASS (tous les fichiers).

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS — `dist/` contient `sw.js` + `manifest.webmanifest`.

Run: `npm run e2e`
Expected: PASS (48/48) — aucun e2e ne dépend du point sync (vérifié) ; zéro débordement 320/375.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/backend.md
git commit -m "docs: sync — point bannière conditionné au foyer, reconnexion automatique"
```

---

## Self-review (fait à l'écriture du plan)

- **Spec couverte** : machine à états (Task 1 : initSync/deconnecter → hors-foyer, dot masqué, bloc profil) ; transitions reconnect-first (Task 2 : ressynchroniser, statut canal, online, reconnexion planifiée, annulations) ; tap = reconnexion seulement (pas de navigation) ; pas de timer permanent (une seule reconnexion planifiée à la fois) ; docs + checklist à deux téléphones dans la spec.
- **Types cohérents** : `SyncEtat` étendu côté engine seul (source unique) ; `ETIQUETTES`/`ETAT_SYNC` exclusions typées alignées ; `SyncClient.abonner` à 2 params compatible avec les faux clients existants (fonction ignorant les args).
- **Pièges levés** : ordre des const (installerRealtime avant connecter) ; annulation des timers dans reinitialiser ET deconnecterFoyer ; mock partiel de creerClient sans casser injecterClient ; syncActif mocké par fichier de test.
- **Risque résiduel assumé** : `SUBSCRIBED` arrive aussi à la première souscription → `definirEtat('sync')` peut précéder la fin de postConnexion ; cosmétique (postConnexion finit sur `sync`), accepté.
