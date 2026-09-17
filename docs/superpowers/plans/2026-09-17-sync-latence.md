# Sync latence — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réduire « coche sur A → visible sur B » de ~3-4 s à ~0,5-1 s (3 réglages, zéro changement d'architecture).

**Architecture:** `src/lib/sync/engine.ts` uniquement — debounce flush 2 000 → 300 ms, debounce pull 500 → 150 ms (event + rattrapage), lectures des 5 tables en `Promise.all` dans `pull()` et `postConnexion()`. Règles outbox-prime / fencing / dédup inchangées.

**Tech stack:** TypeScript strict, vitest (fake timers), zéro nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-09-17-sync-latence-design.md`

---

## Préambule : worktree (une fois, avant Task 1)

- [ ] **Créer le worktree depuis main**

```bash
git worktree add .worktrees/sync-latence -b feat/sync-latence main
cd .worktrees/sync-latence && npm install
```

- [ ] **Baseline verte**

```bash
npm test
```

Attendu : `Tests  490 passed (490)` (spéc `6d0b712` incluse). Les warnings `happy-dom` ×22 sont préexistants, ignorer.

---

### Task 1: Tests rouges — debounce 300 ms + pull parallèle

**Files:**
- Modify: `tests/sync/engine.test.ts` (test l.298-310 réécrit ; nouveau test inséré dans le describe `sync: pull / merge (outbox prime)`, après le test « une coche remote s'applique quand rien n'est en attente », fin l.357)

- [ ] **Step 1: Réécrire le test debounce flush pour 300 ms**

Remplacer l'intégralité du test `flushDiffere debounce : une seule flush après 2s, reset du timer` (l.298-310) par :

```ts
  it('flushDiffere debounce : une seule flush après 300 ms, reset du timer', async () => {
    vi.useFakeTimers();
    setCheck('2026-S39', 'b1', true);
    setCheck('2026-S39', 'b2', true);
    flushDiffere();
    await vi.advanceTimersByTimeAsync(200);
    flushDiffere(); // reset : le premier timer (200 ms déjà écoulés) est annulé
    await vi.advanceTimersByTimeAsync(299);
    expect(client.upserts).toEqual([]); // 200 + 299 > 300 : sans reset, la flush serait déjà passée
    await vi.advanceTimersByTimeAsync(10);
    expect(client.upserts).toHaveLength(1);
    expect(client.upserts[0]?.rows).toHaveLength(2); // les deux coches, groupées
  });
```

- [ ] **Step 2: Ajouter le test pull parallèle**

Dans le describe `sync: pull / merge (outbox prime)`, insérer après le test « une coche remote s'applique quand rien n'est en attente » :

```ts
  it('pull démarre les 5 lectures en parallèle (avant la première réponse)', async () => {
    let demarrees = 0;
    let resoudre!: () => void;
    const barriere = new Promise<void>((r) => {
      resoudre = r;
    });
    injecterClient({
      ...client,
      toutLire: async (t: TableSync) => {
        demarrees++;
        return barriere.then(() => client.toutLire(t));
      },
    });
    void pull();
    await Promise.resolve(); // tick : laisser le corps de pull démarrer les lectures
    expect(demarrees).toBe(5); // for...await séquentiel : 1 seule démarre avant la 1re réponse
    resoudre();
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
  });
```

- [ ] **Step 3: Vérifier le rouge**

```bash
npx vitest run tests/sync/engine.test.ts
```

Attendu : **2 échecs** — le test debounce (la flush ne part qu'à 2 000 ms, `upserts` reste vide à 309 ms) et le test parallèle (`demarrees` = 1 ≠ 5 avec le `for...await`). Les autres tests du fichier passent.

---

### Task 2: Implémentation — les 3 réglages dans `src/lib/sync/engine.ts`

**Files:**
- Modify: `src/lib/sync/engine.ts` (l.40, l.171, l.391, l.402, `pull` l.300-314, `postConnexion` l.360-368)

- [ ] **Step 1: Debounce flush 2 000 → 300 ms**

Dans `flushDiffere` (l.167-172), remplacer `}, 2000);` par `}, 300);` — le bloc final devient :

```ts
export const flushDiffere = (): void => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flush();
  }, 300);
};
```

- [ ] **Step 2: Debounce pull 500 → 150 ms (commentaire + 2 timers)**

1. l.40 : `// Debounce du realtime : rafale d'événements → un seul pull après 500 ms.` → `// Debounce du realtime : rafale d'événements → un seul pull après 150 ms.`
2. l.391 (handler data de `installerRealtime`) : `      }, 500);` → `      }, 150);`
3. l.402 (rattrapage post-coupure) : `        }, 500); // rattrapage : récupérer ce que la coupure a fait manquer` → `        }, 150); // rattrapage : récupérer ce que la coupure a fait manquer`

- [ ] **Step 3: `pull()` — lectures parallèles**

Remplacer tout le corps de `pull` (l.300-314) par :

```ts
export const pull = async (): Promise<void> => {
  const c = client;
  if (!c) return;
  try {
    // Lectures parallèles : 5 tables en 1 RTT au lieu de 5 RTT séquentiels.
    const listes = await Promise.all(TABLES.map((t) => c.toutLire(t)));
    if (!client || !lireSession()) return; // déconnexion pendant les lectures → n'écrit rien
    const rows = {} as Record<TableSync, RowSync[]>;
    TABLES.forEach((t, i) => {
      rows[t] = listes[i];
    });
    if (await appliquerRemote(rows)) onRemote?.();
    definirEtat('sync');
  } catch {
    definirEtat('erreur'); // symétrique de la flush : retry au prochain déclencheur
  }
};
```

- [ ] **Step 4: `postConnexion()` — lectures parallèles**

Remplacer le corps (l.360-368) par :

```ts
const postConnexion = async (): Promise<void> => {
  const c = client;
  if (!c || !lireSession()) return;
  definirEtat('attente');
  pousserTout();
  const listes = await Promise.all(TABLES.map((t) => c.toutLire(t)));
  if (!client || !lireSession()) return; // déconnexion pendant les lectures → n'écrit rien
  const rows = {} as Record<TableSync, RowSync[]>;
  TABLES.forEach((t, i) => {
    rows[t] = listes[i];
  });
  if (await appliquerRemote(rows)) onRemote?.();
  await flush();
};
```

- [ ] **Step 5: Vérifier le vert**

```bash
npx vitest run tests/sync/engine.test.ts
```

Attendu : tous les tests du fichier passent (491 au total ensuite).

- [ ] **Step 6: Gates complètes**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Attendu : `Tests  491 passed (491)`, typecheck/lint zéro erreur, build OK (`dist/sw.js` + `dist/manifest.webmanifest` présents).

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync/engine.ts tests/sync/engine.test.ts
git commit -m "perf: latence de sync — debounce flush 300 ms, pulls parallèles, realtime 150 ms"
```

---

### Task 3: Docs

**Files:**
- Modify: `docs/backend.md:103` et `docs/backend.md:104`
- Modify: `docs/superpowers/specs/2026-09-16-sync-supabase-design.md:113`
- Modify: `CHANGELOG.md` (section `### Changé` de `[Non publié]`)

- [ ] **Step 1: backend.md — les deux constantes**

l.102-103 : `Flush différée de\n  2 s après mutation, dédup « dernier op gagne » par clé.` → `Flush différée de\n  ~300 ms après mutation, dédup « dernier op gagne » par clé.`

l.104 : `- **Pull/merge** : le realtime (debounce 500 ms) déclenche un pull ; le merge` → `- **Pull/merge** : le realtime (debounce 150 ms) déclenche un pull ; le merge`

(l.91 « ~1 s, realtime » reste — la promesse devient vraie.)

- [ ] **Step 2: Spec sync-supabase — le paramètre**

l.113 : `mutation locale (flush différée ~2 s, debounce)` → `mutation locale (flush différée ~300 ms, debounce)`

- [ ] **Step 3: CHANGELOG — entrée sous `### Changé`**

Après le bullet « Échelles de design tokenisées… » (l.16), ajouter :

```markdown
- Latence de sync réduite : une coche apparaît sur l'autre téléphone en < 1 s (flush différée 2 s → 300 ms, lectures des 5 tables en parallèle, debounce realtime 500 → 150 ms).
```

- [ ] **Step 4: Vérification + commit**

```bash
npm test
git add docs/backend.md docs/superpowers/specs/2026-09-16-sync-supabase-design.md CHANGELOG.md
git commit -m "docs: latence de sync (~300 ms / < 1 s) documentée"
```

Attendu : `Tests  491 passed (491)` (docs only, rien ne bouge).

---

### Task 4: PR

**Files:** aucune — push + `gh`.

- [ ] **Step 1: Pusher la branche**

```bash
git push -u origin feat/sync-latence
```

- [ ] **Step 2: Créer la PR**

```bash
gh pr create --title "Perf : latence de sync (coche visible en < 1 s)" --body "$(cat <<'EOF'
## Objectif

« Je coche sur A → ça apparaît sur B » en ~0,5-1 s au lieu de ~3-4 s.

## Changements (src/lib/sync/engine.ts uniquement)

- Debounce flush après mutation : 2 000 → 300 ms (reset du timer conservé — les rafales partent toujours groupées, dédup « dernier op gagne »)
- Debounce pull realtime : 500 → 150 ms (event data + rattrapage post-coupure)
- Lectures des 5 tables en Promise.all au lieu de séquentiel (pull + postConnexion) : 5 RTT → 1 RTT

Règles inchangées : outbox-prime, fencing flush, dédup, purge serveur d'abord, reconnexion 5 s.

## Tests

- 491/491 (nouveau : pull démarre les 5 lectures en parallèle avant la première réponse ; debounce flush réécrit pour 300 ms)
- Gates : typecheck, lint, build verts

## Spec

docs/superpowers/specs/2026-09-17-sync-latence-design.md
EOF
)"
```

- [ ] **Step 3: Attendre la CI**

```bash
gh pr checks --watch
```

Attendu : `ci` COMPLETED · SUCCESS.

- [ ] **Step 4: Signaler l'URL à l'utilisateur — ne JAMAIS merger soi-même** (règle AGENTS.md). Après merge utilisateur : `git checkout main && git pull`, vérifier le workflow `Deploy` vert, supprimer le worktree `.worktrees/sync-latence` et la branche `feat/sync-latence` (local + origin).
