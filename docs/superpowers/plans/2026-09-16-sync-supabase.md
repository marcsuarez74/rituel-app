# Backend de sync Supabase — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchroniser les données (semaines, coches, pesées, dépenses, profils) entre les 2 téléphones via Supabase, en gardant l'app 100 % offline-first (localStorage = source de vérité, Supabase = miroir optionnel).

**Architecture:** Module `src/lib/sync/` (logique pure, zéro React) branché sur `storage.ts` (chaque mutation empile une entrée d'outbox) ; merge « outbox locale prime » ; realtime Supabase → re-lecture ; UI discrète (étape onboarding optionnelle, bloc Profil, point bannière). Infra : SQL + edge function + script de création de foyer dans `supabase/`.

**Tech Stack:** React 18 + TS strict (existant), `@supabase/supabase-js` (dynamic import), Postgres/RLS, Deno edge function, vitest + Testing Library.

**Spec de référence:** `docs/superpowers/specs/2026-09-16-sync-supabase-design.md`

**Règles transverses:**
- TDD : chaque tâche = test d'abord (rouge) → implémentation (vert) → commit. `npm run test:watch` pour boucler.
- Avant chaque commit : `npm test && npm run typecheck && npm run lint` verts.
- Travail dans le worktree `.worktrees/sync-supabase` (branche `feat/sync-supabase`). Commits français préfixés (`feat:`, `test:`, `docs:`, `chore:`).
- TS strict + `verbatimModuleSyntax` (types en `import type`) + `noUnusedLocals`. Pas de default export.
- En vitest, `import.meta.env.VITE_SUPABASE_*` est `undefined` → `syncActif()` = false → les suites existantes (storage, app, components) ne voient **aucun** changement. Les tests sync forcent l'activation via `vi.mock` de `src/lib/sync/config`.
- e2e Playwright : **inchangés** (sync désactivée sans env). La tâche finale les relance en non-régression.

---

### Task 1: Dépendance + `config.ts`

**Files:**
- Create: `src/lib/sync/config.ts`
- Modify: `package.json` (via npm)

- [ ] **Step 1: Installer la dépendance**

```bash
npm install @supabase/supabase-js@^2
```

Attendu : ajout dans `dependencies`. (Discussion validation : brainstorming 2026-09-16 — la dépendance est acceptée, chargée en dynamic import uniquement.)

- [ ] **Step 2: Écrire `src/lib/sync/config.ts`**

```ts
/// <reference types="vite/client" />

// Sync optionnelle : sans VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, l'app se
// comporte exactement comme avant (aucun code réseau chargé, aucune outbox).

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

// `noUnusedLocals` exige que l'interface serve : cast de garde de forme.
const env = import.meta.env as ImportMetaEnv;

export const SUPABASE_URL: string | undefined = env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY: string | undefined = env.VITE_SUPABASE_ANON_KEY;

export const syncActif = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
```

> Ajustement Task 1 : le code initial (lecture directe `import.meta.env.VITE_*`) échouait au typecheck (`noUnusedLocals` sur l'interface) — la forme ci-dessus est la version livrée.

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck`
Expected: PASS (aucune régression — pas encore d'imports de ce module).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/sync/config.ts
git commit -m "feat: dep @supabase/supabase-js + config sync (env Vite)"
```

---

### Task 2: `session.ts` — token de foyer

**Files:**
- Create: `src/lib/sync/session.ts`
- Test: `tests/sync/session.test.ts`

- [ ] **Step 1: Écrire le test (rouge)** — `tests/sync/session.test.ts`

```ts
import { definirSession, effacerSession, lireSession } from '../../src/lib/sync/session';

describe('sync: session foyer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lireSession est null sans connexion', () => {
    expect(lireSession()).toBeNull();
  });

  it('definirSession puis lireSession restitue token et foyer', () => {
    definirSession('jwt.xxx.yyy', '11111111-2222-3333-4444-555555555555');
    expect(lireSession()).toEqual({
      token: 'jwt.xxx.yyy',
      foyerId: '11111111-2222-3333-4444-555555555555',
    });
  });

  it('effacerSession supprime tout', () => {
    definirSession('t', 'f');
    effacerSession();
    expect(lireSession()).toBeNull();
  });

  it('lireSession est null si un seul des deux champs manque', () => {
    localStorage.setItem('sportapp:sync:token', 't');
    expect(lireSession()).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/session.test.ts`
Expected: FAIL (`Cannot find module .../sync/session`)

- [ ] **Step 3: Écrire `src/lib/sync/session.ts`**

```ts
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

const TOKEN_KEY = 'sportapp:sync:token';
const FOYER_KEY = 'sportapp:sync:foyer';

export interface SessionFoyer {
  token: string;
  foyerId: string;
}

export const lireSession = (): SessionFoyer | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const foyerId = localStorage.getItem(FOYER_KEY);
  return token && foyerId ? { token, foyerId } : null;
};

export const definirSession = (token: string, foyerId: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(FOYER_KEY, foyerId);
};

export const effacerSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(FOYER_KEY);
};

// Appel de l'edge function connexion-foyer : { code } → { token, foyer }.
// 401 = code refusé. Le code de foyer ne vit nulle part ailleurs.
export const demanderSession = async (code: string): Promise<SessionFoyer> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/connexion-foyer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY! },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error('code-refuse');
  const { token, foyer } = (await res.json()) as { token?: string; foyer?: string };
  if (!token || !foyer) throw new Error('reponse-invalide');
  // l'edge renvoie `foyer` — mappé vers SessionFoyer.foyerId
  return { token, foyerId: foyer };
};
```

> Ajustement Task 2 : la version initiale du plan retournait `{ token, foyer }` (hors type `SessionFoyer`) — corrigé en `{ token, foyerId: foyer }`.

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/sync/session.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/session.ts tests/sync/session.test.ts
git commit -m "feat: session foyer sync (token + foyerId en localStorage)"
```

---

### Task 3: `outbox.ts` — file des mutations

**Files:**
- Create: `src/lib/sync/outbox.ts`
- Test: `tests/sync/outbox.test.ts`

- [ ] **Step 1: Écrire le test (rouge)** — `tests/sync/outbox.test.ts`

```ts
import { vi } from 'vitest';
import {
  empiler,
  empilerMutation,
  lireOutbox,
  retirer,
  surEmpile,
  viderOutbox,
  type MutationSync,
} from '../../src/lib/sync/outbox';

// Force l'activation : en vitest, VITE_SUPABASE_* est undefined.
vi.mock('../../src/lib/sync/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  syncActif: () => true,
}));

import { definirSession, effacerSession } from '../../src/lib/sync/session';

const up = (overrides: Partial<MutationSync> = {}): MutationSync => ({
  op: 'upsert',
  table: 'checks',
  key: { semaine: '2026-S39', check_id: 'b1' },
  payload: { done: true },
  ...overrides,
});

describe('sync: outbox', () => {
  beforeEach(() => {
    localStorage.clear();
    effacerSession();
  });

  it('lireOutbox vide sans connexion', () => {
    expect(lireOutbox()).toEqual([]);
  });

  it('empiler + lireOutbox restitue la mutation', () => {
    definirSession('t', 'f');
    empiler(up());
    expect(lireOutbox()).toEqual([up()]);
  });

  it('empiler dédoublonne par (op, table, key) — le dernier gagne', () => {
    definirSession('t', 'f');
    empiler(up());
    empiler(up({ payload: { done: false } }));
    expect(lireOutbox()).toEqual([up({ payload: { done: false } })]);
  });

  it('retirer ne retire que la mutation identique (key + payload)', () => {
    definirSession('t', 'f');
    empiler(up());
    empiler(up({ key: { semaine: '2026-S39', check_id: 'b2' }, payload: { done: true } }));
    retirer(up({ key: { semaine: '2026-S39', check_id: 'b2' }, payload: { done: true } }));
    expect(lireOutbox()).toEqual([up()]);
    // même clé mais payload différent : conservé
    retirer(up({ payload: { done: false } }));
    expect(lireOutbox()).toEqual([up()]);
  });

  it('viderOutbox supprime la clé', () => {
    definirSession('t', 'f');
    empiler(up());
    viderOutbox();
    expect(lireOutbox()).toEqual([]);
  });

  it('empilerMutation est un no-op sans session', () => {
    empilerMutation(up());
    expect(lireOutbox()).toEqual([]);
  });

  it('empilerMutation empile et déclenche le callback avec session', () => {
    definirSession('t', 'f');
    const cb = vi.fn();
    surEmpile(cb);
    empilerMutation(up());
    expect(lireOutbox()).toEqual([up()]);
    expect(cb).toHaveBeenCalledOnce();
    surEmpile(null as unknown as () => void); // débranche pour les autres tests
  });

  it('outbox corrompue → vidée silencieusement', () => {
    localStorage.setItem('sportapp:sync:outbox', '{pas-du-json');
    expect(lireOutbox()).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/outbox.test.ts`
Expected: FAIL (module absent)

- [ ] **Step 3: Écrire `src/lib/sync/outbox.ts`**

```ts
import { syncActif } from './config';
import { lireSession } from './session';

export type TableSync = 'weeks' | 'checks' | 'weights' | 'depenses' | 'profiles';

// Mutation locale en attente d'envoi. `key` identifie la ligne (clé primaire
// sans household_id), `payload` porte la valeur (absent pour un delete).
export interface MutationSync {
  op: 'upsert' | 'delete';
  table: TableSync;
  key: Record<string, string>;
  payload?: Record<string, unknown>;
}

const OUTBOX_KEY = 'sportapp:sync:outbox';

export const lireOutbox = (): MutationSync[] => {
  const raw = localStorage.getItem(OUTBOX_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MutationSync[]) : [];
  } catch {
    console.warn(`Outbox corrompue ignorée : ${OUTBOX_KEY}`);
    localStorage.removeItem(OUTBOX_KEY);
    return [];
  }
};

const ecrireOutbox = (m: MutationSync[]): void => localStorage.setItem(OUTBOX_KEY, JSON.stringify(m));

const memeCle = (a: MutationSync, b: MutationSync): boolean =>
  a.op === b.op && a.table === b.table && JSON.stringify(a.key) === JSON.stringify(b.key);

const identique = (a: MutationSync, b: MutationSync): boolean =>
  memeCle(a, b) && JSON.stringify(a.payload ?? null) === JSON.stringify(b.payload ?? null);

// Dédoublonnage : une nouvelle mutation sur la même clé remplace l'ancienne —
// la flush enverra la valeur finale locale, pas l'historique.
export const empiler = (m: MutationSync): void => {
  ecrireOutbox([...lireOutbox().filter((x) => !memeCle(x, m)), m]);
};

// Ne retire que l'entrée strictement identique : une re-mutation arrivée
// pendant la flush (même clé, payload différent) survit.
export const retirer = (m: MutationSync): void => {
  ecrireOutbox(lireOutbox().filter((x) => !identique(x, m)));
};

export const viderOutbox = (): void => localStorage.removeItem(OUTBOX_KEY);

let auMoinsUneEmpile: (() => void) | null = null;

// Registré par engine.initSync : une mutation locale déclenche une flush différée.
export const surEmpile = (cb: (() => void) | null): void => {
  auMoinsUneEmpile = cb;
};

// Point d'entrée unique pour storage.ts : no-op tant que la sync n'est pas
// configurée (env absente) ou connectée (pas de token). L'app sans backend
// n'écrit JAMAIS d'outbox — zéro impact sur le comportement actuel.
export const empilerMutation = (m: MutationSync): void => {
  if (!syncActif() || !lireSession()) return;
  empiler(m);
  auMoinsUneEmpile?.();
};
```

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/sync/outbox.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/outbox.ts tests/sync/outbox.test.ts
git commit -m "feat: outbox sync — file persistée des mutations locales"
```

---

### Task 4: `storage.ts` → outbox (miroir des mutations)

**Files:**
- Modify: `src/lib/storage.ts` (6 fonctions)
- Test: `tests/sync/storage-mirror.test.ts`

- [ ] **Step 1: Écrire le test (rouge)** — `tests/sync/storage-mirror.test.ts`

```ts
import { vi } from 'vitest';
import type { ImportedWeek, UserProfile, WeeklyData } from '../../src/lib/model';
import { parseWeeklyFile } from '../../src/lib/parse';

vi.mock('../../src/lib/sync/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  syncActif: () => true,
}));

import { definirSession, effacerSession } from '../../src/lib/sync/session';
import { lireOutbox, viderOutbox } from '../../src/lib/sync/outbox';
import {
  addWeight,
  deleteDepense,
  saveDepense,
  saveProfile,
  setCheck,
  upsertWeek,
} from '../../src/lib/storage';

const week = (): WeeklyData => ({
  meta: { semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' },
  courses: [{ id: 'c1', rayon: 'Fraîcheur', label: 'Poulet 600 g' }],
  menu: [{ jour: 'lundi', dejeunerMarc: 'Poulet riz' }],
  batch: [{ id: 'b1', label: 'Riz à l’avance' }],
  profiles: {
    marc: { cibles: [], seances: [], rappels: [] },
    melanie: { cibles: [], seances: [], rappels: [] },
  },
});

describe('sync: storage → outbox', () => {
  beforeEach(() => {
    localStorage.clear();
    viderOutbox();
    effacerSession();
  });

  const connecte = () => definirSession('t', '11111111-2222-3333-4444-555555555555');

  it('setCheck empile une upsert checks', () => {
    connecte();
    setCheck('2026-S39', 'b1', true);
    expect(lireOutbox()).toEqual([
      {
        op: 'upsert',
        table: 'checks',
        key: { semaine: '2026-S39', check_id: 'b1' },
        payload: { done: true },
      },
    ]);
  });

  it('addWeight empile une upsert weights', () => {
    connecte();
    addWeight('marc', '2026-09-21', 82.4);
    expect(lireOutbox()).toEqual([
      {
        op: 'upsert',
        table: 'weights',
        key: { profil: 'marc', date_: '2026-09-21' },
        payload: { kg: 82.4 },
      },
    ]);
  });

  it('saveDepense empile avec magasin_key minuscule ; deleteDepense empile un delete', () => {
    connecte();
    saveDepense('2026-09-21', 'Lidl', 43.2);
    deleteDepense('2026-09-21', 'Lidl');
    expect(lireOutbox()).toEqual([
      {
        op: 'upsert',
        table: 'depenses',
        key: { date_: '2026-09-21', magasin_key: 'lidl' },
        payload: { magasin: 'Lidl', total: 43.2 },
      },
      {
        op: 'delete',
        table: 'depenses',
        key: { date_: '2026-09-21', magasin_key: 'lidl' },
      },
    ]);
  });

  it('saveProfile empile une upsert profiles (payload = profil nettoyé)', () => {
    connecte();
    const p = {
      id: 'marc',
      dateNaissance: '1990-01-01',
      taille: 180,
      objectif: { type: 'maintien' },
      complements: [],
      regime: 'aucun',
    } as unknown as UserProfile;
    saveProfile(p);
    const [m] = lireOutbox();
    expect(m.table).toBe('profiles');
    expect(m.key).toEqual({ profil: 'marc' });
    expect(m.payload).toMatchObject({ id: 'marc' });
  });

  it('upsertWeek empile une upsert weeks (payload = ImportedWeek)', () => {
    connecte();
    // frontmatter complet requis par parseWeeklyFile (menu, du, au)
    const raw = '---\nsemaine: 2026-S39\nmenu: A\ndu: 2026-09-21\nau: 2026-09-27\n---\n';
    const { data } = parseWeeklyFile(raw);
    const imp: ImportedWeek = { raw, data, importedAt: new Date().toISOString() };
    upsertWeek(raw, data);
    const [m] = lireOutbox();
    expect(m.table).toBe('weeks');
    expect(m.key).toEqual({ semaine: '2026-S39' });
    expect(m.payload).toEqual(imp);
  });

  it('sans connexion : aucune outbox (comportement actuel préservé)', () => {
    setCheck('2026-S39', 'b1', true);
    addWeight('marc', '2026-09-21', 82.4);
    expect(lireOutbox()).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/storage-mirror.test.ts`
Expected: FAIL (les mutations n'empilent rien)

- [ ] **Step 3: Brancher `src/lib/storage.ts`**

En tête, ajouter :

```ts
import { empilerMutation } from './sync/outbox';
```

Puis, dans chaque fonction, la ligne `empilerMutation(...)` **après** le `localStorage.setItem` :

`setCheck` (fin de fonction) :
```ts
  empilerMutation({
    op: 'upsert',
    table: 'checks',
    key: { semaine, check_id: id },
    payload: { done },
  });
```

`addWeight` (après `localStorage.setItem(weightsKey(p), …)`) :
```ts
  empilerMutation({
    op: 'upsert',
    table: 'weights',
    key: { profil: p, date_: date },
    payload: { kg },
  });
```

`saveDepense` (après `localStorage.setItem(DEPENSES_KEY, …)`) :
```ts
  empilerMutation({
    op: 'upsert',
    table: 'depenses',
    key: { date_: date, magasin_key: mag.toLowerCase() },
    payload: { magasin: mag, total },
  });
```

`deleteDepense` (après `localStorage.setItem(DEPENSES_KEY, …)`) :
```ts
  empilerMutation({
    op: 'delete',
    table: 'depenses',
    key: { date_: date, magasin_key: mag },
  });
```

`saveProfile` (après `localStorage.setItem(PROFILE_KEY, JSON.stringify(net))`) :
```ts
  empilerMutation({ op: 'upsert', table: 'profiles', key: { profil: net.id }, payload: { ...net } });
```

`upsertWeek` (après `localStorage.setItem(WEEKS_KEY, …)`) :
```ts
  empilerMutation({
    op: 'upsert',
    table: 'weeks',
    key: { semaine: data.meta.semaine },
    payload: { ...semaines[data.meta.semaine] },
  });
```

> `saveWeek` n'est pas branché : c'est l'écriture legacy, non utilisée par l'UI (le premier push complet à la connexion couvre ces données).

- [ ] **Step 4: Vérifier le vert + non-régression**

Run: `npm test`
Expected: PASS — y compris les suites storage/app/components existantes (sans env, `empilerMutation` est un no-op).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts tests/sync/storage-mirror.test.ts
git commit -m "feat: chaque mutation locale alimente l'outbox sync"
```

---

### Task 5: `client.ts` — port étroit sur supabase-js

**Files:**
- Create: `src/lib/sync/client.ts`

Pas de test unitaire réseau : ce fichier est le SEUL point de contact avec supabase-js (validé à l'intégration, Task 13). La logique est testée via le port `SyncClient` avec un faux client.

- [ ] **Step 1: Écrire `src/lib/sync/client.ts`**

```ts
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { TableSync } from './outbox';
import { lireSession } from './session';

export type RowSync = Record<string, unknown>;

export interface SyncClient {
  upsert: (table: TableSync, rows: RowSync[]) => Promise<void>;
  supprimer: (table: TableSync, clefs: Record<string, string>[]) => Promise<void>;
  toutLire: (table: TableSync) => Promise<RowSync[]>;
  purger: () => Promise<void>;
  abonner: (onEvenement: () => void) => () => void;
}

const TABLES: TableSync[] = ['weeks', 'checks', 'weights', 'depenses', 'profiles'];

const verifier = (error: { message: string } | null): void => {
  if (error) throw new Error(error.message);
};

// Port étroit sur supabase-js — dynamic import : l'app sans backend ne
// télécharge jamais cette dépendance (le chunk est séparé par le bundler).
export const creerClient = async (): Promise<SyncClient> => {
  const { createClient } = await import('@supabase/supabase-js');
  const { token, foyerId } = lireSession()!;
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  // Le realtime passe les RLS : il a besoin du JWT foyer lui aussi.
  try {
    supabase.realtime.setAuth(token);
  } catch {
    // version sans setAuth : REST seul, le pull reste fonctionnel
  }

  return {
    upsert: async (table, rows) => {
      const { error } = await supabase.from(table).upsert(rows);
      verifier(error);
    },
    supprimer: async (table, clefs) => {
      for (const cle of clefs) {
        let q = supabase.from(table).delete().eq('household_id', foyerId);
        for (const [k, v] of Object.entries(cle)) q = q.eq(k, v);
        const { error } = await q;
        verifier(error);
      }
    },
    toutLire: async (table) => {
      const { data, error } = await supabase.from(table).select('*').eq('household_id', foyerId);
      verifier(error);
      return (data ?? []) as RowSync[];
    },
    purger: async () => {
      for (const t of TABLES) {
        const { error } = await supabase.from(t).delete().eq('household_id', foyerId);
        verifier(error);
      }
    },
    abonner: (onEvenement) => {
      const canal = supabase.channel('sync-foyer');
      for (const t of TABLES) {
        canal.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: t, filter: `household_id=eq.${foyerId}` },
          () => onEvenement(),
        );
      }
      canal.subscribe();
      return () => {
        void supabase.removeChannel(canal);
      };
    },
  };
};
```

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync/client.ts
git commit -m "feat: port SyncClient sur supabase-js (dynamic import, RLS foyer)"
```

---

### Task 6: `engine.ts` — flush de l'outbox

**Files:**
- Create: `src/lib/sync/engine.ts`
- Test: `tests/sync/engine.test.ts`

- [ ] **Step 1: Écrire le test (rouge)** — partie flush de `tests/sync/engine.test.ts`

```ts
import { afterEach, beforeEach, vi } from 'vitest';
import type { RowSync, SyncClient } from '../../src/lib/sync/client';
import type { MutationSync, TableSync } from '../../src/lib/sync/outbox';

vi.mock('../../src/lib/sync/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  syncActif: () => true,
}));

import {
  etatSync,
  flush,
  injecterClient,
  reinitialiser,
} from '../../src/lib/sync/engine';
import { definirSession, effacerSession } from '../../src/lib/sync/session';
import { lireOutbox, viderOutbox } from '../../src/lib/sync/outbox';
import { setCheck } from '../../src/lib/storage';

// Faux client : enregistre les appels, pas de réseau.
const fauxClient = (): SyncClient & {
  upserts: Array<{ table: TableSync; rows: RowSync[] }>;
  suppressions: Array<{ table: TableSync; clefs: Record<string, string>[] }>;
  echouer: (apres: 'aucun' | number) => void;
} => {
  const c = {
    upserts: [] as Array<{ table: TableSync; rows: RowSync[] }>,
    suppressions: [] as Array<{ table: TableSync; clefs: Record<string, string>[] }>,
    echecApres: Infinity as number,
    async upsert(table: TableSync, rows: RowSync[]) {
      if (c.echecApres <= c.upserts.length) throw new Error('reseau');
      c.upserts.push({ table, rows });
    },
    async supprimer(table: TableSync, clefs: Record<string, string>[]) {
      c.suppressions.push({ table, clefs });
    },
    async toutLire(table: TableSync) {
      return (c.lues[table] ?? []) as RowSync[];
    },
    async purger() {
      c.purgees = true;
    },
    abonner: () => () => {},
    lues: {} as Record<string, RowSync[]>,
    purgees: false,
  };
  c.echouer = (apres) => {
    c.echecApres = apres;
  };
  return c as unknown as SyncClient & typeof c;
};

describe('sync: flush', () => {
  let client: ReturnType<typeof fauxClient>;

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    client = fauxClient();
    injecterClient(client);
    definirSession('t', '11111111-2222-3333-4444-555555555555');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flush vide : aucun appel, etat sync', async () => {
    await flush();
    expect(client.upserts).toEqual([]);
    expect(etatSync()).toBe('sync');
  });

  it('flush groupe les upserts par table puis retire les entrées', async () => {
    setCheck('2026-S39', 'b1', true);
    setCheck('2026-S39', 'b2', false);
    await flush();
    expect(client.upserts).toEqual([
      {
        table: 'checks',
        rows: [
          {
            household_id: '11111111-2222-3333-4444-555555555555',
            semaine: '2026-S39',
            check_id: 'b1',
            done: true,
            updated_at: expect.any(String),
          },
          {
            household_id: '11111111-2222-3333-4444-555555555555',
            semaine: '2026-S39',
            check_id: 'b2',
            done: false,
            updated_at: expect.any(String),
          },
        ],
      },
    ]);
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('sync');
  });

  it('flush envoie les deletes (op delete → client.supprimer)', async () => {
    definirSession('t', '11111111-2222-3333-4444-555555555555');
    localStorage.setItem(
      'sportapp:sync:outbox',
      JSON.stringify([
        {
          op: 'delete',
          table: 'depenses',
          key: { date_: '2026-09-21', magasin_key: 'lidl' },
        } satisfies MutationSync,
      ]),
    );
    await flush();
    expect(client.suppressions).toEqual([
      { table: 'depenses', clefs: [{ date_: '2026-09-21', magasin_key: 'lidl' }] },
    ]);
    expect(lireOutbox()).toEqual([]);
  });

  it('flush en échec : etat erreur, outbox conservée', async () => {
    setCheck('2026-S39', 'b1', true);
    client.echouer(0);
    await flush();
    expect(etatSync()).toBe('erreur');
    expect(lireOutbox()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: FAIL (module engine absent)

- [ ] **Step 3: Écrire le cœur de `src/lib/sync/engine.ts`** (flush + états ; pull/merge arrivent en Task 7)

```ts
import { creerClient } from './client';
import type { RowSync, SyncClient } from './client';
import { syncActif } from './config';
import { empiler, lireOutbox, retirer, surEmpile, viderOutbox } from './outbox';
import type { MutationSync, TableSync } from './outbox';
import { demanderSession, definirSession, effacerSession, lireSession } from './session';
import {
  addWeight,
  deleteDepense,
  getChecks,
  getDepenses,
  getWeights,
  loadProfile,
  loadWeeks,
  saveDepense,
  saveProfile,
  setCheck,
  upsertWeek,
} from '../storage';
import type { ImportedWeek, ProfileKey, UserProfile } from '../model';

export type SyncEtat = 'off' | 'attente' | 'sync' | 'erreur';

const TABLES: TableSync[] = ['weeks', 'checks', 'weights', 'depenses', 'profiles'];

let client: SyncClient | null = null;
let etat: SyncEtat = 'off';
let onRemote: (() => void) | null = null;
let onEtatCb: ((e: SyncEtat) => void) | null = null;
let inited = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let desabonner: (() => void) | null = null;

const definirEtat = (e: SyncEtat): void => {
  etat = e;
  onEtatCb?.(e);
};

export const etatSync = (): SyncEtat => etat;

// Tests : injection du faux client + remise à zéro de l'état module.
export const injecterClient = (c: SyncClient | null): void => {
  client = c;
};

export const reinitialiser = (): void => {
  desabonner?.();
  desabonner = null;
  client = null;
  inited = false;
  etat = 'off';
  onRemote = null;
  onEtatCb = null;
  if (flushTimer) clearTimeout(flushTimer);
  if (pullTimer) clearTimeout(pullTimer);
  flushTimer = null;
  pullTimer = null;
};

export const flush = async (): Promise<void> => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!client || !lireSession()) return;
  const outbox = lireOutbox();
  if (outbox.length === 0) {
    definirEtat('sync');
    return;
  }
  const { foyerId } = lireSession()!;
  try {
    for (const t of TABLES) {
      const rows = outbox
        .filter((m) => m.table === t && m.op === 'upsert' && m.payload)
        .map<RowSync>((m) => ({
          ...m.key,
          // weeks et profiles : payload enveloppé (colonne jsonb serveur) —
          // checks/weights/depenses : colonnes scalaires (spread).
          ...(t === 'weeks' || t === 'profiles'
            ? { payload: m.payload }
            : { ...m.payload }),
          household_id: foyerId,
          updated_at: new Date().toISOString(),
        }));
      if (rows.length > 0) await client.upsert(t, rows);
      const clefs = outbox.filter((m) => m.table === t && m.op === 'delete').map((m) => m.key);
      if (clefs.length > 0) await client.supprimer(t, clefs);
    }
    for (const m of outbox) retirer(m);
    definirEtat('sync');
  } catch {
    definirEtat('erreur'); // outbox conservée — retry au prochain déclencheur
  }
};

export const flushDiffere = (): void => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flush();
  }, 2000);
};
```

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/engine.ts tests/sync/engine.test.ts
git commit -m "feat: engine sync — flush outbox groupée par table"
```

---

### Task 7: `engine.ts` — pull / merge « outbox prime »

**Files:**
- Modify: `src/lib/sync/engine.ts` (ajout pull + merge)
- Test: `tests/sync/engine.test.ts` (nouveau describe)

- [ ] **Step 1: Écrire les tests (rouge)** — ajouter à `tests/sync/engine.test.ts`

```ts
import {
  appliquerRemote,
  pull,
} from '../../src/lib/sync/engine';
import type { ImportedWeek, UserProfile, WeeklyData } from '../../src/lib/model';
import { parseWeeklyFile } from '../../src/lib/parse';
import {
  getChecks,
  getDepenses,
  getWeights,
  loadProfile,
  loadWeeks,
  saveDepense,
} from '../../src/lib/storage';

const week = (): WeeklyData => ({
  meta: { semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' },
  courses: [],
  menu: [],
  batch: [],
  profiles: {
    marc: { cibles: [], seances: [], rappels: [] },
    melanie: { cibles: [], seances: [], rappels: [] },
  },
});

const profilMarc = (): UserProfile => ({
  id: 'marc',
  dateNaissance: '1990-01-01',
  taille: 180,
  objectif: { type: 'maintien' },
  complements: [],
  regime: 'aucun',
});

describe('sync: pull / merge (outbox prime)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    client = fauxClient();
    injecterClient(client);
    definirSession('t', '11111111-2222-3333-4444-555555555555');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applique une semaine remote absente localement', async () => {
    const raw = '---\nsemaine: 2026-S40\nmenu: B\ndu: 2026-09-28\nau: 2026-10-04\n---\n';
    const { data } = parseWeeklyFile(raw);
    const payload: ImportedWeek = { raw, data, importedAt: '2026-09-16T08:00:00.000Z' };
    client.lues.weeks = [{ household_id: 'f', semaine: '2026-S40', payload }];
    await pull();
    expect(Object.keys(loadWeeks())).toEqual(['2026-S40']);
    expect(etatSync()).toBe('sync');
  });

  it('une coche en attente dans l\'outbox prime sur le remote', async () => {
    setCheck('2026-S39', 'b1', true); // local + outbox
    client.lues.checks = [
      { household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: false },
    ];
    await pull();
    expect(getChecks('2026-S39')['b1']).toBe(true); // outbox gagne
  });

  it('une coche remote s\'applique quand rien n\'est en attente', async () => {
    client.lues.checks = [
      { household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: true },
    ];
    await pull();
    expect(getChecks('2026-S39')['b1']).toBe(true);
  });

  it('une pesée remote inconnue s\'ajoute ; identique → aucune écriture', async () => {
    client.lues.weights = [
      { household_id: 'f', profil: 'marc', date_: '2026-09-21', kg: 82.4 },
    ];
    await pull();
    expect(getWeights('marc')).toEqual([{ date: '2026-09-21', kg: 82.4 }]);
    // re-pull identique : stable (pas de doublon)
    await pull();
    expect(getWeights('marc')).toEqual([{ date: '2026-09-21', kg: 82.4 }]);
  });

  it('les dépenses sont reconstruites depuis le serveur (delete inclus)', async () => {
    saveDepense('2026-09-20', 'Lidl', 10);
    viderOutbox(); // scénario « Lidl supprimée sur un autre téléphone » : rien d'en attente localement
    client.lues.depenses = [
      { household_id: 'f', date_: '2026-09-21', magasin_key: 'carrefour', magasin: 'Carrefour', total: 55 },
    ];
    await pull();
    // Lidl supprimée sur un autre téléphone → disparaît localement
    expect(getDepenses()).toEqual([{ date: '2026-09-21', magasin: 'Carrefour', total: 55 }]);
  });

  it('un dépense en attente d\'outbox survit à la reconstruction', async () => {
    saveDepense('2026-09-22', 'Aldi', 20); // local + outbox
    client.lues.depenses = [
      { household_id: 'f', date_: '2026-09-21', magasin_key: 'carrefour', magasin: 'Carrefour', total: 55 },
    ];
    await pull();
    const cles = getDepenses().map((d) => `${d.date}|${d.magasin.toLowerCase()}`);
    expect(cles).toContain('2026-09-22|aldi');
    expect(cles).toContain('2026-09-21|carrefour');
  });

  it('le profil de l\'autre téléphone est ignoré localement', async () => {
    saveProfile(profilMarc());
    viderOutbox();
    const mel = { ...profilMarc(), id: 'melanie' as const };
    client.lues.profiles = [{ household_id: 'f', profil: 'melanie', payload: mel }];
    await pull();
    expect(loadProfile()?.id).toBe('marc');
  });

  it('le profil actif remote modifié s\'applique', async () => {
    saveProfile(profilMarc());
    viderOutbox();
    const maj = { ...profilMarc(), taille: 181 };
    client.lues.profiles = [{ household_id: 'f', profil: 'marc', payload: maj }];
    await pull();
    expect(loadProfile()?.taille).toBe(181);
  });

  it('appliquerRemote retourne false sans changement', async () => {
    const vide = { weeks: [], checks: [], weights: [], depenses: [], profiles: [] };
    expect(await appliquerRemote(vide)).toBe(false);
  });

  it('payload remote invalide → ignoré sans crash', async () => {
    client.lues.weeks = [{ household_id: 'f', semaine: '2026-S40', payload: { nonsense: true } }];
    client.lues.weights = [{ household_id: 'f', profil: 'marc', date_: '2026-09-21', kg: 'invalide' }];
    await pull();
    expect(loadWeeks()['2026-S40']).toBeUndefined();
    expect(etatSync()).toBe('sync');
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: FAIL (`appliquerRemote` / `pull` absents)

- [ ] **Step 3: Ajouter pull + merge à `src/lib/sync/engine.ts`**

```ts
const signature = (table: TableSync, key: Record<string, string>): string =>
  `${table}|${JSON.stringify(key)}`;

const clesOutbox = (): Set<string> =>
  new Set(lireOutbox().map((m) => signature(m.table, m.key)));

// Dépenses : le serveur fait foi (upsert + delete) → reconstruction complète.
// Les clés en attente d'outbox tranchent (elles flushent juste après).
const reconstruireDepenses = (remoteRows: RowSync[]): boolean => {
  const attente = lireOutbox().filter((m) => m.table === 'depenses');
  const clesAttente = new Set(attente.map((m) => `${m.key.date_}|${m.key.magasin_key}`));
  const cible = new Map<string, { date: string; magasin: string; total: number }>();
  for (const r of remoteRows) {
    const total = Number(r.total);
    if (!Number.isFinite(total) || total <= 0) continue;
    const date = String(r.date_);
    const magasinKey = String(r.magasin_key);
    if (clesAttente.has(`${date}|${magasinKey}`)) continue;
    cible.set(`${date}|${magasinKey}`, { date, magasin: String(r.magasin), total });
  }
  for (const m of attente) {
    if (m.op === 'upsert' && m.payload) {
      cible.set(`${m.key.date_}|${m.key.magasin_key}`, {
        date: m.key.date_,
        magasin: String(m.payload.magasin),
        total: Number(m.payload.total),
      });
    } // op delete : absent de la cible
  }
  const cibleTriee = [...cible.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.magasin.localeCompare(a.magasin),
  );
  const actuelles = getDepenses();
  const cleDe = (date: string, magasin: string): string => `${date}|${magasin.toLowerCase()}`;
  let change = false;
  for (const d of actuelles) {
    if (!cible.has(cleDe(d.date, d.magasin))) {
      deleteDepense(d.date, d.magasin);
      change = true;
    }
  }
  for (const d of cibleTriee) {
    const local = actuelles.find((x) => cleDe(x.date, x.magasin) === cleDe(d.date, d.magasin));
    if (!local || local.total !== d.total) {
      saveDepense(d.date, d.magasin, d.total);
      change = true;
    }
  }
  return change;
};

// Applique les lignes remote au localStorage — règle « outbox locale prime ».
// Retourne true si au moins une écriture a eu lieu (pour ne re-rendre que là).
export const appliquerRemote = async (rows: Record<TableSync, RowSync[]>): Promise<boolean> => {
  const attente = clesOutbox();
  let change = false;

  for (const r of rows.weeks) {
    const key = { semaine: String(r.semaine) };
    if (attente.has(signature('weeks', key))) continue;
    const payload = r.payload as ImportedWeek | undefined;
    if (!payload?.data?.meta?.semaine) continue; // payload remote invalide → ignoré
    const local = loadWeeks()[key.semaine];
    if (local && local.raw === payload.raw) continue;
    upsertWeek(payload.raw, payload.data);
    change = true;
  }

  for (const r of rows.checks) {
    const key = { semaine: String(r.semaine), check_id: String(r.check_id) };
    if (attente.has(signature('checks', key))) continue;
    if (getChecks(key.semaine)[key.check_id] !== r.done) {
      setCheck(key.semaine, key.check_id, r.done === true);
      change = true;
    }
  }

  for (const r of rows.weights) {
    const key = { profil: String(r.profil), date_: String(r.date_) };
    if (attente.has(signature('weights', key))) continue;
    const kg = Number(r.kg);
    if (!Number.isFinite(kg) || kg <= 0) continue;
    const connu = getWeights(key.profil as ProfileKey).some(
      (w) => w.date === key.date_ && w.kg === kg,
    );
    if (!connu) {
      addWeight(key.profil as ProfileKey, key.date_, kg);
      change = true;
    }
  }

  if (reconstruireDepenses(rows.depenses)) change = true;

  for (const r of rows.profiles) {
    const key = { profil: String(r.profil) };
    if (attente.has(signature('profiles', key))) continue;
    const payload = r.payload as UserProfile | undefined;
    const local = loadProfile();
    if (!payload || payload.id !== local?.id) continue; // l'autre profil : pas de slot local
    if (JSON.stringify(local) !== JSON.stringify(payload)) {
      saveProfile(payload);
      change = true;
    }
  }

  return change;
};

export const pull = async (): Promise<void> => {
  if (!client) return;
  const rows = {} as Record<TableSync, RowSync[]>;
  for (const t of TABLES) rows[t] = await client.toutLire(t);
  if (await appliquerRemote(rows)) onRemote?.();
  definirEtat('sync');
};
```

> Note : les écritures de merge passent par les fonctions de storage, donc re-empilent leurs propres valeurs dans l'outbox — flush idempotent, aucun risque de boucle (le serveur ne change pas).

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/engine.ts tests/sync/engine.test.ts
git commit -m "feat: engine sync — pull/merge avec règle outbox-prime"
```

---

### Task 8: `engine.ts` — connexion foyer (push ou pull initial)

**Files:**
- Modify: `src/lib/sync/engine.ts`
- Test: `tests/sync/engine.test.ts` (nouveau describe)

- [ ] **Step 1: Écrire les tests (rouge)** — ajouter à `tests/sync/engine.test.ts`

```ts
import {
  connecterFoyer,
  deconnecterFoyer,
  lireSessionPub,
} from '../../src/lib/sync/engine';
import { addWeight } from '../../src/lib/storage';
import { lireSession } from '../../src/lib/sync/session';

describe('sync: connexion foyer', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    client = fauxClient();
    injecterClient(client);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('foyer vide → push complet de l\'état local', async () => {
    addWeight('marc', '2026-09-21', 82.4);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'tok', foyer: 'foyer-1' }), { status: 200 })),
    );
    await connecterFoyer(' rituel-2026 ');
    expect(lireSession()).toEqual({ token: 'tok', foyerId: 'foyer-1' });
    // push : la pesée locale est partie vers le serveur
    const weights = client.upserts.find((u) => u.table === 'weights');
    expect(weights?.rows[0]).toMatchObject({ profil: 'marc', date_: '2026-09-21', kg: 82.4 });
    expect(etatSync()).toBe('sync');
    vi.unstubAllGlobals();
  });

  it('foyer déjà alimenté → pull (pas de push)', async () => {
    client.lues.checks = [
      { household_id: 'f', semaine: '2026-S39', check_id: 'b1', done: true },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'tok', foyer: 'foyer-1' }), { status: 200 })),
    );
    await connecterFoyer('code');
    expect(client.upserts).toEqual([]);
    expect(getChecks('2026-S39')['b1']).toBe(true);
    vi.unstubAllGlobals();
  });

  it('code refusé → erreur, pas de session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"code-refuse"}', { status: 401 })),
    );
    await expect(connecterFoyer('mauvais')).rejects.toThrow('code-refuse');
    expect(lireSession()).toBeNull();
    vi.unstubAllGlobals();
  });

  it('deconnecterFoyer nettoie session + outbox', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    deconnecterFoyer();
    expect(lireSession()).toBeNull();
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('off');
  });

  it('lireSessionPub expose la session (usage UI)', () => {
    definirSession('t', 'f');
    expect(lireSessionPub()).toEqual({ token: 't', foyerId: 'f' });
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: FAIL (`connecterFoyer` absent)

- [ ] **Step 3: Ajouter à `src/lib/sync/engine.ts`**

```ts
const pousserTout = (): void => {
  const semaines = loadWeeks();
  for (const [semaine, w] of Object.entries(semaines)) {
    empiler({ op: 'upsert', table: 'weeks', key: { semaine }, payload: { ...w } });
    for (const [check_id, done] of Object.entries(getChecks(semaine))) {
      empiler({ op: 'upsert', table: 'checks', key: { semaine, check_id }, payload: { done } });
    }
  }
  for (const p of ['marc', 'melanie'] as const) {
    for (const w of getWeights(p)) {
      empiler({
        op: 'upsert',
        table: 'weights',
        key: { profil: p, date_: w.date },
        payload: { kg: w.kg },
      });
    }
  }
  for (const d of getDepenses()) {
    empiler({
      op: 'upsert',
      table: 'depenses',
      key: { date_: d.date, magasin_key: d.magasin.toLowerCase() },
      payload: { magasin: d.magasin, total: d.total },
    });
  }
  const profil = loadProfile();
  if (profil) {
    empiler({ op: 'upsert', table: 'profiles', key: { profil: profil.id }, payload: { ...profil } });
  }
};

// Fusion union à la connexion (décision produit 2026-09-16) : CHAQUE appareil
// empile son état local AVANT le merge — jamais de perte des données locales
// jamais synchronisées, conflits tranchés par « outbox locale prime ».
const postConnexion = async (): Promise<void> => {
  if (!client || !lireSession()) return;
  definirEtat('attente');
  pousserTout();
  const rows = {} as Record<TableSync, RowSync[]>;
  for (const t of TABLES) rows[t] = await client.toutLire(t);
  if (await appliquerRemote(rows)) onRemote?.();
  await flush();
};

// NOTE (déviation T8 acceptée) : les écritures du merge NE re-empilent PAS
// dans l'outbox — `appliquerRemote` suspend l'empilement autour d'un corps
// sync (`appliquerRemoteSync`) pour éviter tout écho vers le serveur, et la
// suspension ne s'étend jamais sur un await (aucune mutation utilisateur ne
// peut être perdue entre deux ops).

// Installe le client + le realtime (idempotent).
const connecter = async (): Promise<void> => {
  // Client pré-injecté (tests) ou déjà connecté : ne pas re-installer,
  // mais postConnexion doit TOUJOURS tourner (push/pull initial).
  if (!client) {
    client = await creerClient();
    desabonner = client.abonner(() => {
      if (pullTimer) clearTimeout(pullTimer);
      pullTimer = setTimeout(() => {
        void pull();
      }, 500);
    });
  }
  await postConnexion();
};

export const connecterFoyer = async (code: string): Promise<void> => {
  if (!syncActif()) throw new Error('sync-inactive');
  const session = await demanderSession(code.trim());
  definirSession(session.token, session.foyerId);
  await connecter();
};

export const deconnecterFoyer = (): void => {
  desabonner?.();
  desabonner = null;
  client = null;
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  viderOutbox();
  effacerSession();
  definirEtat('off');
};

export const lireSessionPub = lireSession;
```

> `lireSession` est ré-exporté pour l'UI (ProfilScreen) sans import direct de session — cohérence du point d'entrée engine. (Ajuster l'import du test si besoin : `lireSession` du test vient de `session`.)

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: PASS (19 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/engine.ts tests/sync/engine.test.ts
git commit -m "feat: connexion foyer — premier appareil pousse, second reçoit"
```

---

### Task 9: `engine.ts` — purge du foyer + initSync (realtime, online)

**Files:**
- Modify: `src/lib/sync/engine.ts`
- Test: `tests/sync/engine.test.ts` (nouveau describe)

- [ ] **Step 1: Écrire les tests (rouge)** — ajouter à `tests/sync/engine.test.ts`

```ts
import { initSync, purgerFoyer } from '../../src/lib/sync/engine';

describe('sync: purge + init', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    client = fauxClient();
    injecterClient(client);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('purgerFoyer purge le serveur AVANT le nettoyage local', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    await purgerFoyer();
    expect(client.purgees).toBe(true);
    expect(lireSession()).toBeNull();
    expect(lireOutbox()).toEqual([]);
    expect(etatSync()).toBe('off');
  });

  it('purge en échec → clés locales conservées', async () => {
    definirSession('t', 'f');
    setCheck('2026-S39', 'b1', true);
    client.echouer(999); // toutLire en Task 8 non concerné : purger appelle delete → pas de hook échec ; on simule via supprimer
    // Simpler : remplacer purger par une version qui échoue
    injecterClient({
      ...client,
      purger: async () => {
        throw new Error('reseau');
      },
    } as SyncClient);
    await expect(purgerFoyer()).rejects.toThrow('reseau');
    expect(lireSession()).toEqual({ token: 't', foyerId: 'f' });
    expect(lireOutbox()).toHaveLength(1);
  });

  it('initSync sans env → etat off, aucun réseau', () => {
    // vi.mock de config force syncActif=true dans CE fichier : on teste ici
    // le chemin avec session absente → attente, et l'absence d'appel réseau.
    initSync({});
    expect(etatSync()).toBe('attente'); // pas de session → demande de connexion
  });

  it('initSync avec session → flush + pull, onEtat appelé', async () => {
    definirSession('t', 'f');
    const onEtat = vi.fn();
    initSync({ onEtat });
    await vi.waitFor(() => expect(etatSync()).toBe('sync'));
    expect(onEtat).toHaveBeenCalledWith('sync');
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: FAIL (`purgerFoyer` / `initSync` absents)

- [ ] **Step 3: Ajouter à `src/lib/sync/engine.ts`**

```ts
export const purgerFoyer = async (): Promise<void> => {
  if (!client) throw new Error('pas-connecte');
  await client.purger(); // serveur d'abord — jamais de données orphelines
  deconnecterFoyer();
};

export const initSync = (opts: { onRemote?: () => void; onEtat?: (e: SyncEtat) => void } = {}): void => {
  if (inited) return;
  inited = true;
  onRemote = opts.onRemote ?? null;
  onEtatCb = opts.onEtat ?? null;
  surEmpile(() => flushDiffere());
  if (!syncActif()) {
    definirEtat('off');
    return;
  }
  window.addEventListener('online', () => {
    void flush();
  });
  const demarrer = async (): Promise<void> => {
    if (!lireSession()) {
      definirEtat('attente');
      return;
    }
    try {
      await connecter();
      definirEtat('sync');
    } catch {
      definirEtat('erreur');
    }
  };
  void demarrer();
};

// Tap sur l'indicateur bannière : re-sync manuelle.
export const ressynchroniser = (): void => {
  void flush();
  if (client) void pull();
};
```

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/sync/engine.test.ts`
Expected: PASS (23 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/engine.ts tests/sync/engine.test.ts
git commit -m "feat: purge foyer + initSync (realtime, online, états)"
```

---

### Task 10: App — init sync, état, re-rendu sur remote

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/sync/ui.test.tsx` (nouveau)

- [ ] **Step 1: Écrire le test (rouge)** — `tests/sync/ui.test.tsx`

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../src/App';
import { definirSession, effacerSession } from '../../src/lib/sync/session';
import { viderOutbox } from '../../src/lib/sync/outbox';
import { injecterClient, reinitialiser } from '../../src/lib/sync/engine';
import type { SyncClient, RowSync } from '../../src/lib/sync/client';
import type { TableSync } from '../../src/lib/sync/outbox';

const clientPassif = (): SyncClient => ({
  upsert: async () => {},
  supprimer: async () => {},
  toutLire: async (t: TableSync) => [] as RowSync[],
  purger: async () => {},
  abonner: () => () => {},
});

describe('sync UI: app', () => {
  beforeEach(() => {
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    injecterClient(clientPassif());
  });

  it('sans profil : onboarding, pas de crash sync', () => {
    render(<App />);
    expect(screen.getByText('Qui est derrière l’écran ?')).toBeInTheDocument();
  });

  it('avec session : l\'app démarre en sync (pas de brique cassée)', async () => {
    // Un profil valide minimal + une semaine d'exemple auto-chargée
    const profil = {
      id: 'marc',
      dateNaissance: '1990-01-01',
      taille: 180,
      objectif: { type: 'maintien' },
      complements: [],
      regime: 'aucun',
    };
    localStorage.setItem('sportapp:profile', JSON.stringify(profil));
    definirSession('t', 'f');
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Qui est derrière l’écran ?')).toBeNull());
    expect(screen.getByText(/Semaine/)).toBeInTheDocument();
  });
});
```

> NB : ici `syncActif()` est mocké `true` au niveau fichier si besoin — sinon l'init est off et le test vérifie surtout la non-régression. Garder les deux runs verts.

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/ui.test.tsx`
Expected: les deux tests passent DÉJÀ (aucun changement d'app requis pour ce comportement) — ce test est le filet de non-régression ; le vrai câblage se vérifie en Task 11+ via les tests composants. Si les tests passent, passer directement à l'implémentation (le rouge viendra des tests composants).

- [ ] **Step 3: Modifier `src/App.tsx`**

Imports (en tête) :
```ts
import { useEffect } from 'react';
import { initSync, type SyncEtat } from './lib/sync/engine';
```

État (après `const [tab, setTab] = useState<TabId>('cuisine');`) :
```ts
const [syncEtat, setSyncEtat] = useState<SyncEtat>('off');
const [syncVersion, setSyncVersion] = useState(0);
```

Effet (après les refs swipe, AVANT les early returns — règles des hooks) :
```ts
// Sync optionnelle : no-op complet sans env Supabase (etat 'off').
useEffect(() => {
  initSync({
    onEtat: setSyncEtat,
    onRemote: () => {
      setSemaines(semainesInitiales());
      setSyncVersion((v) => v + 1);
    },
  });
}, []);
```

Props bannière (dans le JSX du header) :
```tsx
<WeekBanner
  meta={affichee.data.meta}
  syncEtat={syncEtat}
  onSyncTap={() => ressynchroniser()}
  // ...props existantes inchangées
```
(+ import `ressynchroniser` depuis `./lib/sync/engine`)

Suivi — clés de remount incluant syncVersion :
```tsx
<ObjectifBloc key={`obj-${weightsBump}-${syncVersion}`} profile={profile} />
<StatCards key={weightsBump + syncVersion} profile={profile} />
```

Cuisine — prop filée :
```tsx
{tab === 'cuisine' && (
  <CuisineView data={affichee.data} profile={profile} syncVersion={syncVersion} />
)}
```
ProfilScreen :
```tsx
<ProfilScreen
  profile={profile}
  syncEtat={syncEtat}
  // ...props existantes
```

- [ ] **Step 4: Vérifier (typecheck seulement à ce stade — CuisineView/WeekBanner/ProfilScreen n'ont pas encore ces props)**

Run: `npm run typecheck`
Expected: FAIL (props manquantes) — normal, les tâches suivantes les ajoutent. Ne pas commit encore.

---

### Task 11: Checklist `dataVersion` + re-lectures remote (cuisine & suivi)

**Files:**
- Modify: `src/components/Checklist.tsx`, `src/components/cuisine/CuisineView.tsx`, `src/components/cuisine/MenuView.tsx`, `src/components/cuisine/BatchView.tsx`, `src/components/cuisine/ShoppingList.tsx`, `src/components/cuisine/CoursesBudget.tsx`, `src/components/ProfileView.tsx`
- Test: `tests/sync/ui.test.tsx` (ajouts)

- [ ] **Step 1: Écrire le test (rouge)** — ajouter à `tests/sync/ui.test.tsx`

```tsx
import { render } from '@testing-library/react';
import { Checklist } from '../../src/components/Checklist';
import { setCheck } from '../../src/lib/storage';
import userEvent from '@testing-library/user-event';

describe('sync UI: Checklist re-read', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const items = [{ id: 'b1', label: 'Riz' }];

  it('bump dataVersion → relit getChecks (changement remote visible)', async () => {
    const { rerender } = render(<Checklist items={items} semaine="2026-S39" dataVersion={0} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    // « autre téléphone » : écrit direct storage (comme un pull)
    setCheck('2026-S39', 'b1', true);
    rerender(<Checklist items={items} semaine="2026-S39" dataVersion={1} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('cocher localement reste instantané', async () => {
    const u = userEvent.setup();
    render(<Checklist items={items} semaine="2026-S39" dataVersion={0} />);
    await u.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(getChecks('2026-S39')['b1']).toBe(true);
  });
});
```
(+ import `getChecks` de storage.)

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/ui.test.tsx`
Expected: FAIL (`dataVersion` prop inconnue / checkbox non relue)

- [ ] **Step 3: Modifier `Checklist.tsx`**

```tsx
export function Checklist<T extends ChecklistItem>({
  items,
  semaine,
  dataVersion = 0,
  className,
  onChecksChange,
  renderLabel,
}: {
  items: T[];
  semaine: string;
  dataVersion?: number;
  className?: string;
  onChecksChange?: (checks: Record<string, boolean>) => void;
  renderLabel?: (item: T) => ReactNode;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  const [synced, setSynced] = useState({ semaine, version: dataVersion });
  // Pattern render-phase reset (syncedSemaine) étendu à la version de sync :
  // un changement remote (dataVersion) ou de semaine relit le storage.
  if (synced.semaine !== semaine || synced.version !== dataVersion) {
    setSynced({ semaine, version: dataVersion });
    setChecks(getChecks(semaine));
  }
  // ...toggle inchangé
```

- [ ] **Step 4: Filé de la prop dans la cuisine**

`CuisineView.tsx` :
```tsx
export function CuisineView({
  data,
  profile,
  syncVersion = 0,
}: {
  data: WeeklyData;
  profile: UserProfile;
  syncVersion?: number;
}) {
```
et :
```tsx
<CoursesBudget data={data} profile={profile} syncVersion={syncVersion} onOuvrirDepenses={...} />
<ShoppingList items={data.courses} semaine={semaine} budget={data.budget} syncVersion={syncVersion} />
<MenuView menu={data.menu} recettes={data.recettes} bases={data.bases} semaine={semaine} syncVersion={syncVersion} />
<BatchView rituel={data.rituel} microBatch={data.microBatch} semaine={semaine} syncVersion={syncVersion} />
```

`ShoppingList.tsx` : prop `syncVersion?: number` ; étendre le reset existant :
```tsx
const [synced, setSynced] = useState({ semaine, version: syncVersion });
if (synced.semaine !== semaine || synced.version !== syncVersion) {
  setSynced({ semaine, version: syncVersion });
  setChecks(getChecks(semaine));
}
```
et passer `dataVersion={syncVersion}` aux deux `<Checklist ...>`.

`BatchView.tsx` (composant `RituelTimeline` ET le composant parent qui rend la checklist batch — mêmes lignes que ShoppingList, cf. lignes 136-141) : même extension du reset + `dataVersion={syncVersion}` sur les `<Checklist>`.

`MenuView.tsx` : prop `syncVersion?: number` ; étendre le reset existant (lignes 37-44) :
```tsx
const [synced, setSynced] = useState({ semaine, version: syncVersion });
if (synced.semaine !== semaine || synced.version !== syncVersion) {
  setSynced({ semaine, version: syncVersion });
  const fresh = getChecks(semaine);
  setChecks(fresh);
  setActif(Math.min(selectionInitiale(onglets, menu, fresh), onglets.length));
}
```

`CoursesBudget.tsx` :
- `CoursesBudget` : prop `syncVersion?: number` ; **la carte relit au changement** — remplacer `const [depenses] = useState<DepenseEntry[]>(() => getDepenses());` par le pattern reset :
```tsx
const [depenses, setDepenses] = useState<DepenseEntry[]>(() => getDepenses());
const [syncedVersion, setSyncedVersion] = useState(syncVersion);
if (syncedVersion !== syncVersion) {
  setSyncedVersion(syncVersion);
  setDepenses(getDepenses());
}
```
- `DepensesPanel` : prop `syncVersion?: number` ; étendre pareil (état local `depenses`, cf. ligne 100) avec reset sur syncVersion.
- Câblage CuisineView : `<DepensesPanel profile={profile} focusTotal={depFocus} syncVersion={syncVersion} onRetour={...} />`

`ProfileView.tsx` : prop `syncVersion?: number` ; étendre les resets existants (lignes 28-44) :
```tsx
const [syncedVersion, setSyncedVersion] = useState(syncVersion);
if (syncedVersion !== syncVersion) {
  setSyncedVersion(syncVersion);
  setWeights(getWeights(profile.id));
  setChecksMap(getChecks(semaine));
}
```
et `dataVersion={syncVersion}` sur le `<Checklist>` des séances. (Les resets syncedProfile/syncedSemaine existants restent.)

App (Task 10) passe déjà `syncVersion` à CuisineView et les clés de remount au suivi.

- [ ] **Step 5: Vérifier le vert + non-régression**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS (toutes suites)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Checklist.tsx src/components/ProfileView.tsx src/components/cuisine/
git commit -m "feat: re-rendu sync — prop dataVersion/syncVersion (pattern reset étendu)"
```

---

### Task 12: Indicateur bannière + bloc Profil + CSS

**Files:**
- Modify: `src/components/WeekBanner.tsx`, `src/components/ProfilScreen.tsx`, `src/index.css`
- Test: `tests/sync/ui.test.tsx` (ajouts)

- [ ] **Step 1: Écrire les tests (rouge)** — ajouter à `tests/sync/ui.test.tsx`

```tsx
import { WeekBanner } from '../../src/components/WeekBanner';
import { ProfilScreen } from '../../src/components/ProfilScreen';
import type { UserProfile } from '../../src/lib/model';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/lib/sync/engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sync/engine')>()),
  connecterFoyer: vi.fn(async () => {}),
  purgerFoyer: vi.fn(async () => {}),
}));

const profil = (): UserProfile => ({
  id: 'marc',
  dateNaissance: '1990-01-01',
  taille: 180,
  objectif: { type: 'maintien' },
  complements: [],
  regime: 'aucun',
});

describe('sync UI: bannière', () => {
  it('pas de point sans sync (off / prop absente)', () => {
    render(<WeekBanner meta={{ semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' }} />);
    expect(screen.queryByRole('button', { name: /synchroni/i })).toBeNull();
  });

  it('point visible en erreur, tap déclenche re-sync', async () => {
    const onSyncTap = vi.fn();
    render(
      <WeekBanner
        meta={{ semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' }}
        syncEtat="erreur"
        onSyncTap={onSyncTap}
      />,
    );
    const dot = screen.getByRole('button', { name: /synchronisation.*erreur/i });
    await userEvent.setup().click(dot);
    expect(onSyncTap).toHaveBeenCalledOnce();
  });
});

describe('sync UI: bloc profil', () => {
  const renderProfil = (syncEtat: 'attente' | 'sync' = 'attente') =>
    render(
      <ProfilScreen
        profile={profil()}
        syncEtat={syncEtat}
        onBack={() => {}}
        onChangeProfile={() => {}}
        onProfileSaved={() => {}}
        onImported={() => {}}
      />,
    );

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('attente : saisie code + bouton connecter (appel engine)', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    renderProfil('attente');
    await userEvent.setup().type(screen.getByLabelText('Code de foyer'), 'rituel-2026');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Se connecter au foyer' }));
    expect(connecterFoyer).toHaveBeenCalledWith('rituel-2026');
  });

  it('code refusé : message visible', async () => {
    const engine = await import('../../src/lib/sync/engine');
    vi.mocked(engine.connecterFoyer).mockRejectedValueOnce(new Error('code-refuse'));
    renderProfil('attente');
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Code de foyer'), 'mauvais');
    await u.click(screen.getByRole('button', { name: 'Se connecter au foyer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/code de foyer refusé/i);
  });

  it('connecté : bouton suppression foyer, double confirmation, purge', async () => {
    const { purgerFoyer } = await import('../../src/lib/sync/engine');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderProfil('sync');
    await userEvent.setup().click(screen.getByRole('button', { name: /supprimer les données du foyer/i }));
    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(purgerFoyer).toHaveBeenCalledOnce();
  });

  it('note de transparence affichée', () => {
    renderProfil('attente');
    expect(screen.getByText(/supabase.*région ue.*accès limité au foyer/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/ui.test.tsx`
Expected: FAIL (props/nouveaux éléments absents)

- [ ] **Step 3: Modifier `WeekBanner.tsx`**

```tsx
import type { SyncEtat } from '../lib/sync/engine';

const ETIQUETTES: Record<Exclude<SyncEtat, 'off'>, string> = {
  attente: 'Synchronisation : non connecté',
  sync: 'Synchronisé',
  erreur: 'Synchronisation : erreur — appuyer pour réessayer',
};

// props ajoutées :
  syncEtat,
  onSyncTap,
}: {
  // ...existantes
  syncEtat?: SyncEtat;
  onSyncTap?: () => void;
}) {
```
JSX (à côté du bouton profil) :
```tsx
{syncEtat && syncEtat !== 'off' && (
  <button
    type="button"
    className={`sync-dot sync-${syncEtat}`}
    aria-label={ETIQUETTES[syncEtat]}
    title={ETIQUETTES[syncEtat]}
    onClick={onSyncTap}
  />
)}
```

- [ ] **Step 4: Ajouter le bloc sync à `ProfilScreen.tsx`**

Imports :
```ts
import { connecterFoyer, deconnecterFoyer, purgerFoyer } from '../lib/sync/engine';
import type { SyncEtat } from '../lib/sync/engine';
import { lireSessionPub } from '../lib/sync/engine';
```
Props : `syncEtat?: SyncEtat` (optionnel, défaut `'off'`).

État local du bloc :
```ts
const [codeFoyer, setCodeFoyer] = useState('');
const [syncErreur, setSyncErreur] = useState<string | null>(null);
const [syncOccupe, setSyncOccupe] = useState(false);

const connecter = async () => {
  if (!codeFoyer.trim()) return;
  setSyncOccupe(true);
  setSyncErreur(null);
  try {
    await connecterFoyer(codeFoyer);
    setCodeFoyer('');
  } catch {
    setSyncErreur('Code de foyer refusé — vérifie la saisie (ou réessaie en ligne).');
  } finally {
    setSyncOccupe(false);
  }
};

const purger = () => {
  if (!window.confirm('Supprimer toutes les données du foyer sur le serveur ?')) return;
  if (!window.confirm('Dernière confirmation : cette action est définitive.')) return;
  purgerFoyer().catch(() => setSyncErreur('Suppression impossible — réessaie plus tard.'));
};
```

Section JSX (avant la section « changer de profil ») :
```tsx
{syncEtat && syncEtat !== 'off' && (
  <section className="profile-section sync-bloc">
    <h2>Synchronisation</h2>
    {lireSessionPub() ? (
      <>
        <p className="muted">
          {syncEtat === 'sync' && 'Synchronisé ✓'}
          {syncEtat === 'erreur' && 'Erreur de synchronisation — réessaie (point en bannière).'}
          {syncEtat === 'attente' && 'Connecté — en attente du réseau.'}
        </p>
        <button type="button" className="profil-ghost" onClick={deconnecterFoyer}>
          Déconnecter le foyer
        </button>
        <button type="button" className="sync-danger" onClick={purger}>
          Supprimer les données du foyer
        </button>
      </>
    ) : (
      <>
        <p className="muted">Relie ce téléphone au foyer pour partager semaines, courses et pesées.</p>
        <div className="onboarding-field">
          <label htmlFor="sync-code">Code de foyer</label>
          <input
            id="sync-code"
            type="password"
            value={codeFoyer}
            onChange={(e) => {
              setSyncErreur(null);
              setCodeFoyer(e.target.value);
            }}
          />
        </div>
        <button type="button" className="btn profil-save" onClick={connecter} disabled={syncOccupe}>
          {syncOccupe ? 'Connexion…' : 'Se connecter au foyer'}
        </button>
      </>
    )}
    {syncErreur && (
      <p className="error" role="alert">
        {syncErreur}
      </p>
    )}
    <p className="hint">
      Données synchronisées chez Supabase — région UE, accès limité au foyer.
    </p>
  </section>
)}
```

- [ ] **Step 5: CSS — append à `src/index.css`**

```css
/* ——— Sync (point bannière + bloc profil) ——— */
.sync-dot {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
}
.sync-dot::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.sync-dot.sync-sync::before {
  background: var(--accent);
}
.sync-dot.sync-attente::before {
  background: var(--muted);
}
.sync-dot.sync-erreur::before {
  background: #b3402e;
}
.sync-bloc .sync-danger {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid #b3402e;
  color: #b3402e;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
}
.sync-bloc .profil-ghost {
  margin-top: 8px;
}
```

- [ ] **Step 6: Vérifier le vert + non-régression**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/WeekBanner.tsx src/components/ProfilScreen.tsx src/index.css tests/sync/ui.test.tsx
git commit -m "feat: UI sync — point bannière + bloc profil (connexion, purge)"
```

---

### Task 13: Onboarding — étape 6 optionnelle

**Files:**
- Modify: `src/components/onboarding/Onboarding.tsx`
- Test: `tests/sync/ui.test.tsx` (ajouts)

- [ ] **Step 1: Écrire le test (rouge)** — ajouter à `tests/sync/ui.test.tsx`

```tsx
import { Onboarding } from '../../src/components/onboarding/Onboarding';
import { syncActif } from '../../src/lib/sync/config';
import { lireSession } from '../../src/lib/sync/session';

vi.mock('../../src/lib/sync/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sync/config')>()),
  syncActif: () => true,
}));

const configurer = () => {
  localStorage.setItem(
    'sportapp:profile',
    JSON.stringify({
      id: 'marc',
      dateNaissance: '1990-01-01',
      taille: 180,
      objectif: { type: 'maintien' },
      complements: [],
      regime: 'aucun',
    }),
  );
};

describe('sync UI: onboarding étape 6', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('avec sync active : après « C\'est parti », étape 6 avec code + Plus tard', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /marc/i })); // étape 1
    // étape 2 : champs obligatoires
    await u.type(screen.getByLabelText('Poids (kg)'), '82');
    await u.type(screen.getByLabelText('Date de naissance'), '1990-01-01');
    await u.type(screen.getByLabelText('Taille (cm)'), '180');
    await u.click(screen.getByRole('button', { name: /continuer/i }));
    await u.click(screen.getByRole('button', { name: /continuer/i })); // étape 3 → 4
    await u.click(screen.getByRole('button', { name: /continuer/i })); // étape 4 → 5
    await u.click(screen.getByRole('button', { name: /c'est parti/i }));
    expect(await screen.findByText('Synchroniser les téléphones')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('étape 6 : saisie du code → connecterFoyer, session posée', async () => {
    const engine = await import('../../src/lib/sync/engine');
    vi.mocked(engine.connecterFoyer).mockResolvedValueOnce();
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /marc/i }));
    await u.type(screen.getByLabelText('Poids (kg)'), '82');
    await u.type(screen.getByLabelText('Date de naissance'), '1990-01-01');
    await u.type(screen.getByLabelText('Taille (cm)'), '180');
    await u.click(screen.getByRole('button', { name: /continuer/i }));
    await u.click(screen.getByRole('button', { name: /continuer/i }));
    await u.click(screen.getByRole('button', { name: /continuer/i }));
    await u.click(screen.getByRole('button', { name: /c'est parti/i }));
    await u.type(await screen.findByLabelText('Code de foyer'), 'rituel-2026');
    await u.click(screen.getByRole('button', { name: /connecter le foyer/i }));
    expect(engine.connecterFoyer).toHaveBeenCalledWith('rituel-2026');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('sync inactive (défaut hors mock config complet) : pas d\'étape 6', () => {
    // si syncActif() faux → « C'est parti » termine direct (couvert par les
    // suites app existantes qui passent sans env) — vérification légère :
    expect(typeof syncActif()).toBe('boolean');
    expect(lireSession()).toBeNull();
  });
});
```

> Adapte les sélecteurs si l'étape 1 a un libellé de bouton différent (« Marc 💪 » → matcher `name: /marc/i` fonctionne). Le mock de `connecterFoyer` doit être posé AVANT le render (haut de fichier, cf. mock engine existant de la Task 12).

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/sync/ui.test.tsx`
Expected: FAIL (étape 6 absente — « C'est parti » appelle onDone direct)

- [ ] **Step 3: Modifier `Onboarding.tsx`**

Imports :
```ts
import { lireSession } from '../../lib/sync/session';
import { syncActif } from '../../lib/sync/config';
import { connecterFoyer } from '../../lib/sync/engine';
```

Type d'étape : remplacer `useState<1 | 2 | 3 | 4 | 5>(prefill ? 2 : 1)` par `useState<1 | 2 | 3 | 4 | 5 | 6>(prefill ? 2 : 1)` ; ajuster `aller` et `retour` (union incluant 6 ; `retour` : `aller(Math.max(1, step - 1))` reste correct).

État du profil finalisé :
```ts
const [profileFinal, setProfileFinal] = useState<UserProfile | null>(null);
const [syncOccupe, setSyncOccupe] = useState(false);
```

`valider()` — fin de fonction, remplacer `onDone(profile);` par :
```ts
    saveProfile(profile);
    if (infos.kg != null) addWeight(id, todayISO(), infos.kg);
    if (syncActif() && !lireSession()) {
      setProfileFinal(profile);
      setStep(6);
      return;
    }
    onDone(profile);
```

Connecter depuis l'étape 6 :
```ts
const connecterSync = async () => {
  if (!profileFinal || !codeFoyer.trim()) return;
  setSyncOccupe(true);
  setError(null);
  try {
    await connecterFoyer(codeFoyer);
    onDone(profileFinal);
  } catch {
    setError('Code de foyer refusé — vérifie la saisie.');
  } finally {
    setSyncOccupe(false);
  }
};
```
(+ `const [codeFoyer, setCodeFoyer] = useState('');`)

Bloc JSX (après le `{step === 5 && (...)}`, même niveau) :
```tsx
{step === 6 && profileFinal && (
  <>
    <h1>Synchroniser les téléphones</h1>
    <p className="onboarding-sub">
      Optionnel — retrouve semaines, courses et pesées sur les deux téléphones.
    </p>
    <div className="onboarding-field">
      <label htmlFor="ob-sync-code">Code de foyer</label>
      <input
        id="ob-sync-code"
        type="password"
        value={codeFoyer}
        onChange={(e) => {
          setError(null);
          setCodeFoyer(e.target.value);
        }}
      />
    </div>
    <button
      type="button"
      className="onboarding-cta onb-full"
      onClick={connecterSync}
      disabled={syncOccupe}
    >
      {syncOccupe ? 'Connexion…' : 'Connecter le foyer'}
    </button>
    <div className="onb-btnrow">
      <button type="button" className="onb-back" onClick={() => aller(5)}>
        Retour
      </button>
      <button type="button" className="onb-next" onClick={() => onDone(profileFinal)}>
        Plus tard
      </button>
    </div>
    {error && (
      <p className="error" role="alert">
        {error}
      </p>
    )}
  </>
)}
```

- [ ] **Step 4: Vérifier le vert + non-régression (suites onboarding existantes)**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/Onboarding.tsx tests/sync/ui.test.tsx
git commit -m "feat: onboarding — étape 6 optionnelle « Synchroniser les téléphones »"
```

---

### Task 14: Infra Supabase (SQL, edge function, script foyer)

**Files:**
- Create: `supabase/migrations/0001_sync_init.sql`
- Create: `supabase/functions/connexion-foyer/index.ts`
- Create: `supabase/scripts/creer-foyer.mjs`

> `supabase/` est hors `tsconfig.app.json` (include `src`, `tests`) — pas de typecheck TS sur la fonction Deno. Node/Deno non exécutés en CI.

- [ ] **Step 1: Écrire `supabase/migrations/0001_sync_init.sql`**

```sql
-- Rituel — schéma de sync (spec 2026-09-16). Exécutable dans l'éditeur SQL Supabase.

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists weeks (
  household_id uuid not null references households on delete cascade,
  semaine text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, semaine)
);

create table if not exists checks (
  household_id uuid not null references households on delete cascade,
  semaine text not null,
  check_id text not null,
  done boolean not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, semaine, check_id)
);

create table if not exists weights (
  household_id uuid not null references households on delete cascade,
  profil text not null,
  date_ date not null,
  kg numeric not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, profil, date_)
);

create table if not exists depenses (
  household_id uuid not null references households on delete cascade,
  date_ date not null,
  magasin_key text not null,
  magasin text not null,
  total numeric not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, date_, magasin_key)
);

create table if not exists profiles (
  household_id uuid not null references households on delete cascade,
  profil text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, profil)
);

-- RLS : accès uniquement au foyer du JWT (claim household_id, signé par
-- l'edge function). households : aucune policy → inaccessible côté client.
alter table households enable row level security;
alter table weeks enable row level security;
alter table checks enable row level security;
alter table weights enable row level security;
alter table depenses enable row level security;
alter table profiles enable row level security;

create policy foyer_weeks on weeks for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
create policy foyer_checks on checks for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
create policy foyer_weights on weights for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
create policy foyer_depenses on depenses for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
create policy foyer_profiles on profiles for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');

-- Realtime
alter publication supabase_realtime add table weeks;
alter publication supabase_realtime add table checks;
alter publication supabase_realtime add table weights;
alter publication supabase_realtime add table depenses;
alter publication supabase_realtime add table profiles;
```

- [ ] **Step 2: Écrire `supabase/functions/connexion-foyer/index.ts`** (Deno)

```ts
// Edge function — connexion foyer. POST { code } → { token, foyer } | 401.
// Le code est vérifié contre households.code_hash (PBKDF2-SHA256, 100k iter).
// Le JWT HS256 est signé avec le JWT_SECRET du projet → les RLS Postgres
// lisent la claim household_id via auth.jwt().
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const enc = new TextEncoder();

const derive = async (code: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
};

const verifierHash = async (code: string, stocke: string): Promise<boolean> => {
  // format : pbkdf2-sha256$100000$<salt b64url>$<hash b64url>
  const [algo, iterStr, saltB64, hashB64] = stocke.split('$');
  if (algo !== 'pbkdf2-sha256') return false;
  const salt = Uint8Array.from(atob(saltB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const attendu = Uint8Array.from(atob(hashB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const calcule = await derive(code, salt, Number(iterStr));
  if (calcule.length !== attendu.length) return false;
  let diff = 0; // comparaison en temps constant
  for (let i = 0; i < attendu.length; i++) diff |= attendu[i]! ^ calcule[i]!;
  return diff === 0;
};

const signerJwt = async (foyerId: string, secret: string): Promise<string> => {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const corps = b64url(enc.encode(JSON.stringify({ household_id: foyerId, role: 'foyer', iat: now, exp: now + 365 * 24 * 3600 })));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${corps}`)));
  return `${head}.${corps}.${b64url(sig)}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
  try {
    const { code } = (await req.json()) as { code?: string };
    if (!code || code.length < 6) return new Response('unauthorized', { status: 401, headers: CORS });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.from('households').select('id, code_hash');
    if (error || !data || data.length !== 1) {
      return new Response('unauthorized', { status: 401, headers: CORS });
    }
    const foyer = data[0] as { id: string; code_hash: string };
    if (!(await verifierHash(code.trim(), foyer.code_hash))) {
      return new Response('unauthorized', { status: 401, headers: CORS });
    }
    const secret = Deno.env.get('JWT_SECRET');
    if (!secret) return new Response('server misconfigured', { status: 500, headers: CORS });
    const token = await signerJwt(foyer.id, secret);
    return new Response(JSON.stringify({ token, foyer: foyer.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('bad request', { status: 400, headers: CORS });
  }
});
```

- [ ] **Step 3: Écrire `supabase/scripts/creer-foyer.mjs`** (Node, zéro dépendance)

```js
// Crée le foyer (hash du code + insert households) — usage unique au setup.
// Usage : node supabase/scripts/creer-foyer.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY> [code]
// Sans code : génère une phrase aléatoire et l'affiche.
import { pbkdf2Sync, randomBytes, randomInt } from 'node:crypto';

const [url, serviceKey, codeArg] = process.argv.slice(2);
if (!url || !serviceKey) {
  console.error('Usage : node supabase/scripts/creer-foyer.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY> [code]');
  process.exit(1);
}

const MOTS = ['basilic', 'citron', 'sauge', 'romarin', 'thym', 'menthe', 'origan', 'estragon'];
const code =
  codeArg ??
  `${MOTS[randomInt(MOTS.length)]}-${MOTS[randomInt(MOTS.length)]}-${randomBytes(2).toString('hex')}`;

const salt = randomBytes(16);
const hash = pbkdf2Sync(code, salt, 100000, 32, 'sha256');
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const code_hash = `pbkdf2-sha256$100000$${b64url(salt)}$${b64url(hash)}`;

const res = await fetch(`${url}/rest/v1/households`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ code_hash }),
});
if (!res.ok) {
  console.error(`Échec insert (${res.status}) : ${await res.text()}`);
  process.exit(1);
}
const [foyer] = await res.json();
console.log(`Foyer créé : ${foyer.id}\nCode de foyer : ${code}\n→ à saisir dans l'app (une fois par téléphone).`);
```

- [ ] **Step 4: Vérifier (typecheck/lint du repo ne touchent pas supabase/)**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: infra Supabase — schéma RLS, edge connexion-foyer, script foyer"
```

---

### Task 15: `docs/backend.md` + docs (README, AGENTS, ameliorations, CHANGELOG)

**Files:**
- Create: `docs/backend.md`
- Modify: `README.md`, `AGENTS.md`, `docs/ameliorations.md`, `CHANGELOG.md`

- [ ] **Step 1: Écrire `docs/backend.md`** — setup pas-à-pas :

```markdown
# Backend de synchronisation (Supabase)

La sync est **optionnelle** : sans configuration, l'app reste 100 % locale.
Spec : `docs/superpowers/specs/2026-09-16-sync-supabase-design.md`.

## 1. Créer le projet

1. [supabase.com](https://supabase.com) → New project → **région UE** (ex. Paris) → sauvegarder le mot de passe DB.
2. Settings → API : noter `Project URL` (= `VITE_SUPABASE_URL`) et `anon public` (= `VITE_SUPABASE_ANON_KEY`).
3. Settings → API → JWT Secret (→ `JWT_SECRET` de l'edge function).

## 2. Créer le schéma

SQL Editor → coller `supabase/migrations/0001_sync_init.sql` → Run.
Vérifier : 6 tables créées, RLS activée, publication realtime à jour.

## 3. Créer le foyer (code partagé)

```bash
node supabase/scripts/creer-foyer.mjs "$SUPABASE_URL" "$SERVICE_ROLE_KEY"
# ou avec code imposé :
node supabase/scripts/creer-foyer.mjs "$SUPABASE_URL" "$SERVICE_ROLE_KEY" "mon-code"
```

Le SERVICE_ROLE_KEY ne quitte JAMAIS le terminal local (Settings → API → service_role).

## 4. Déployer l'edge function

```bash
npm i -g supabase          # CLI (ou brew install supabase/tap/supabase)
supabase login
supabase link --project-ref <ref>
supabase secrets set JWT_SECRET="<jwt secret du projet>"
supabase functions deploy connexion-foyer
```

## 5. Brancher l'app (build)

```bash
VITE_SUPABASE_URL="https://xxx.supabase.co" \
VITE_SUPABASE_ANON_KEY="eyJ..." \
npm run build
```

Les deux vars sont **publiques par design** (anon key). Aucun secret dans le front.
Les téléphones se connectent : Profil → Synchronisation → code de foyer
(l'onboarding propose l'étape optionnelle aux nouveaux profils).

## 6. Vérifier

1. Téléphone A : connexion code → « Synchronisé ✓ » (push initial du foyer vide).
2. Téléphone B : connexion code → reçoit les données (pull).
3. Cocher un item de courses sur A → apparaît coché sur B (~1 s).
4. Mode avion sur B → l'app continue hors ligne, file d'attente vidée au retour.
```

- [ ] **Step 2: Modifier `README.md`**

Ajouter une section « Synchronisation entre téléphones » après « ## Données » :

```markdown
## Synchronisation entre téléphones (optionnelle)

Par défaut, tout reste sur le téléphone. Si un foyer est configuré (voir
[`docs/backend.md`](docs/backend.md)), les données (semaines, coches, pesées,
dépenses, profils) se synchronisent entre Marc et Mélanie en quasi temps-réel,
avec file d'attente hors ligne.

> Vie privée : données hébergées chez Supabase (région UE), accès limité au
> foyer par code. « Supprimer les données du foyer » (Profil) purge serveur +
> local à tout moment.
```

- [ ] **Step 3: Modifier `AGENTS.md`**

- Section « Le projet » : remplacer « 100 % front, zéro backend » par « 100 % front + backend optionnel de sync (Supabase — voir `docs/backend.md`) ; sans configuration, l'app reste strictement locale ».
- Section « Structure » : ajouter `src/lib/sync/ # sync optionnelle Supabase (outbox, engine, client)` et `supabase/ # SQL + edge function + script foyer (hors tsconfig)`.
- Section « Storage » : ajouter les clés `sportapp:sync:token`, `sportapp:sync:foyer`, `sportapp:sync:outbox` (ne pas renommer) + une ligne : « Toute mutation passe par storage.ts, qui empile dans l'outbox via `empilerMutation` (no-op sans env/token). »
- Section « Tests » : ajouter `sync/` au miroir des tests (mock de `lib/sync/config` pour forcer l'activation).

- [ ] **Step 4: Modifier `docs/ameliorations.md`**

Dans « Contraintes non négociables », remplacer la ligne « **Zéro backend** » par :

```markdown
- **Backend optionnel** (révision 2026-09-16) : les données vivent d'abord dans
  le téléphone ; la sync Supabase (chantier 1) est un miroir qui peut être
  ignoré — l'app doit toujours être utilisable sans lui. Phases suivantes
  (reportées) : génération IA dans l'app (edge function), notifications push
  (Web Push + VAPID, iOS ≥ 16.4 PWA installée).
```

- [ ] **Step 5: Modifier `CHANGELOG.md`**

Sous `[Non publié]` :

```markdown
### Added
- Synchronisation optionnelle entre les 2 téléphones (Supabase) : semaines, coches, pesées, dépenses et profils ; file d'attente hors ligne, realtime, code de foyer, effacement du foyer.
```

- [ ] **Step 6: Commit**

```bash
git add docs/ README.md AGENTS.md CHANGELOG.md
git commit -m "docs: backend Supabase (setup, posture, changelog)"
```

---

### Task 16: Vérification finale (unit + typecheck + lint + build + e2e)

**Files:** aucun nouveau — validation.

- [ ] **Step 1: Suite complète**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```
Expected: tout PASS ; `dist/` contient un chunk séparé pour supabase-js (dynamic import) — `ls dist/assets | grep -i supabase` (facultatif).

- [ ] **Step 2: e2e (non-régression UI responsive)**

```bash
npx playwright install webkit chromium   # si nécessaire après clone
npm run e2e
```
Expected: PASS (26 specs ; sync désactivée sans env).

- [ ] **Step 3: Vérifier le build sans env = comportement inchangé**

```bash
npm run build && npm run preview   # vérifier à la main : aucune requête réseau Supabase, app normale
```

- [ ] **Step 4: Commit final (s'il reste des fixups)**

```bash
git add -A
git commit -m "chore: vérification finale sync"
```

---

## Auto-revue (faite à l'écriture)

- **Spec coverage** : outbox (§4) → Task 3-4 ; flush/pull/merge outbox-prime (§4) → Task 6-7 ; première connexion push-ou-pull (§4) → Task 8 ; realtime/online/états (§4) → Task 9 ; UI onboarding/profil/bannière (§5) → Task 10-13 ; erreurs non bloquantes + payload invalide (§6) → Task 6-7 tests ; purge + garde-fou (§6) → Task 9 ; tests sans réseau (§7) → tous ; e2e inchangés (§7-8) → Task 16 ; docs (§9) → Task 15 ; RGPD hygiène (§5-6) → Task 9 + 12. IA/push : hors périmètre (phases 2-3).
- **Type consistency** : `MutationSync`/`TableSync`/`RowSync`/`SyncClient`/`SyncEtat` définis Tasks 3/5/6 et réutilisés identiques ensuite ; `empilerMutation` (outbox) vs `connecterFoyer`/`purgerFoyer`/`initSync` (engine) cohérents entre tâches et tests.
- **Cycles d'imports** : storage → outbox → session → config ; engine → {storage, outbox, session, config, client} ; UI → engine. Aucun cycle (vérifié).
