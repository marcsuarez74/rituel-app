# Polish : Budget courses, icônes & Batch — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner le Batch sur la spec/maquette Herbes (contrat .md v3 optionnel + UI), refondre la carte Budget courses (citron, Payé en héros, 2 pills 48 px) et rendre les icônes lisibles (plancher 14 px + trait 2,5 sous 16 px).

**Architecture:** Logique pure dans `src/lib/` (nouveau `batch.ts`, extensions de `parse.ts`), composants présentatifs (`BatchView`, `CoursesBudget`, `Icon`), un seul `src/index.css` avec classes sémantiques. Zéro id de coche modifié, zéro clé storage, mal formé → warning (jamais crash).

**Tech Stack:** Vite + React 18 + TypeScript strict, vitest + Testing Library (happy-dom), Playwright (e2e 320/375), CSS sémantique tokens Herbes.

**Spec :** `docs/superpowers/specs/2026-09-15-polish-budget-icones-batch-design.md`

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `src/lib/batch.ts` | **créer** | `dureeRituel`, `iconeReserve` (purs, testés) |
| `src/lib/model.ts` | modifier | `ReserveLigne`, `MicroBatchJour.detail?`, `WeeklyData.rituelProduction?/rituelTermine?/reserve?` |
| `src/lib/parse.ts` | modifier | lignes-clés rituel, suffixe micro `| détail`, sous-section `### Réserve` |
| `src/components/Icon.tsx` | modifier | stroke adaptatif + icône `pasta` |
| `src/components/cuisine/BatchView.tsx` | modifier | badge durée, production, lancer pleine largeur, réserve, micro 3 lignes, fin guidée |
| `src/components/cuisine/CuisineView.tsx` | modifier | props BatchView (`reserve`, `production`, `termine`) |
| `src/components/cuisine/CoursesBudget.tsx` | modifier | carte citron, héros, 2 pills |
| `src/components/cuisine/ShoppingList.tsx`, `MenuView.tsx`, `ObjectifBloc.tsx`, `StatCards.tsx`, `ProfilScreen.tsx`, `onboarding/Onboarding.tsx` | modifier | tailles d'icônes → 14 |
| `src/index.css` | modifier | `.bud*`, `.batch-banner`, `.rituel-badge`, `.rituel-production`, `.lancer-btn`, `.reserve-*`, `.micro-jour-detail`, retrait `.lancer*` |
| `src/assets/semaine-exemple.md` | modifier | production, termine, détails micro, `### Réserve` |
| `docs/templates/template-semaine.md`, `docs/templates/prompt-semaine-ia.md`, `README.md`, `AGENTS.md`, `ai/context/design-system.md`, `CHANGELOG.md` | modifier | contrat documenté |
| `tests/lib/batch.test.ts`, `tests/parse.test.ts`, `tests/components.test.tsx`, `tests/app.test.tsx` | créer/modifier | miroir TDD |
| `tests/e2e/cuisine.spec.ts` | modifier | batch/budget à jour |

---

### Task 1: `src/lib/batch.ts` — durée du rituel + icône de réserve

**Files:**
- Create: `src/lib/batch.ts`
- Test: `tests/lib/batch.test.ts`

- [ ] **Step 1: Write the failing test**

Créer `tests/lib/batch.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { dureeRituel, iconeReserve } from '../../src/lib/batch';
import type { ReserveLigne, RituelEtape } from '../../src/lib/model';

const etape = (creneau: string): RituelEtape => ({ id: `x-${creneau}`, creneau, label: 'L' });

describe('dureeRituel', () => {
  it('somme les créneaux A-B min', () => {
    expect(dureeRituel([etape('0-5 min'), etape('5-30 min')])).toBe('≈ 30 min');
  });
  it('formate les heures pleines et les minutes restantes', () => {
    expect(dureeRituel([etape('0-60 min')])).toBe('≈ 1 h');
    expect(dureeRituel([etape('0-45 min'), etape('45-75 min')])).toBe('≈ 1 h 15');
  });
  it('ignore les créneaux non parsables', () => {
    expect(dureeRituel([etape('13h45 · 10 min'), etape('0-5 min')])).toBe('≈ 5 min');
  });
  it('pas de badge sans durées exploitables', () => {
    expect(dureeRituel([etape('à définir')])).toBeNull();
    expect(dureeRituel([])).toBeNull();
    expect(dureeRituel(undefined)).toBeNull();
  });
});

describe('iconeReserve', () => {
  const ligne = (plat: string, conservation: string, cle = 'lundi'): ReserveLigne => ({
    cle,
    plat,
    conservation,
  });
  it('déduit par mots-clés (sans casse ni accents)', () => {
    expect(iconeReserve(ligne('Poulet-riz', 'frigo, 2 j max · réchauffage 2 min'))).toBe('box');
    expect(iconeReserve(ligne('Poulet-riz', 'congelé dimanche · sortie mercredi soir'))).toBe('snow');
    expect(iconeReserve(ligne('Saumon-asperges', 'poisson frais du jour'))).toBe('fish');
    expect(iconeReserve(ligne('Pâtes-tomate (famille)', 'cuites le soir'))).toBe('pasta');
    expect(iconeReserve(ligne('Salade poulet-riz', 'froide'))).toBe('bowl');
  });
  it('la clé mel et le mot keto priment (feuille)', () => {
    expect(iconeReserve(ligne('Boîte keto saumon-asperges', 'à part', 'mel'))).toBe('leaf');
    expect(iconeReserve(ligne('Œufs durs', 'collations keto'))).toBe('leaf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/batch.test.ts`
Expected: FAIL — « Cannot find module '../../src/lib/batch' »

- [ ] **Step 3: Write minimal implementation**

Créer `src/lib/batch.ts` :

```ts
import type { ReserveLigne, RituelEtape } from './model';
import { normaliseComplement } from './model';

// Durée totale du rituel = somme des créneaux « A-B min ». Un créneau non
// parsable est ignoré ; aucune minute exploitable → pas de badge (null).
export function dureeRituel(rituel: RituelEtape[] | undefined): string | null {
  if (!rituel?.length) return null;
  let total = 0;
  for (const e of rituel) {
    const m = e.creneau.match(/(\d+)\s*-\s*(\d+)\s*min/i);
    if (m) total += Number(m[2]) - Number(m[1]);
  }
  if (total <= 0) return null;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return h === 0 ? `≈ ${min} min` : min === 0 ? `≈ ${h} h` : `≈ ${h} h ${min}`;
}

export type ReserveIcone = 'box' | 'bowl' | 'pasta' | 'snow' | 'fish' | 'leaf';

// Icône DÉCORATIVE de la réserve — déduite par mots-clés du plat + conservation
// (sans casse ni accents, via normaliseComplement). La clé `mel` et le mot
// `keto` priment (feuille) ; jamais une information, juste un visuel.
export function iconeReserve(ligne: ReserveLigne): ReserveIcone {
  const t = normaliseComplement(`${ligne.plat} ${ligne.conservation}`);
  if (ligne.cle === 'mel' || /keto|mel\b/.test(t)) return 'leaf';
  if (/congel/.test(t)) return 'snow';
  if (/poisson|saumon|sardine|maquereau/.test(t)) return 'fish';
  if (/pates/.test(t)) return 'pasta';
  if (/salade/.test(t)) return 'bowl';
  return 'box';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/batch.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/batch.ts tests/lib/batch.test.ts
git commit -m "feat: lib/batch — durée du rituel et icône de réserve déduite"
```

---

### Task 2: Parser — production/termine, micro `| détail`, `### Réserve`

**Files:**
- Modify: `src/lib/model.ts` (l. 66-69 `MicroBatchJour`, l. 79-90 `WeeklyData`)
- Modify: `src/lib/parse.ts` (l. 235 `BATCH_SUBS`, l. 244-270 `parseBatch`, l. 292-328 `parseRituel`/`parseMicroBatch`, l. 85-108 `parseWeeklyFile`)
- Test: `tests/parse.test.ts` (nouveau describe en fin de fichier)

- [ ] **Step 1: Write the failing tests**

Ajouter à la fin de `tests/parse.test.ts` (réutiliser le helper de fixture local — adapter le gabarit ci-dessous au style existant du fichier, sections Marc/Melanie requises) :

```ts
describe('Batch v3 — production, termine, micro détail, Réserve', () => {
  const md = (batch: string): string => `---
semaine: 2026-S38
menu: B
du: 2026-09-14
au: 2026-09-20
---

## Courses
### Frais
- Œufs

## Menu
### Lundi
- dejeuner-marc: Boîte

## Batch
${batch}

## Marc
### Cibles
- 2 450 kcal
### Séances
- [ ] Lundi — Muscu
### Rappels
- Pesée lun
## Melanie
### Cibles
- 1 450 kcal
### Séances
- [ ] Lundi — Danse
### Rappels
- Jeûne
`;

  it('parse production et termine (hors étapes, non cochables)', () => {
    const { data } = parseWeeklyFile(md(`### Rituel dimanche
- production: 2 boîtes frigo · 6 œufs durs — le riz : 2 jours max au frigo
- 0-5 min · Four à 180° — egg muffins
- termine: 4 boîtes prêtes — la semaine est servie.
`));
    expect(data.rituel).toHaveLength(1);
    expect(data.rituelProduction).toBe('2 boîtes frigo · 6 œufs durs — le riz : 2 jours max au frigo');
    expect(data.rituelTermine).toBe('4 boîtes prêtes — la semaine est servie.');
  });

  it('sans production/termine : champs absents', () => {
    const { data } = parseWeeklyFile(md(`### Rituel dimanche
- 0-5 min · Four à 180° — egg muffins
`));
    expect(data.rituelProduction).toBeUndefined();
    expect(data.rituelTermine).toBeUndefined();
  });

  it('production/termine vides → warning + ignorés', () => {
    const { data, warnings } = parseWeeklyFile(md(`### Rituel dimanche
- production:
- termine:
- 0-5 min · Four à 180° — egg muffins
`));
    expect(data.rituelProduction).toBeUndefined();
    expect(data.rituelTermine).toBeUndefined();
    expect(warnings.some((w) => w.includes('production'))).toBe(true);
    expect(warnings.some((w) => w.includes('termine'))).toBe(true);
  });

  it('production dupliquée : la première gagne + warning', () => {
    const { data, warnings } = parseWeeklyFile(md(`### Rituel dimanche
- production: première
- production: seconde
- 0-5 min · Four à 180° — egg muffins
`));
    expect(data.rituelProduction).toBe('première');
    expect(warnings.some((w) => w.includes('dupliquée'))).toBe(true);
  });

  it('micro-batch : suffixe | détail, | seul = absent', () => {
    const { data } = parseWeeklyFile(md(`### Micro-batch
- lundi: doubler le plat | 10 min · la boîte de mardi passe au frigo
- mardi: simple sans détail
- samedi: œufs durs |
`));
    expect(data.microBatch).toEqual([
      { jour: 'lundi', quoi: 'doubler le plat', detail: '10 min · la boîte de mardi passe au frigo' },
      { jour: 'mardi', quoi: 'simple sans détail' },
      { jour: 'samedi', quoi: 'œufs durs' },
    ]);
  });

  it('Réserve : jours, mel, ordre du fichier', () => {
    const { data } = parseWeeklyFile(md(`### Rituel dimanche
- 0-5 min · Four à 180° — egg muffins

### Réserve
- lundi: Poulet-riz | frigo, 2 j max · réchauffage 2 min bien chaud
- jeudi: Poulet-riz | congelé dimanche · sortie mercredi soir au frigo
- mel: Boîte keto saumon-asperges | à part, sans féculent · poisson frais
`));
    expect(data.reserve).toEqual([
      { cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max · réchauffage 2 min bien chaud' },
      { cle: 'jeudi', plat: 'Poulet-riz', conservation: 'congelé dimanche · sortie mercredi soir au frigo' },
      { cle: 'mel', plat: 'Boîte keto saumon-asperges', conservation: 'à part, sans féculent · poisson frais' },
    ]);
  });

  it('Réserve mal formée → warnings + lignes ignorées', () => {
    const { data, warnings } = parseWeeklyFile(md(`### Réserve
- noclu: Plat | conservation
- lundi: | conservation seule
- mardi: Plat sans conservation
- mercredi: Plat |
`));
    expect(data.reserve).toBeUndefined();
    expect(warnings.filter((w) => w.includes('réserve')).length).toBe(4);
  });

  it('production/termine hors sous-section Rituel dimanche → warning, pas une tâche batch', () => {
    const { data, warnings } = parseWeeklyFile(md(`- production: égarée
- [ ] Egg muffins ×10
`));
    expect(data.batch).toHaveLength(1);
    expect(warnings.some((w) => w.includes('production/termine'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/parse.test.ts`
Expected: FAIL — les nouveaux champs n'existent pas (TS) / `data.reserve` undefined

- [ ] **Step 3: Implement**

3a. `src/lib/model.ts` — étendre `MicroBatchJour` et `WeeklyData`, ajouter `ReserveLigne` :

```ts
export interface MicroBatchJour {
  jour: string;
  quoi: string;
  detail?: string; // suffixe ` | détail` — 3e ligne de la carte micro-batch
}

export interface ReserveLigne {
  cle: string; // jour (lundi..dimanche) ou « mel »
  plat: string;
  conservation: string;
}
```

Dans `WeeklyData`, après `microBatch?: MicroBatchJour[];` :

```ts
  rituelProduction?: string; // ligne `- production:` de ### Rituel dimanche
  rituelTermine?: string; // ligne `- termine:` → état final du mode guidé
  reserve?: ReserveLigne[]; // sous-section ### Réserve
```

3b. `src/lib/parse.ts` — cinq modifications :

Import du type `ReserveLigne` (ajouter à la liste d'imports de `./model`).

`BATCH_SUBS` (l. 235) :

```ts
const BATCH_SUBS = new Set(['rituel-dimanche', 'micro-batch', 'reserve']);
```

`parseBatch` — dans le bloc `if (!withBox) { … }`, AVANT le test `MICRO_SHAPE` (une ligne `- production:` matche sinon la forme micro) :

```ts
      if (/^\s*[-*]\s+(production|termine)\s*:/.test(line)) {
        warnings.push('Ligne production/termine hors sous-section « Rituel dimanche » ignorée (batch).');
        continue;
      }
```

`parseRituel` — retourne désormais un objet (fonction interne, appel unique l. 87) :

```ts
function parseRituel(
  lignes: LigneBatch[],
  section: string,
  warnings: string[],
  seen: Set<string>,
): { etapes: RituelEtape[]; production?: string; termine?: string } {
  const etapes: RituelEtape[] = [];
  let production: string | undefined;
  let termine: string | undefined;
  for (const [line, cur] of lignes) {
    if (cur !== 'rituel-dimanche') continue;
    if (!line.trim()) continue;
    const prod = line.match(/^\s*[-*]\s+production\s*:\s*(.*?)\s*$/);
    if (prod) {
      if (!prod[1]) warnings.push(`Ligne ignorée (${section}/rituel) : « production: » sans contenu.`);
      else if (production !== undefined)
        warnings.push(`« production » dupliquée (${section}/rituel) — la première gagne.`);
      else production = prod[1];
      continue;
    }
    const fin = line.match(/^\s*[-*]\s+termine\s*:\s*(.*?)\s*$/);
    if (fin) {
      if (!fin[1]) warnings.push(`Ligne ignorée (${section}/rituel) : « termine: » sans contenu.`);
      else if (termine !== undefined)
        warnings.push(`« termine » dupliqué (${section}/rituel) — le premier gagne.`);
      else termine = fin[1];
      continue;
    }
    const m = line.match(RITUEL_SHAPE);
    if (!m) {
      warnings.push(`Ligne ignorée (${section}/rituel) : « ${preview(line)} »`);
      continue;
    }
    const [, creneau, label, detail] = m;
    const id = `batch:rituel:${slugify(label)}`;
    registerId(id, `${section}/rituel`, seen, warnings);
    etapes.push({ id, creneau, label, ...(detail ? { detail } : {}) });
  }
  return {
    etapes,
    ...(production !== undefined ? { production } : {}),
    ...(termine !== undefined ? { termine } : {}),
  };
}
```

`parseMicroBatch` — split du détail au premier `|` :

```ts
    const m = line.match(/^\s*[-*]\s+([a-z-]+)\s*:\s*(.+?)\s*$/);
    if (!m) {
      warnings.push(`Ligne ignorée (batch/micro-batch) : « ${preview(line)} »`);
      continue;
    }
    const [quoi, detail] = m[2].split(/\s*\|\s*/, 2);
    out.push({ jour: m[1], quoi, ...(detail ? { detail } : {}) });
```

Nouvelle `parseReserve` (après `parseMicroBatch`) :

```ts
const JOURS_RESERVE = new Set(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'mel']);

function parseReserve(lignes: LigneBatch[], warnings: string[]): ReserveLigne[] {
  const out: ReserveLigne[] = [];
  for (const [line, cur] of lignes) {
    if (cur !== 'reserve') continue;
    if (!line.trim()) continue;
    const m = line.match(/^\s*[-*]\s+([a-z-]+)\s*:\s*(.+?)\s*$/);
    if (!m) {
      warnings.push(`Ligne réserve ignorée : « ${preview(line)} »`);
      continue;
    }
    const [, cle, reste] = m;
    const [plat, conservation] = reste.split(/\s*\|\s*/, 2);
    if (!JOURS_RESERVE.has(cle)) {
      warnings.push(`Ligne réserve ignorée : clé « ${cle} » inconnue (jour ou mel).`);
      continue;
    }
    if (!plat || !conservation) {
      warnings.push(`Ligne réserve ignorée (plat ou conservation vide) : « ${preview(line)} »`);
      continue;
    }
    out.push({ cle, plat, conservation });
  }
  return out;
}
```

3c. `parseWeeklyFile` — branchement (l. 87-88 et 107-108) :

```ts
  const rituelParse = parseRituel(lignes, 'batch', warnings, seen);
  const rituel = rituelParse.etapes;
  const microBatch = parseMicroBatch(lignes, warnings);
  const reserve = parseReserve(lignes, warnings);
```

```ts
      ...(rituel.length ? { rituel } : {}),
      ...(rituelParse.production ? { rituelProduction: rituelParse.production } : {}),
      ...(rituelParse.termine ? { rituelTermine: rituelParse.termine } : {}),
      ...(microBatch.length ? { microBatch } : {}),
      ...(reserve.length ? { reserve } : {}),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/parse.test.ts`
Expected: PASS — y compris les describes existants (rétro-compat v1/v2)

- [ ] **Step 5: Commit**

```bash
git add src/lib/model.ts src/lib/parse.ts tests/parse.test.ts
git commit -m "feat: parser — production/termine, détail micro-batch et sous-section Réserve (contrat optionnel)"
```

---

### Task 3: Icônes — trait adaptatif, `pasta`, plancher 14 px aux appels

**Files:**
- Modify: `src/components/Icon.tsx`
- Modify: `tests/components.test.tsx` (describe `Icon`, l. 1199-1229)
- Modify: call sites (liste exacte ci-dessous)

- [ ] **Step 1: Write the failing test**

Dans `tests/components.test.tsx`, describe `Icon` : ajouter `'pasta'` à la liste `NAMES` (après `'drop', 'plus', 'play'` → `'drop', 'plus', 'play', 'pasta'`), renommer le test « couvre les 21 noms » en « couvre les 22 noms du design system sans crash », et ajouter :

```tsx
  it('trait adaptatif : 2,5 sous 16 px, 2 au-delà — la prop explicite gagne', () => {
    const { unmount } = render(<Icon name="cart" size={14} />);
    expect(document.querySelector('svg')).toHaveAttribute('stroke-width', '2.5');
    unmount();
    const { unmount: u2 } = render(<Icon name="cart" size={16} />);
    expect(document.querySelector('svg')).toHaveAttribute('stroke-width', '2');
    u2();
    render(<Icon name="check" size={38} strokeWidth={2.5} />);
    expect(document.querySelector('svg')).toHaveAttribute('stroke-width', '2.5');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components.test.tsx -t Icon`
Expected: FAIL — pas d'attribut `stroke-width="2.5"` à 14 px (trait 2 par défaut)

- [ ] **Step 3: Implement Icon.tsx**

3a. Ajouter l'icône `pasta` (chemins de la maquette Herbes) entre `bowl` et `meat` dans `ICONS` :

```tsx
  pasta: (
    <>
      <path d="M4 12h16a8 8 0 0 1-16 0z" />
      <path d="M8.5 12V6.5M11.5 12V5.5M14.5 12V5.5M17 12V7" />
    </>
  ),
```

3b. Signature du composant — trait par défaut adaptatif :

```tsx
export function Icon({
  name,
  size = 16,
  strokeWidth,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  // Lisibilité : sous 16 px le trait passe à 2,5 (les petits tracés 24-unités
  // tombaient sous ~1 px réel). La prop explicite reste prioritaire.
  const trait = strokeWidth ?? (size < 16 ? 2.5 : 2);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={trait}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
```

- [ ] **Step 4: Bump des tailles aux call sites (11/12/13 → 14)**

Chaque ligne : remplacer uniquement l'attribut `size={…}`. Les icônes ≥ 14 px ou avec `strokeWidth` explicite ne bougent pas.

| Fichier | Ligne | Changement |
|---|---|---|
| `src/components/StatCards.tsx` | 36 | `scale` 13 → 14 |
| `src/components/ObjectifBloc.tsx` | 88 | `scale` 13 → 14 |
| `src/components/ObjectifBloc.tsx` | 63 | `clock` 12 → 14 |
| `src/components/ObjectifBloc.tsx` | 55 | `leaf` 11 → 14 |
| `src/components/ObjectifBloc.tsx` | 50 | `type.icone` 11 → 14 |
| `src/components/ProfilScreen.tsx` | 492, 356 | `plus` 13 → 14 |
| `src/components/onboarding/Onboarding.tsx` | 664, 489 | `plus` 13 → 14 |
| `src/components/cuisine/ShoppingList.tsx` | 76 | `cart` 12 → 14 |
| `src/components/cuisine/ShoppingList.tsx` | 63, 49 | `pot` 12 → 14 |
| `src/components/cuisine/MenuView.tsx` | 92 | `check` 13 → 14 |
| `src/components/cuisine/MenuView.tsx` | 226, 231, 236, 241 | `flame`/`wheat`/`meat`/`drop` 11 → 14 |
| `src/components/cuisine/MenuView.tsx` | 155, 160, 180 | `clock`/`flame`/`box` 11 → 14 |
| `src/components/cuisine/MenuView.tsx` | 204 | `chev` 12 → 14 |
| `src/components/cuisine/MenuView.tsx` | 142 | `check` 14 — supprimer `strokeWidth={2.5}` (devenu le défaut) |
| `src/components/cuisine/CoursesBudget.tsx` | 44, 81, 222 | `cart` 11 / `plus` 13 / `check` 13 → 14 |

Inchangés (≥ 14 ou cas dédiés) : `WeekBanner` 16, `TabBar` 18, `MenuView:146` tuiles 20, `ShoppingList:60` médaillon 16, `BatchView:35` lune 16, `Onboarding` 362/429/549 chevrons 14, `Onboarding:235` check 16, `CoursesBudget:160` chev-left 14, `ShoppingList:89` leaf 14, `Onboarding:389` 14.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (aucun test n'asserte une taille de svg excepté Icon)

- [ ] **Step 6: Commit**

```bash
git add src/components/Icon.tsx tests/components.test.tsx src/components/
git commit -m "feat: icônes — trait adaptatif 2,5 sous 16 px, icône pasta, plancher 14 px aux appels"
```

---

### Task 4: Batch UI — carte rituel, micro, réserve, fin guidée, bannière centrée

**Files:**
- Modify: `src/components/cuisine/BatchView.tsx` (réécriture guidée par le code ci-dessous)
- Modify: `src/components/cuisine/CuisineView.tsx:60`
- Modify: `src/index.css` (bloc batch l. 396-427 + l. 985-1052)
- Test: `tests/components.test.tsx` (describe `BatchView v2 — rituel et micro-batch`, l. 633-776)
- Test: `tests/app.test.tsx` (aucun changement attendu — vérifier `/muffins/i` l. 209)

- [ ] **Step 1: Write the failing tests**

Dans `tests/components.test.tsx`, adapter le describe `BatchView v2` :

1. Test l. 651 « affiche le rituel en timeline… » — remplacer les assertions compteur par le badge + le titre sans émoji (somme des créneaux du fixture RITUEL = 60 min → « ≈ 1 h ») :

```tsx
  it('affiche le rituel en timeline avec créneaux, détails et badge de durée', () => {
    render(<BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />);
    expect(screen.getByText('Rituel dimanche')).toBeInTheDocument();
    expect(screen.getByText('≈ 1 h')).toBeInTheDocument();
    expect(screen.getByText('0-5 min')).toBeInTheDocument();
    expect(screen.getByText('Four à 180°')).toBeInTheDocument();
    expect(screen.getByText('egg muffins ×10 lancés, on fait le reste')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  });
```

2. Test l. 661 — titre du micro : remplacer `/Micro-batch de la semaine/` par `'Micro-batch en semaine'`.

3. Test l. 677 « cocher une étape… » — supprimer la ligne `expect(screen.getByText('1/5')).toBeInTheDocument();` (compteur supprimé).

4. Test l. 714 « mode guidé… » — le bouton de l'état final devient « Revoir l'aperçu » : remplacer `await user.click(screen.getByRole('button', { name: /Revenir à l'aperçu/ }));` par :

```tsx
    await user.click(screen.getByRole('button', { name: /Revoir l'aperçu/ }));
```

5. Test l. 764 « resynchronise… » — supprimer la ligne `expect(screen.getByText('0/5')).toBeInTheDocument();`.

6. Nouveaux tests (ajouter au describe) :

```tsx
  it('badge absent si aucun créneau parsable', () => {
    render(
      <BatchView
        rituel={[{ id: 'batch:rituel:x', creneau: 'à définir', label: 'X' }]}
        microBatch={[]}
        semaine="2026-S39"
      />,
    );
    expect(document.querySelector('.rituel-badge')).toBeNull();
  });

  it('affiche la ligne production sous le titre', () => {
    render(
      <BatchView
        rituel={RITUEL}
        microBatch={[]}
        production="2 boîtes frigo · 6 œufs durs"
        semaine="2026-S39"
      />,
    );
    expect(document.querySelector('.rituel-production')).toHaveTextContent('2 boîtes frigo');
  });

  it('le micro-batch affiche le détail en 3e ligne quand présent', () => {
    render(
      <BatchView
        rituel={RITUEL}
        microBatch={[{ jour: 'lundi', quoi: 'doubler le plat', detail: '10 min · la boîte de mardi passe au frigo' }]}
        semaine="2026-S39"
      />,
    );
    expect(document.querySelector('.micro-jour-detail')).toHaveTextContent('10 min');
  });

  it('affiche la réserve après le micro-batch avec les icônes déduites', () => {
    const { container } = render(
      <BatchView
        rituel={RITUEL}
        microBatch={MICRO}
        reserve={[
          { cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' },
          { cle: 'jeudi', plat: 'Poulet-riz', conservation: 'congelé dimanche · sortie mercredi soir' },
          { cle: 'mercredi', plat: 'Pâtes-tomate (famille)', conservation: 'cuites le soir' },
          { cle: 'mel', plat: 'Boîte keto saumon-asperges', conservation: 'à part' },
        ]}
        semaine="2026-S39"
      />,
    );
    const reserve = container.querySelector('.reserve-list');
    expect(reserve).not.toBeNull();
    expect(reserve!.querySelectorAll('.reserve-ligne')).toHaveLength(4);
    expect(screen.getByText('Mél — Boîte keto saumon-asperges')).toBeInTheDocument();
    expect(screen.getByText('Lundi — Poulet-riz')).toBeInTheDocument();
    // ordre DOM : micro-batch avant la réserve
    const micro = container.querySelector('.micro-batch');
    expect(micro!.compareDocumentPosition(reserve!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('l’état final du mode guidé utilise termine et « Revoir l’aperçu »', async () => {
    const user = userEvent.setup();
    render(
      <BatchView
        rituel={[{ id: 'batch:rituel:x', creneau: '0-5 min', label: 'X' }]}
        microBatch={[]}
        termine="4 boîtes prêtes — la semaine est servie."
        semaine="2026-S39"
      />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le batch/ }));
    await user.click(screen.getByRole('button', { name: /Terminer le batch/ }));
    expect(screen.getByText('4 boîtes prêtes — la semaine est servie.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Revoir l'aperçu/ }));
    expect(document.querySelector('.rituel-timeline')).not.toBeNull();
  });

  it('sans termine : texte par défaut à l’état final', async () => {
    const user = userEvent.setup();
    render(
      <BatchView rituel={[{ id: 'batch:rituel:x', creneau: '0-5 min', label: 'X' }]} microBatch={[]} semaine="2026-S39" />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le batch/ }));
    await user.click(screen.getByRole('button', { name: /Terminer le batch/ }));
    expect(screen.getByText('Tout est prêt pour la semaine.')).toBeInTheDocument();
  });

  it('réserve seule (sans rituel ni micro) : la réserve s’affiche, pas de message vide', () => {
    const { container } = render(
      <BatchView
        reserve={[{ cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' }]}
        semaine="2026-S39"
      />,
    );
    expect(container.querySelector('.reserve-list')).not.toBeNull();
    expect(screen.queryByText('Aucun batch prévu cette semaine.')).toBeNull();
  });

  it('« Lancer le batch » est un bouton pleine largeur sous la timeline (plus de pilule dans le head)', () => {
    const { container } = render(<BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />);
    expect(container.querySelector('.lancer-wrap')).toBeNull();
    const btn = screen.getByRole('button', { name: /Lancer le batch/ });
    expect(btn).toHaveClass('lancer-btn');
    const section = container.querySelector('.batch-section')!;
    expect(section.contains(btn)).toBe(true);
    const timeline = container.querySelector('.rituel-timeline')!;
    expect(timeline.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components.test.tsx -t BatchView`
Expected: FAIL — props `reserve/production/termine` inconnues, `.rituel-badge` absent, etc.

- [ ] **Step 3: Implement BatchView.tsx**

Réécrire `src/components/cuisine/BatchView.tsx` :

```tsx
import { useRef, useState } from 'react';
import type { MicroBatchJour, ReserveLigne, RituelEtape } from '../../lib/model';
import { getChecks, setCheck } from '../../lib/storage';
import { todayKey } from '../../lib/dates';
import { capitalize } from '../../lib/text';
import { dureeRituel, iconeReserve } from '../../lib/batch';
import { Icon } from '../Icon';

export function BatchView({
  rituel,
  microBatch,
  reserve,
  production,
  termine,
  semaine,
}: {
  rituel?: RituelEtape[];
  microBatch?: MicroBatchJour[];
  reserve?: ReserveLigne[];
  production?: string;
  termine?: string;
  semaine: string;
}) {
  const [mode, setMode] = useState<'apercu' | 'run' | 'fini'>('apercu');
  const [idx, setIdx] = useState(0);
  // Garde anti-crash : BatchView reste montée au changement de semaine (chevrons) ;
  // si le rituel raccourcit sous l'étape en cours, le run n'est plus valide → aperçu.
  // Garde différentielle (ne re-tire que si l'état diffère) et muette au premier montage.
  if (mode === 'run' && !(rituel && idx < rituel.length)) {
    setMode('apercu');
    setIdx(0);
  }
  const hasRituel = !!rituel?.length;
  const hasMicro = !!microBatch?.length;
  const hasReserve = !!reserve?.length;
  const ceSoir = microBatch?.find((m) => m.jour === todayKey());

  return (
    <>
      {ceSoir && (
        <div className="batch-banner ce-soir">
          <span className="bb-ic">
            <Icon name="moon" size={16} />
          </span>
          <span>
            <b>Ce soir ({ceSoir.jour})</b> — {ceSoir.quoi}
          </span>
        </div>
      )}
      {hasRituel && rituel && mode === 'apercu' && (
        <RituelTimeline
          etapes={rituel}
          production={production}
          semaine={semaine}
          onLancer={() => {
            setMode('run');
            setIdx(0);
          }}
        />
      )}
      {hasRituel && rituel && mode === 'run' && idx < rituel.length && (
        <section className="batch-section batch-guide" aria-live="polite">
          <div className="guide-etape-num">
            Étape {idx + 1}/{rituel.length} · {rituel[idx].creneau}
          </div>
          <h3 className="guide-titre">{rituel[idx].label}</h3>
          {rituel[idx].detail && <p className="guide-detail">{rituel[idx].detail}</p>}
          <progress value={idx} max={rituel.length} aria-hidden="true" />
          <button
            type="button"
            className="btn"
            onClick={() => (idx + 1 < rituel.length ? setIdx(idx + 1) : setMode('fini'))}
          >
            {idx + 1 < rituel.length ? 'Étape terminée →' : 'Terminer le batch ✓'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setMode('apercu');
              setIdx(0);
            }}
          >
            Revenir à l'aperçu
          </button>
        </section>
      )}
      {hasRituel && mode === 'fini' && (
        <section className="batch-section batch-guide" aria-live="polite">
          <span className="guide-done-ic">
            <Icon name="check" size={38} strokeWidth={2.5} />
          </span>
          <h3 className="guide-titre">Batch terminé !</h3>
          <p className="guide-detail">{termine ?? 'Tout est prêt pour la semaine.'}</p>
          <button type="button" className="btn-ghost" onClick={() => setMode('apercu')}>
            Revoir l'aperçu
          </button>
        </section>
      )}
      {hasMicro && mode === 'apercu' && microBatch && <MicroBatch jours={microBatch} />}
      {mode === 'apercu' && hasReserve && reserve && <Reserve lignes={reserve} />}
      {!hasRituel && !hasMicro && !hasReserve && <p className="muted">Aucun batch prévu cette semaine.</p>}
    </>
  );
}

function MicroBatch({ jours }: { jours: MicroBatchJour[] }) {
  const [actif, setActif] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const auScroll = () => {
    const el = ref.current;
    if (!el) return;
    const premier = el.firstElementChild as HTMLElement | null;
    const largeur = premier ? premier.offsetWidth + 8 : 158;
    setActif(Math.min(jours.length - 1, Math.max(0, Math.round(el.scrollLeft / largeur))));
  };
  return (
    <section className="batch-section">
      <h3>Micro-batch en semaine</h3>
      <div className="micro-batch" ref={ref} onScroll={auScroll}>
        {jours.map((m) => (
          <div className="micro-jour" key={m.jour}>
            <div className="micro-jour-nom">{capitalize(m.jour)}</div>
            <div className="micro-jour-quoi">{m.quoi}</div>
            {m.detail && <div className="micro-jour-detail">{m.detail}</div>}
          </div>
        ))}
      </div>
      <div className="micro-dots" aria-hidden="true">
        {jours.map((_, i) => (
          <i key={i} className={i === actif ? 'on' : ''} />
        ))}
      </div>
    </section>
  );
}

function Reserve({ lignes }: { lignes: ReserveLigne[] }) {
  return (
    <section className="batch-section">
      <h3>La réserve — au frigo cette semaine</h3>
      <div className="reserve-list">
        {lignes.map((l, i) => (
          <div className="reserve-ligne" key={`${l.cle}-${i}`}>
            <span className="reserve-ic">
              <Icon name={iconeReserve(l)} size={16} />
            </span>
            <span className="reserve-corps">
              <span className="reserve-nom">
                {l.cle === 'mel' ? 'Mél' : capitalize(l.cle)} — {l.plat}
              </span>
              <span className="reserve-cons">{l.conservation}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RituelTimeline({
  etapes,
  production,
  semaine,
  onLancer,
}: {
  etapes: RituelEtape[];
  production?: string;
  semaine: string;
  onLancer: () => void;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  const [syncedSemaine, setSyncedSemaine] = useState(semaine);
  if (syncedSemaine !== semaine) {
    setSyncedSemaine(semaine);
    setChecks(getChecks(semaine));
  }
  const duree = dureeRituel(etapes);
  const toggle = (id: string) => {
    const next = !checks[id];
    setCheck(semaine, id, next);
    setChecks((prev) => ({ ...prev, [id]: next }));
  };
  return (
    <section className="batch-section">
      <div className="batch-section-head">
        <h3>Rituel dimanche</h3>
        {duree && (
          <span className="rituel-badge">
            <Icon name="clock" size={14} />
            {duree}
          </span>
        )}
      </div>
      {production && <p className="rituel-production">{production}</p>}
      <ol className="rituel-timeline">
        {etapes.map((e) => (
          <li className={checks[e.id] ? 'rituel-etape done' : 'rituel-etape'} key={e.id}>
            <label>
              <input
                type="checkbox"
                checked={!!checks[e.id]}
                onChange={() => toggle(e.id)}
                aria-label={`${e.label} (${e.creneau})`}
              />
              <span className="rituel-corps">
                <span className="rituel-label">
                  {e.label}
                  <span className="rituel-creneau">{e.creneau}</span>
                </span>
                {e.detail && <span className="rituel-detail">{e.detail}</span>}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <button type="button" className="btn lancer-btn" onClick={onLancer}>
        <Icon name="play" size={14} /> Lancer le batch
      </button>
    </section>
  );
}
```

`src/components/cuisine/CuisineView.tsx` l. 60 :

```tsx
        <BatchView
          rituel={data.rituel}
          microBatch={data.microBatch}
          reserve={data.reserve}
          production={data.rituelProduction}
          termine={data.rituelTermine}
          semaine={semaine}
        />
```

- [ ] **Step 4: CSS**

Dans `src/index.css` :

1. `.batch-banner` (l. 400) : `align-items: flex-start;` → `align-items: center;`
2. Remplacer le bloc `.lancer-wrap`/`.lancer` (l. 987-1004) par :

```css
.rituel-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--accent);
  background: var(--surface-2);
  border: 1px dashed var(--accent);
  border-radius: 7px;
  padding: 3px 8px;
  white-space: nowrap;
}

.rituel-production {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.5;
  margin: 6px 0 0;
}

.lancer-btn {
  width: 100%;
  margin-top: 12px;
}
```

3. Après `.micro-jour-quoi` (l. 965), ajouter :

```css
.micro-jour-detail {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.45;
  margin-top: 5px;
}

.reserve-list {
  margin-top: 4px;
}

.reserve-ligne {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.reserve-ligne:first-child {
  border-top: 0;
}

.reserve-ic {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.reserve-corps {
  min-width: 0;
}

.reserve-nom {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
}

.reserve-cons {
  display: block;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.45;
  margin-top: 1px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/components.test.tsx tests/app.test.tsx`
Expected: PASS (app.test `/muffins/i` l. 209 toujours valide — le détail du rituel reste affiché)

- [ ] **Step 6: Commit**

```bash
git add src/components/cuisine/BatchView.tsx src/components/cuisine/CuisineView.tsx src/index.css tests/components.test.tsx
git commit -m "feat: batch fidèle à la maquette — badge durée, production, lancer pleine largeur, réserve, micro détaillé, fin guidée"
```

---

### Task 5: Carte Budget courses — citron, héros, deux pills

**Files:**
- Modify: `src/components/cuisine/CoursesBudget.tsx` (composant `CoursesBudget` uniquement — `DepensesPanel` inchangé)
- Modify: `src/index.css` (bloc `.bud*` l. 2070-2175 + `.bsoft` l. 2179 + `.blink` l. 2195)
- Test: `tests/components.test.tsx` (describe `CoursesBudget — carte budget`, l. 1230-1342)

- [ ] **Step 1: Rewrite the failing tests**

Dans `tests/components.test.tsx`, remplacer les tests du describe `CoursesBudget` (les libellés « Estimé menu » / « Budget max » de la grille disparaissent au profit du héros + phrase) :

```tsx
describe('CoursesBudget — carte budget (citron)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche le payé en héros, la phrase secondaire (estimé + max) et le pourcentage', () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    render(
      <CoursesBudget
        data={dataAvecBudget('≈ 35 €')}
        profile={profileV2('marc', { magasin: 'Lidl', budgetMax: 40 })}
        onOuvrirDepenses={() => {}}
      />,
    );

    expect(screen.getByText('Budget courses')).toBeInTheDocument();
    expect(screen.getByText('Payé cette semaine')).toBeInTheDocument();
    expect(screen.getByText('38,20 €')).toBeInTheDocument();
    expect(screen.getByText(/≈ 35 €/)).toBeInTheDocument();
    expect(screen.getByText(/40,00 €/)).toBeInTheDocument();
    expect(screen.getByText('96 % du budget')).toBeInTheDocument();
    expect(screen.getByText('Lidl')).toBeInTheDocument(); // pill magasin
  });

  it('passe en rouge et annonce le dépassement au-delà du budget max', () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 43.8 }]);
    render(
      <CoursesBudget
        data={dataAvecBudget('≈ 35 €')}
        profile={profileV2('marc', { budgetMax: 40 })}
        onOuvrirDepenses={() => {}}
      />,
    );

    expect(screen.getByText('43,80 €')).toBeInTheDocument();
    expect(screen.getByText('dépassé de 10 %')).toBeInTheDocument();
    expect(document.querySelector('.bud-bar.alerte')).not.toBeNull();
    expect(document.querySelector('.bud-pct.alerte')).not.toBeNull();
    expect(document.querySelector('.bud-hero.alerte')).not.toBeNull();
  });

  it('somme uniquement les dépenses de la semaine affichée', () => {
    seedDepenses([
      { date: '2026-09-09', magasin: 'Lidl', total: 38.2 },
      { date: '2026-09-02', magasin: 'Lidl', total: 10 }, // semaine précédente (du = 2026-09-07)
      { date: '2026-09-14', magasin: 'Lidl', total: 5 }, // semaine suivante
    ]);
    render(
      <CoursesBudget
        data={dataAvecBudget()}
        profile={profileV2('marc', { budgetMax: 40 })}
        onOuvrirDepenses={() => {}}
      />,
    );

    expect(screen.getByText('38,20 €')).toBeInTheDocument();
    expect(screen.queryByText('48,20 €')).not.toBeInTheDocument();
  });

  it('sans budget max : phrase sans max, pas de barre ni de pourcentage', () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    render(
      <CoursesBudget data={dataAvecBudget('≈ 35 €')} profile={profileV2('marc')} onOuvrirDepenses={() => {}} />,
    );

    expect(screen.getByText(/≈ 35 €/)).toBeInTheDocument();
    expect(screen.queryByText(/max/)).not.toBeInTheDocument();
    expect(document.querySelector('.bud-bar')).toBeNull();
  });

  it('estimé absent du .md : la phrase ne porte que le max', () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    render(
      <CoursesBudget data={dataAvecBudget()} profile={profileV2('marc', { budgetMax: 40 })} onOuvrirDepenses={() => {}} />,
    );

    expect(screen.getByText(/max/)).toBeInTheDocument();
    expect(screen.queryByText(/estimés/)).not.toBeInTheDocument();
  });

  it('rien de saisi : « Payé » vaut —, pas de barre', () => {
    render(
      <CoursesBudget data={dataAvecBudget('≈ 35 €')} profile={profileV2('marc', { budgetMax: 40 })} onOuvrirDepenses={() => {}} />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(document.querySelector('.bud-bar')).toBeNull();
  });

  it('aucune donnée du tout : la carte ne rend rien', () => {
    const { container } = render(
      <CoursesBudget data={dataAvecBudget()} profile={profileV2('marc')} onOuvrirDepenses={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('deux actions en pills : « Total payé » et « Voir mes dépenses réelles »', async () => {
    const onOuvrir = vi.fn();
    const user = userEvent.setup();
    render(
      <CoursesBudget
        data={dataAvecBudget('≈ 35 €')}
        profile={profileV2('marc', { budgetMax: 40 })}
        onOuvrirDepenses={onOuvrir}
      />,
    );

    const total = screen.getByRole('button', { name: /Total payé/ });
    const voir = screen.getByRole('button', { name: /Voir mes dépenses réelles/ });
    expect(total).toHaveClass('bsoft');
    expect(voir).toHaveClass('bsoft');
    await user.click(total);
    expect(onOuvrir).toHaveBeenCalledWith(true);
    await user.click(voir);
    expect(onOuvrir).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components.test.tsx -t CoursesBudget`
Expected: FAIL — l'ancienne grille n'a pas le héros/`.bud-hero`

- [ ] **Step 3: Implement the component**

Dans `src/components/cuisine/CoursesBudget.tsx`, remplacer le `return` du composant `CoursesBudget` (le bloc `.bud-grid` disparaît) :

```tsx
  return (
    <section className="bud" aria-label="Budget courses">
      <div className="bud-head">
        <b>Budget courses</b>
        {profile.magasin && (
          <span className="mag">
            <Icon name="cart" size={14} />
            {profile.magasin}
          </span>
        )}
      </div>
      <span className="bud-hero-label">Payé cette semaine</span>
      <span className={`bud-hero${depasse ? ' alerte' : ''}`}>
        {enSemaine ? formatEuro(paye) : '—'}
      </span>
      {(data.budget || max !== undefined) && (
        <p className="bud-sub">
          {data.budget && (
            <>
              sur <b>{data.budget}</b> estimés
            </>
          )}
          {data.budget && max !== undefined && ' · '}
          {max !== undefined && (
            <>
              max <b>{formatEuro(max)}</b>
            </>
          )}
        </p>
      )}
      {maxConnu && (
        <div className="bud-foot">
          <div className={`bud-bar${depasse ? ' alerte' : ''}`}>
            <i style={{ width: depasse ? '100%' : `${Math.min(pct!, 100)}%` }} />
          </div>
          <span className={`bud-pct${depasse ? ' alerte' : ''}`}>
            {depasse ? `dépassé de ${pct! - 100} %` : `${pct} % du budget`}
          </span>
        </div>
      )}
      <div className="bud-actions">
        <button type="button" className="bsoft" onClick={() => onOuvrirDepenses(true)}>
          <Icon name="plus" size={14} /> Total payé
        </button>
        <button type="button" className="bsoft bud-lie" onClick={() => onOuvrirDepenses(false)}>
          Voir mes dépenses réelles
        </button>
      </div>
    </section>
  );
```

- [ ] **Step 4: CSS**

Dans `src/index.css` :

1. `.bud` (l. 2070) — carte citron :

```css
.bud {
  background: color-mix(in srgb, var(--accent-2) 16%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent-2) 55%, var(--border));
  border-radius: var(--radius);
  padding: 16px 18px 18px;
}
```

2. `.bud-head b` (l. 2082) — plus de caps :

```css
.bud-head b {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text);
}
```

3. `.mag` (l. 2089) — pill sur carte citron : remplacer `background: color-mix(in srgb, var(--accent-2) 60%, var(--surface));` par `background: var(--surface);`

4. Supprimer `.bud-grid`, `.bud-grid.cols2`, `.bud-cell`, `.bud-cell .l`, `.bud-cell .v`, `.bud-cell .v.alerte` (l. 2100-2132) et ajouter :

```css
.bud-hero-label {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
  color: color-mix(in srgb, var(--muted) 70%, var(--text));
  margin-top: 14px;
}

.bud-hero {
  display: block;
  font-size: 27px;
  font-weight: 700;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.bud-hero.alerte {
  color: var(--danger);
}

.bud-sub {
  font-size: 12px;
  color: color-mix(in srgb, var(--muted) 70%, var(--text));
  margin: 3px 0 0;
}

.bud-sub b {
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
```

5. `.bud-bar` (l. 2139) : `height: 6px;` → `height: 8px;`

6. `.bud-actions` (l. 2165) — filet citron + wrap :

```css
.bud-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px dashed color-mix(in srgb, var(--accent-2) 55%, var(--border));
}

.bud-lie {
  flex: 1;
  min-width: 0;
  justify-content: center;
}
```

Supprimer la règle `.bud-actions .blink { margin-left: auto; }` (l. 2173-2175).

7. `.bsoft` (l. 2183) : `min-height: 40px;` → `min-height: 48px;`

8. `.blink` (l. 2195) : ajouter `min-height: 48px;` (cible tactile, conservé pour « Annuler » du panneau dépenses).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/cuisine/CoursesBudget.tsx src/index.css tests/components.test.tsx
git commit -m "feat: budget courses — carte citron, payé en héros, deux pills 48 px"
```

---

### Task 6: Semaine d'exemple enrichie + docs (template, prompt, README, AGENTS, design-system, CHANGELOG)

**Files:**
- Modify: `src/assets/semaine-exemple.md` (section `## Batch`)
- Modify: `docs/templates/template-semaine.md`, `docs/templates/prompt-semaine-ia.md`, `README.md`, `AGENTS.md`, `ai/context/design-system.md`, `CHANGELOG.md`
- Test: `tests/parse.test.ts` (describe `semaine-exemple.md` l. 937 — extension)

- [ ] **Step 1: Write the failing test**

Dans `tests/parse.test.ts`, describe `semaine-exemple.md — la sample réelle`, ajouter :

```ts
  it('porte les nouveautés batch v3 : production, termine, détails micro, Réserve (0 warning)', () => {
    const { data, warnings } = parseWeeklyFile(exemple);
    expect(data.rituelProduction).toBeTruthy();
    expect(data.rituelTermine).toBeTruthy();
    expect(data.microBatch?.some((m) => m.detail)).toBe(true);
    expect(data.reserve?.length).toBeGreaterThanOrEqual(4);
    expect(warnings).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/parse.test.ts -t "semaine-exemple"`
Expected: FAIL — champs absents de l'exemple

- [ ] **Step 3: Enrich `src/assets/semaine-exemple.md`**

Section `## Batch` :

```markdown
## Batch
### Rituel dimanche
- production: 2 boîtes frigo · 1 boîte congélateur · 1 sauce · 6 œufs durs — le riz ne tient pas la semaine : 2 jours au frigo max, le reste congelé.
- 0-5 min · Four à 180° — egg muffins ×10 lancés, on fait le reste
- 5-30 min · Cuissons en double — dîner du soir ×2 + féculent ×2 → boîte lundi (+ cuisses de poulet du lundi)
- 30-35 min · Œufs durs ×6-8 — boxes de la semaine pour Mél
- 35-50 min · Légumes + vinaigrette — laver, couper, ranger
- 50-60 min · Montage des boxes — boîte lundi Marc + 1 box keto Mél
- termine: 4 boîtes prêtes — la semaine est servie. Prochain rituel : dimanche prochain, 13h45.

### Micro-batch
- lundi: doubler le plat (boîtes mar/mer) | 10 min · la boîte de mardi passe au frigo
- mardi: doubler la sauce + courgettes en julienne (5 min le soir) | base sauce pour la semaine
- samedi: œufs durs ×6-8 | collations prêtes

### Réserve
- lundi: Boîte dinde-quinoa | frigo, 2 j max · réchauffage bien chaud à cœur
- mardi: Salade dinde-quinoa | froide · vinaigrette au moment
- jeudi: Boîte dinde-quinoa | congelée dimanche · sortie mercredi soir au frigo
- mel: Box keto (œufs durs + crudités) | à monter au rituel · sans féculent

- [ ] Egg muffins ×10
- [ ] 6-8 œufs durs (boxes keto de Mél)
- [ ] Doubler dinde + quinoa → boîte lundi Marc
- [ ] Légumes de la semaine lavés/coupés
- [ ] Vinaigrette olive-citron
```

(Les tâches `- [ ]` et les étapes existantes restent **caractère pour caractère** — aucun id de coche ne change.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/parse.test.ts`
Expected: PASS — 0 warning sur l'exemple

- [ ] **Step 5: Docs**

5a. `docs/templates/template-semaine.md` — dans `## Batch` :

```markdown
### Rituel dimanche
- production: {{ce que le batch produit + conservation — ex. « 2 boîtes frigo · 1 boîte congélateur — le riz : 2 jours max au frigo »}}
- 0-5 min · Four à 180° — egg muffins ×10 lancés, on fait le reste
- 5-30 min · Cuissons en double — {{dîner du soir ×2 + féculent ×2 → boîte lundi}}
- 30-35 min · Œufs durs ×6-8 — boxes de la semaine pour Mél
- 35-50 min · Légumes + vinaigrette — laver, couper, ranger
- 50-60 min · Montage des boxes — boîte lundi Marc + 1 box keto Mél
- termine: {{message de fin du mode guidé — ex. « 4 boîtes prêtes — la semaine est servie. Prochain rituel : dimanche prochain, 13h45. »}}

### Micro-batch
- lundi: {{...}} | {{détail optionnel — ex. « 10 min · la boîte de mardi passe au frigo »}}
- mardi: {{...}}
<!-- Uniquement les jours du menu ; samedi = œufs durs ; un seul item par jour ; le suffixe « | détail » est optionnel -->

### Réserve
- lundi: {{plat}} | {{conservation — ex. « frigo, 2 j max · réchauffage 2 min bien chaud »}}
- jeudi: {{plat}} | {{ex. « congelé dimanche · sortie mercredi soir au frigo »}}
- mel: {{plat}} | {{la clé « mel » = la box keto de Mélanie}}
<!-- Une ligne par plat stocké ; clé = jour (lundi..dimanche) ou « mel » ; jamais de déduction par l'app -->
```

(Le badge « ≈ durée » est calculé par l'app depuis les créneaux — rien à écrire.)

5b. `docs/templates/prompt-semaine-ia.md` — étape 4 du « Process » devient :

```markdown
4. **Batch** : le rituel générique du carnet (5-6 étapes horodatées, détail
   ajusté au dîner du dimanche du menu) + une ligne `- production:` (ce que le
   batch produit + conservation) + une ligne `- termine:` (message de fin du
   mode guidé) + le micro-batch du menu (du tableau micro-batches, avec le
   suffixe ` | détail` : durée/conservation) + la sous-section `### Réserve`
   (une ligne par plat stocké : `- <jour|mel>: <plat> | <conservation>`) +
   3-5 tâches `- [ ]` du gros batch.
```

Et à l'auto-contrôle, ajouter :

```markdown
- [ ] `### Réserve` : clés = jours ou « mel », chaque ligne a plat ET conservation
- [ ] production/termine/détails/réserve cohérents avec le rituel et le menu
```

5c. `README.md` — l. 105, la ligne `## Batch` du format devient :

```markdown
- `## Batch` : la checklist `- [ ]`, plus trois blocs optionnels — `### Rituel dimanche` (étapes `- <créneau> · <label> — <détail>`, cochables en timeline, plus les lignes-clés `- production:` et `- termine:` — badge de durée calculé par l'app), `### Micro-batch` (`- jour: quoi` avec suffixe optionnel ` | détail`, carrousel horizontal) et `### Réserve` (`- <jour|mel>: <plat> | <conservation>`, liste des plats stockés).
```

Et mettre à jour l'extrait affiché plus haut (l. 33-71) pour refléter production/termine/Réserve.

5d. `AGENTS.md` — la ligne du contrat .md (section « Le contrat .md ») devient : `## Batch` (`- [ ]` tâches + `### Rituel dimanche` (étapes `- <créneau> · <label> — <détail>`, lignes-clés `- production:` / `- termine:`) + `### Micro-batch` (`- jour: quoi | détail`) + `### Réserve` (`- <jour|mel>: <plat> | <conservation>`))`.

5e. `ai/context/design-system.md` :

- Ajouter une section `## Icônes` :

```markdown
## Icônes

Jeu SVG maison via `src/components/Icon.tsx` (`<Icon name size strokeWidth?>`) — trait 2 px **sauf sous 16 px : 2,5** (calculé par le composant, les petits tracés tombaient sous ~1 px réel), `currentColor`, viewBox 24, `aria-hidden`. **Plancher 14 px** : aucune icône inline sous 14. Émojis réservés à l'onboarding et aux salutations. Le jeu inclut `pasta` (réserve du batch).
```

- Mettre à jour les lignes de composants modifiés : `.batch-banner` (« médaillon + texte centrés verticalement »), `.bud` (« carte surbrillance citron — payé en héros, phrase secondaire estimé/max, deux pills .bsoft 48 px »), `.lancer` → remplacer par `.lancer-btn` (« bouton .btn pleine largeur sous la timeline »), ajouter `.rituel-badge` (badge durée pointillé basilic), `.rituel-production`, `.reserve-*` (tuile 34 px surface-2 + icône 16 basilic), `.micro-jour-detail`.

5f. `CHANGELOG.md` — section `[Non publié]` :

```markdown
### Ajouté

- Batch : badge « ≈ durée » du rituel (calculé des créneaux), ligne production/conservation, section « La réserve — au frigo cette semaine », détails sur les cartes micro-batch, message de fin du mode guidé personnalisable (`- termine:`) — nouveaux champs optionnels du contrat .md (rétrocompatibles)
- Icône `pasta` du jeu SVG

### Modifié

- Carte « Budget courses » : habillage citron, « Payé cette semaine » en chiffre héros, estimé/max en phrase secondaire, actions en deux pills 48 px
- Icônes : taille plancher 14 px et trait renforcé (2,5 sous 16 px) — lisibilité en cuisine
- Batch : « Lancer le batch » devient un bouton pleine largeur sous la timeline ; titres « Rituel dimanche » / « Micro-batch en semaine » sans émoji ; bannières rituel/Ce soir centrées verticalement
```

- [ ] **Step 6: Full unit suite + typecheck + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/assets/semaine-exemple.md docs/templates/ README.md AGENTS.md ai/context/design-system.md CHANGELOG.md tests/parse.test.ts
git commit -m "docs: contrat .md v3 documenté (production/termine/détail/Réserve) + exemple enrichi"
```

---

### Task 7: e2e + gates finaux

**Files:**
- Modify: `tests/e2e/cuisine.spec.ts` (tests « carte budget » l. 115-140 et « batch » l. 140-172)
- Vérification: build + preview

- [ ] **Step 1: Update the e2e specs**

Dans `tests/e2e/cuisine.spec.ts` :

1. Test « batch : timeline du rituel (5 étapes) et carrousel micro-batch » — après l'assertion `.rituel-creneau` ajouter :

```ts
    await expect(page.locator('.rituel-badge')).toContainText('≈ 1 h');
    await expect(page.locator('.rituel-production')).toBeVisible();
    await expect(page.locator('.lancer-btn')).toBeVisible();
```

et remplacer la fin du parcours guidé :

```ts
    await page.getByRole('button', { name: 'Terminer le batch ✓' }).click();
    await expect(page.getByText('Batch terminé !')).toBeVisible();
    await page.getByRole('button', { name: 'Revoir l'aperçu' }).click();
```

Ajouter avant le parcours guidé :

```ts
    await expect(page.locator('.reserve-ligne')).toHaveCount(4);
    await expect(page.locator('.micro-jour-detail').first()).toBeVisible();
```

2. Test « carte budget + saisie d'une dépense → historique » — remplacer l'assertion du payé par le héros (le texte « 38,20 € » reste visible) :

```ts
    await expect(page.locator('.bud-hero')).toHaveText('38,20 €');
```

3. Dans la boucle `for (const largeur of [320, 375])` — rien à changer (les tests d'overflow couvrent déjà les 3 sous-onglets) ; lancer et vérifier.

- [ ] **Step 2: Run e2e (dev)**

Run: `npm run e2e`
Expected: PASS — zéro débordement 320/375 (les deux pills de `.bud-actions` se replient proprement grâce à `flex-wrap`)

- [ ] **Step 3: Build + preview + e2e sur le build de prod**

Run: `npm run build && npm run e2e:preview`
Expected: PASS

- [ ] **Step 4: Gates complets**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/cuisine.spec.ts
git commit -m "test: e2e batch (badge, production, réserve, Revoir l'aperçu) et budget héros"
```

---

## Auto-revue du plan (faite à l'écriture)

- **Couverture spec** : § 1 contrat (Task 2), § 2 UI batch (Task 4), § 3 budget (Task 5), § 4 icônes (Task 3), § 5 exemple/docs (Task 6), § 6 tests (TDD dans chaque task + Task 7 e2e), bannière centrée (Task 4 CSS), compteur head supprimé (Task 4), `.blink` retiré de la carte mais conservé pour le panneau (Task 5 CSS). Rien d'orphelin.
- **Invariants** : aucun id de coche modifié (tâches `- [ ]` et étapes rituel inchangées caractère pour caractère), aucune clé storage, `safeParse` intouché.
- **Cohérence types** : `ReserveLigne { cle, plat, conservation }` défini Task 2, consommé Tasks 1/4 ; `dureeRituel`/`iconeReserve` définis Task 1, consommés Task 4 ; `rituelProduction`/`rituelTermine` définis Task 2, consommés Tasks 4/6.
