# Plan — Menu par recettes (onglets + file de déjeuners dynamique)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la « réserve de recettes » (33 items à plat) par une navigation par onglets de recettes (7 dîners + 🍱 Déjeuners, aucun jour affiché), une fiche recette complète dans l'onglet, une coche unique par dîner (onglet grisé), et un onglet déjeuners dynamique où les boxes se débloquent quand leur recette source est cochée.

**Architecture:** Toute la logique (groupage en onglets, paires de déjeuners, disponibilité, sélection initiale) va dans un nouveau module pur `src/lib/menu.ts` (testé sans React). `MenuView.tsx` est réécrit en 3 sous-composants présentatifs (`TabBar` + `OngletRecette` + `FileDejeuners`) qui consomment le module. Les ids de coches ne changent pas → zéro migration. Le contrat .md est intact (les refs `→ slug` sont déjà parsées sur toutes les clés menu) ; la convention « mesures maison » vit dans le contenu (semaine-exemple, template, prompt IA, README).

**Tech Stack:** React 18 + TypeScript strict, CSS sémantique mono-fichier (tokens Herbes sur `:root`), vitest + Testing Library (happy-dom), Playwright (WebKit, projets mobile 375/320). TDD obligatoire (`npm run test:watch`).

**Spec:** `docs/superpowers/specs/2026-09-16-menu-par-recettes-design.md`

**Note d'exécution:** le travail se fait sur la branche courante du repo (pas de worktree : convention du repo). Le fix onboarding éventuellement présent dans le worktree n'est PAS concerné — ne jamais l'inclure dans un commit de ce plan (`git add` ciblé fichier par fichier).

---

### Task 1: Fix e2e budget rouge préexistant (prérequis)

Le test e2e « carte budget + saisie d'une dépense » échoue depuis que la semaine d'exemple S37 (2026-09-07 → 2026-09-13) a expiré : la dépense saisie par le test prend la date du jour (hors [du..au]) et n'entre plus dans le total payé. On rend le test stable en datant la saisie dans la semaine. Ce fix est indépendant du Menu — commit isolé, il rend les gates fiables pour la suite.

**Files:**
- Modify: `tests/e2e/cuisine.spec.ts:121-132`

- [ ] **Step 1: Vérifier le rouge**

```bash
npx playwright test tests/e2e/cuisine.spec.ts -g "carte budget"
```
Expected: FAIL — `getByText('73,30 €')` introuvable.

- [ ] **Step 2: Dater la saisie dans la semaine d'exemple**

Dans `tests/e2e/cuisine.spec.ts`, remplacer le bloc de saisie (lignes ~123-126) :

```ts
    await page.getByLabel('Total (€)').fill('35,10');
    await page.getByLabel('Date').fill('2026-09-10'); // ∈ S37 : la date du jour sortirait de [du..au] dès que la semaine d'exemple expire
    await page.getByLabel('Magasin').fill('Carrefour');
    await page.getByRole('button', { name: /Enregistrer/ }).click();
```

Et le commentaire au-dessus (lignes ~127-128) devient :

```ts
    // Deux magasins → deux lignes, aucun upsert croisé. La date est épinglée
    // dans la semaine d'exemple : le test reste stable toute l'année.
```

- [ ] **Step 3: Vérifier le vert**

```bash
npx playwright test tests/e2e/cuisine.spec.ts -g "carte budget"
```
Expected: PASS (2/2 projets).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/cuisine.spec.ts
git commit -m "test: e2e dépenses — date épinglée dans la semaine d'exemple (stable toute l'année)"
```

---

### Task 2: `src/lib/menu.ts` — `labelCourt` + `construireOnglets`

**Files:**
- Create: `src/lib/menu.ts`
- Test: `tests/menu.test.ts`

- [ ] **Step 1: Écrire le test (rouge)**

Créer `tests/menu.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import type { MenuDay, Recette } from '../src/lib/model';
import { construireOnglets, labelCourt } from '../src/lib/menu';

const RECETTE: Recette = {
  id: 'r1',
  nom: 'Poulet au four + riz',
  temps: '45 min · four 200°',
  kcal: 680,
  score: 7,
  fraicheur: 'batch dimanche → boîte frigo',
  pour: '6-8 cuisses · 250 g riz',
  bases: ['b4'],
  etapes: ['Four 200°.', 'Rôtir 40 min.'],
  portions: { marc: '1 poignée de riz (~150 g) · 2 cuisses', melanie: 'poulet ×2 (sans riz)' },
};

const MENU: MenuDay[] = [
  {
    jour: 'Lundi',
    dejeunerMarc: 'Boîte poulet-riz',
    dejeunerMelanie: 'Restes poulet',
    dinerFamille: 'Poulet au four + riz',
    dinerMelanie: 'Poulet + légumes (sans riz)',
    batch: 'Double riz → boîte mardi',
    recetteRefs: { dinerFamille: 'R1', dejeunerMarc: 'R1', dejeunerMelanie: 'R1' },
  },
  { jour: 'Mardi', dejeunerMarc: 'Boîte poulet-riz (lun)', recetteRefs: { dejeunerMarc: 'R1' } },
  { jour: 'Mercredi', dinerFamille: 'Omelette + salade' },
];

describe('menu — labelCourt', () => {
  it('garde le premier segment avant séparateur (+ · —)', () => {
    expect(labelCourt('Poulet au four + riz')).toBe('Poulet au four');
    expect(labelCourt('Omelette + salade')).toBe('Omelette');
    expect(labelCourt('Rôti de dinde + gratin de courgettes + quinoa')).toBe('Rôti de dinde');
  });

  it('tronque les noms longs sur une borne de mot (espace ou tiret)', () => {
    expect(labelCourt('Cuisses de poulet rôties + légumes + riz')).toBe('Cuisses de poulet…');
    expect(labelCourt('Omelette fromage-jambon + pommes vapeur')).toBe('Omelette fromage…');
    expect(labelCourt('Soupe butternut-carotte + tartines')).toBe('Soupe butternut…');
  });
});

describe('menu — construireOnglets', () => {
  it('un onglet par jour qui a un dîner, dans l ordre du fichier', () => {
    const onglets = construireOnglets(MENU, [RECETTE]);
    expect(onglets).toHaveLength(2); // mardi (déjeuner seul) et jeudi n ouvrent pas d onglet
    expect(onglets[0].jour).toBe('Lundi');
    expect(onglets[1].jour).toBe('Mercredi');
  });

  it('la coche de l onglet = dinerFamille, le label = nom court de la recette', () => {
    const [lundi] = construireOnglets(MENU, [RECETTE]);
    expect(lundi.cleCoche).toBe('menu:lundi:dinerFamille');
    expect(lundi.label).toBe('Poulet au four');
    expect(lundi.recette?.id).toBe('r1');
    expect(lundi.diner?.id).toBe('menu:lundi:dinerFamille');
    expect(lundi.mel?.texte).toBe('Poulet + légumes (sans riz)');
    expect(lundi.batch?.texte).toBe('Double riz → boîte mardi');
  });

  it('jour sans recette : label = dîner tronqué, coche en repli sur dinerMelanie si pas de dinerFamille', () => {
    const [, mercredi] = construireOnglets(MENU, [RECETTE]);
    expect(mercredi.label).toBe('Omelette');
    expect(mercredi.recette).toBeUndefined();

    const repli = construireOnglets(
      [{ jour: 'Vendredi', dinerMelanie: 'Bowl saumon + avocat' }],
      [],
    );
    expect(repli[0].cleCoche).toBe('menu:vendredi:dinerMelanie');
    expect(repli[0].label).toBe('Bowl saumon');
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

```bash
npm test -- tests/menu.test.ts
```
Expected: FAIL — `Cannot find module '../src/lib/menu'`.

- [ ] **Step 3: Implémenter le minimum**

Créer `src/lib/menu.ts` :

```ts
import type { BaseCuisine, MealKey, MenuDay, Recette } from './model';
import { recetteParRef, trouverJourDuJour } from './stats';

// Tags de profil par clé repas (identiques à l'ancienne MenuView).
const MEALS: Array<[MealKey, string, string]> = [
  ['dejeunerMarc', 'Marc', 'tag-marc'],
  ['dejeunerMelanie', 'Mél', 'tag-mel'],
  ['dinerFamille', 'Famille', 'tag-fam'],
  ['dinerMelanie', 'Mél', 'tag-mel'],
  ['batch', 'Batch', 'tag-bat'],
];

export interface Occurrence {
  id: string;
  jour: string;
  cle: MealKey;
  tag: string;
  tagClass: string;
  texte: string;
  ref?: string;
  recette?: Recette;
}

const occurrence = (day: MenuDay, cle: MealKey, recettes: Recette[]): Occurrence | null => {
  const texte = day[cle];
  if (!texte) return null;
  const meta = MEALS.find(([k]) => k === cle)!;
  const ref = day.recetteRefs?.[cle];
  return {
    id: `menu:${day.jour.trim().toLowerCase()}:${cle}`,
    jour: day.jour,
    cle,
    tag: meta[1],
    tagClass: meta[2],
    texte,
    ...(ref ? { ref, recette: recetteParRef(ref, recettes) } : {}),
  };
};

// Nom court pour une pill : premier segment avant [+·—], tronqué sur une borne
// de mot (espace ou tiret) à ~18 caractères.
export const labelCourt = (texte: string): string => {
  const segment = (texte.split(/\s*[+·—]\s*/)[0] ?? texte).trim();
  if (segment.length <= 18) return segment;
  const coupe = segment.slice(0, 18);
  const borne = Math.max(coupe.lastIndexOf(' '), coupe.lastIndexOf('-'));
  return (borne > 6 ? coupe.slice(0, borne) : segment.slice(0, 15)) + '…';
};

export interface OngletDiner {
  jour: string;
  cleCoche: string; // id de coche du dîner (dinerFamille, repli dinerMelanie)
  label: string;
  diner?: Occurrence;
  mel?: Occurrence;
  batch?: Occurrence;
  recette?: Recette;
}

export function construireOnglets(menu: MenuDay[], recettes: Recette[]): OngletDiner[] {
  const onglets: OngletDiner[] = [];
  for (const day of menu) {
    const diner = occurrence(day, 'dinerFamille', recettes) ?? undefined;
    const mel = occurrence(day, 'dinerMelanie', recettes) ?? undefined;
    const batch = occurrence(day, 'batch', recettes) ?? undefined;
    if (!diner && !mel) continue;
    const recette = diner?.recette ?? mel?.recette;
    const base = diner ?? mel!;
    onglets.push({
      jour: day.jour,
      cleCoche: `menu:${day.jour.trim().toLowerCase()}:${diner ? 'dinerFamille' : 'dinerMelanie'}`,
      label: labelCourt(recette?.nom ?? base.texte),
      ...(diner && { diner }),
      ...(mel && { mel }),
      ...(batch && { batch }),
      ...(recette && { recette }),
    });
  }
  return onglets;
}
```

- [ ] **Step 4: Vérifier le vert**

```bash
npm test -- tests/menu.test.ts
```
Expected: PASS (tous les tests du fichier).

- [ ] **Step 5: Commit**

```bash
git add src/lib/menu.ts tests/menu.test.ts
git commit -m "feat: lib menu — onglets par recette et labels courts"
```

---

### Task 3: `src/lib/menu.ts` — paires de déjeuners + disponibilité + sélection initiale

**Files:**
- Modify: `src/lib/menu.ts`
- Test: `tests/menu.test.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/menu.test.ts`, fusionner l'import vitest existant avec `vi`, remplacer l'import du module `../src/lib/menu` par la version complète, et remplacer la déclaration `const MENU` (ajoute le jeudi sans ref) :

```ts
import { describe, expect, it, vi } from 'vitest';
import type { MenuDay, Recette } from '../src/lib/model';
import {
  construireOnglets,
  construirePaires,
  debloquePar,
  faitsParRecette,
  labelCourt,
  paireFaite,
  pairePrete,
  selectionInitiale,
} from '../src/lib/menu';

const MENU: MenuDay[] = [
  {
    jour: 'Lundi',
    dejeunerMarc: 'Boîte poulet-riz',
    dejeunerMelanie: 'Restes poulet',
    dinerFamille: 'Poulet au four + riz',
    dinerMelanie: 'Poulet + légumes (sans riz)',
    batch: 'Double riz → boîte mardi',
    recetteRefs: { dinerFamille: 'R1', dejeunerMarc: 'R1', dejeunerMelanie: 'R1' },
  },
  { jour: 'Mardi', dejeunerMarc: 'Boîte poulet-riz (lun)', recetteRefs: { dejeunerMarc: 'R1' } },
  { jour: 'Mercredi', dinerFamille: 'Omelette + salade' },
  { jour: 'Jeudi', dejeunerMarc: 'Restes ou wrap' },
];
```

Puis les nouveaux tests (à ajouter à la fin du fichier) :

```ts
describe('menu — paires de déjeuners', () => {
  const paires = construirePaires(MENU, [RECETTE]);

  it('une paire par jour qui a au moins un déjeuner, dans l ordre du fichier', () => {
    expect(paires).toHaveLength(3); // lundi, mardi, jeudi — mercredi n a pas de déjeuner
    expect(paires[0].ids).toEqual(['menu:lundi:dejeunerMarc', 'menu:lundi:dejeunerMelanie']);
    expect(paires[1].ids).toEqual(['menu:mardi:dejeunerMarc']); // une seule ligne
    expect(paires[2].ids).toEqual(['menu:jeudi:dejeunerMarc']);
  });

  it('pairePrete : ref débloquée par le dîner de la recette source, sans ref = toujours prête', () => {
    const faits = faitsParRecette(MENU);
    expect(faits['R1']).toEqual(['menu:lundi:dinerFamille']); // seul dinerFamille réalise R1
    expect(pairePrete(paires[0], {}, faits)).toBe(false); // lundi ← R1 pas fait
    expect(pairePrete(paires[0], { 'menu:lundi:dinerFamille': true }, faits)).toBe(true);
    expect(pairePrete(paires[1], { 'menu:lundi:dinerFamille': true }, faits)).toBe(true);
    expect(pairePrete(paires[2], {}, faits)).toBe(true); // jeudi sans ref : toujours prête
  });

  it('paireFaite : toutes les lignes de la paire cochées', () => {
    expect(paireFaite(paires[0], {})).toBe(false);
    expect(
      paireFaite(paires[0], {
        'menu:lundi:dejeunerMarc': true,
        'menu:lundi:dejeunerMelanie': true,
      }),
    ).toBe(true);
    expect(paireFaite(paires[1], { 'menu:mardi:dejeunerMarc': true })).toBe(true);
  });

  it('debloquePar : le nom court de la recette manquante, null sinon', () => {
    const faits = faitsParRecette(MENU);
    expect(debloquePar(paires[0], {}, faits)).toBe('Poulet au four');
    expect(debloquePar(paires[0], { 'menu:lundi:dinerFamille': true }, faits)).toBeNull();
    expect(debloquePar(paires[2], {}, faits)).toBeNull();
  });

  it('ref cassée : la note retombe sur la ref brute (jamais de crash)', () => {
    const pairesRc = construirePaires(
      [{ jour: 'Vendredi', dejeunerMarc: 'Box mystère', recetteRefs: { dejeunerMarc: 'R99' } }],
      [RECETTE],
    );
    expect(debloquePar(pairesRc[0], {}, faitsParRecette(
      [{ jour: 'Vendredi', dejeunerMarc: 'Box mystère', recetteRefs: { dejeunerMarc: 'R99' } }],
    ))).toBe('R99');
  });
});

describe('menu — selectionInitiale', () => {
  it('jour courant présélectionné (mercredi → Omelette)', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // mercredi
    const onglets = construireOnglets(MENU, [RECETTE]);
    expect(selectionInitiale(onglets, MENU, {})).toBe(1);
  });

  it('hors menu : premier onglet non fait, sinon le premier', () => {
    vi.setSystemTime(new Date('2026-09-11T10:00:00')); // vendredi, absent du menu
    const onglets = construireOnglets(MENU, [RECETTE]);
    expect(selectionInitiale(onglets, MENU, {})).toBe(0);
    expect(
      selectionInitiale(onglets, MENU, {
        'menu:lundi:dinerFamille': true,
        'menu:mercredi:dinerFamille': true,
      }),
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

```bash
npm test -- tests/menu.test.ts
```
Expected: FAIL — `construirePaires` n'est pas exporté.

- [ ] **Step 3: Implémenter**

Ajouter à `src/lib/menu.ts` (et compléter l'import existant de `stats` — `trouverJourDuJour` est déjà importé) :

```ts
export interface PaireDejeuners {
  jour: string;
  ids: string[]; // toutes les clés déjeuner présentes ce jour
  lignes: Occurrence[];
}

export function construirePaires(menu: MenuDay[], recettes: Recette[]): PaireDejeuners[] {
  const paires: PaireDejeuners[] = [];
  for (const day of menu) {
    const lignes = [
      occurrence(day, 'dejeunerMarc', recettes),
      occurrence(day, 'dejeunerMelanie', recettes),
    ].filter((o): o is Occurrence => o !== null);
    if (lignes.length === 0) continue;
    paires.push({ jour: day.jour, ids: lignes.map((l) => l.id), lignes });
  }
  return paires;
}

// ref de recette → ids de coches « dîner » qui la réalisent (dinerFamille OU
// dinerMelanie). Les refs déjeuner sont les consommatrices, jamais les sources.
export const faitsParRecette = (menu: MenuDay[]): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const day of menu) {
    const j = day.jour.trim().toLowerCase();
    for (const cle of ['dinerFamille', 'dinerMelanie'] as const) {
      const ref = day.recetteRefs?.[cle];
      if (!ref) continue;
      (out[ref] ??= []).push(`menu:${j}:${cle}`);
    }
  }
  return out;
};

export const pairePrete = (
  paire: PaireDejeuners,
  checks: Record<string, boolean>,
  faits: Record<string, string[]>,
): boolean => paire.lignes.every((l) => !l.ref || (faits[l.ref] ?? []).some((id) => checks[id]));

export const paireFaite = (paire: PaireDejeuners, checks: Record<string, boolean>): boolean =>
  paire.ids.every((id) => checks[id]);

// Nom court de la recette qui bloque la paire (« débloquée quand … est fait »),
// null si déjà prête. Une ref cassée retombe sur la ref brute.
export const debloquePar = (
  paire: PaireDejeuners,
  checks: Record<string, boolean>,
  faits: Record<string, string[]>,
): string | null => {
  const bloque = paire.lignes.find(
    (l) => l.ref && !(faits[l.ref] ?? []).some((id) => checks[id]),
  );
  if (!bloque?.ref) return null;
  return bloque.recette ? labelCourt(bloque.recette.nom) : bloque.ref;
};

// Onglet ouvert à l'arrivée : celui du jour courant (le jour n'est jamais
// affiché), repli = premier onglet non fait, dernier repli = le premier.
export const selectionInitiale = (
  onglets: OngletDiner[],
  menu: MenuDay[],
  checks: Record<string, boolean>,
): number => {
  const jourDuJour = trouverJourDuJour(menu)?.jour.trim().toLowerCase();
  const idxJour = onglets.findIndex((o) => o.jour.trim().toLowerCase() === jourDuJour);
  if (idxJour >= 0) return idxJour;
  const idxLibre = onglets.findIndex((o) => !checks[o.cleCoche]);
  return idxLibre >= 0 ? idxLibre : 0;
};
```

- [ ] **Step 4: Vérifier le vert**

```bash
npm test -- tests/menu.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/menu.ts tests/menu.test.ts
git commit -m "feat: lib menu — paires de déjeuners dynamiques et sélection initiale"
```

---

### Task 4: Icône `lock` (Icon.tsx)

**Files:**
- Modify: `src/components/Icon.tsx`

- [ ] **Step 1: Ajouter l'icône**

Dans `ICONES` de `src/components/Icon.tsx`, ajouter après l'entrée `plus:` :

```ts
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
    </>
  ),
```

- [ ] **Step 2: Vérifier**

```bash
npm test -- tests/components.test.tsx && npm run typecheck
```
Expected: PASS (l'icône est typée par `satisfies Record<string, ReactNode>`, aucun test ne casse).

- [ ] **Step 3: Commit**

```bash
git add src/components/Icon.tsx
git commit -m "feat: icône lock (notes de déblocage des boxes)"
```

---

### Task 5: `MenuView.tsx` v3 — réécriture complète + tests

**Files:**
- Modify: `src/components/cuisine/MenuView.tsx` (réécriture intégrale)
- Modify: `tests/components.test.tsx` (le describe `MenuView v2 — réserve de recettes` est remplacé par `MenuView v3 — onglets par recette`)
- Modify: `tests/app.test.tsx:205-206`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/components.test.tsx`, ajouter en haut les imports manquants (`MenuDay`, `Recette` au bloc `import type { ... } from '../src/lib/model'`) puis **remplacer tout le describe `MenuView v2 — réserve de recettes`** (lignes 542-631) par :

```tsx
describe('MenuView v3 — onglets par recette', () => {
  const RECETTE: Recette = {
    id: 'r1',
    nom: 'Poulet au four + riz',
    temps: '45 min · four 200°',
    kcal: 680,
    score: 7,
    fraicheur: 'batch dimanche → boîte frigo',
    pour: '6-8 cuisses · 250 g riz',
    bases: ['b4'],
    etapes: ['Four 200°.', 'Rôtir 40 min.'],
    portions: { marc: '1 poignée de riz (~150 g) · 2 cuisses', melanie: 'poulet ×2 (sans riz)' },
    mel: 'KETO-RECETTE-INFO',
    batch: 'BATCH-RECETTE-INFO',
  };
  const MENU: MenuDay[] = [
    {
      jour: 'Lundi',
      dejeunerMarc: 'Boîte poulet-riz',
      dejeunerMelanie: 'Restes poulet',
      dinerFamille: 'Poulet au four + riz',
      dinerMelanie: 'Poulet + légumes (sans riz)',
      batch: 'Double riz → boîte mardi',
      recetteRefs: { dinerFamille: 'R1', dejeunerMarc: 'R1', dejeunerMelanie: 'R1' },
    },
    { jour: 'Mardi', dejeunerMarc: 'Boîte poulet-riz (lun)', recetteRefs: { dejeunerMarc: 'R1' } },
    { jour: 'Mercredi', dinerFamille: 'Omelette + salade' },
    { jour: 'Jeudi', dejeunerMarc: 'Restes ou wrap' },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('barre : pills de recettes sans jours + onglet Déjeuners, actif = jour courant, progression Dîners/Boxes', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // mercredi
    const { container } = render(
      <MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />,
    );
    const pills = container.querySelectorAll('.rtab');
    expect(pills).toHaveLength(3); // 2 recettes (mardi/jeudi sans dîner) + 🍱 Déjeuners
    expect(pills[0].textContent).toContain('Poulet au four');
    expect(pills[0].textContent).not.toMatch(/lundi/i);
    expect(pills[2].textContent).toContain('Déjeuners');
    expect(container.querySelector('.rtab.active')).toHaveTextContent('Omelette');
    expect(document.querySelector('.menu-progress')).toHaveTextContent('Dîners 0/2');
    expect(document.querySelector('.menu-progress')).toHaveTextContent('Boxes 0/3');
  });

  it('onglet recette : meta, qui mange quoi, portions, préparation, batch associé — sans duplication recette', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    const { container } = render(
      <MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />,
    );
    await user.click(screen.getByRole('tab', { name: /Poulet au four/ }));
    expect(screen.getByText('Qui mange quoi')).toBeInTheDocument();
    expect(screen.getByText('Poulet + légumes (sans riz)')).toBeInTheDocument();
    expect(screen.getByText('Portions — par personne')).toBeInTheDocument();
    expect(screen.getByText(/1 poignée de riz \(~150 g\) · 2 cuisses/)).toBeInTheDocument();
    expect(screen.getByText('Préparation')).toBeInTheDocument();
    expect(screen.getByText('Four 200°.')).toBeInTheDocument();
    expect(screen.getByText('Batch associé')).toBeInTheDocument();
    expect(screen.getByText('Double riz → boîte mardi')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('680 kcal')).toBeInTheDocument();
    expect(screen.getByText(/Score 7\/10/)).toBeInTheDocument();
    expect(screen.getByText(/batch dimanche → boîte frigo/)).toBeInTheDocument();
    // Anti-duplication : les lignes mel:/batch: de la recette sont masquées
    // (le menu du jour est prioritaire).
    expect(screen.queryByText('KETO-RECETTE-INFO')).not.toBeInTheDocument();
    expect(screen.queryByText('BATCH-RECETTE-INFO')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.rtab')[0].textContent).not.toMatch(/lundi/i);
  });

  it('coche unique du dîner : CTA, pill grisée barrée, persistance, annulable', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    const { container } = render(
      <MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />,
    );
    await user.click(screen.getByRole('tab', { name: /Poulet au four/ }));
    await user.click(screen.getByRole('button', { name: /C'est fait — dîner fini/ }));
    expect(
      JSON.parse(localStorage.getItem('sportapp:checks:2026-S40')!)['menu:lundi:dinerFamille'],
    ).toBe(true);
    expect(container.querySelectorAll('.rtab')[0]).toHaveClass('fait');
    const onglet = document.querySelector('.onglet-recette');
    expect(onglet).toHaveClass('fait');
    await user.click(screen.getByRole('button', { name: /Dîner fait ✓ — annuler/ }));
    expect(onglet).not.toHaveClass('fait');
    expect(container.querySelectorAll('.rtab')[0]).not.toHaveClass('fait');
    expect(
      JSON.parse(localStorage.getItem('sportapp:checks:2026-S40')!)['menu:lundi:dinerFamille'],
    ).toBe(false);
  });

  it('file déjeuners : verrouillée avec note, prête après le dîner, coche paire = 2 ids, mangées barrées', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    render(<MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />);
    await user.click(screen.getByRole('tab', { name: /Déjeuners/ }));

    // R1 pas fait : lundi + mardi verrouillées, jeudi (sans ref) prête.
    expect(screen.getByText('À venir')).toBeInTheDocument();
    expect(screen.getAllByText(/débloquée quand Poulet au four est fait/)).toHaveLength(2);
    expect(screen.getByText('Prêtes à emporter')).toBeInTheDocument();
    expect(screen.getByText('Restes ou wrap')).toBeInTheDocument();

    // On coche le dîner R1 → les paires lundi/mardi deviennent prêtes.
    await user.click(screen.getByRole('tab', { name: /Poulet au four/ }));
    await user.click(screen.getByRole('button', { name: /C'est fait — dîner fini/ }));
    await user.click(screen.getByRole('tab', { name: /Déjeuners/ }));
    expect(screen.getAllByText(/débloquée quand/)).toHaveLength(0);

    // Coche de la première paire prête (lundi) : les 2 ids partent en storage.
    await user.click(screen.getAllByRole('button', { name: /Boxes faites/ })[0]);
    const checks = JSON.parse(localStorage.getItem('sportapp:checks:2026-S40')!);
    expect(checks['menu:lundi:dejeunerMarc']).toBe(true);
    expect(checks['menu:lundi:dejeunerMelanie']).toBe(true);
    expect(checks['menu:mardi:dejeunerMarc']).toBeUndefined();
    expect(document.querySelector('.menu-progress')).toHaveTextContent('Boxes 1/3');
    expect(screen.getByText('Mangées')).toBeInTheDocument();
    expect(document.querySelector('.box-pair.mangees')).not.toBeNull();
  });

  it('paire sans ref jamais verrouillée, paire à une ligne cochable seule', async () => {
    const user = userEvent.setup();
    render(<MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />);
    await user.click(screen.getByRole('tab', { name: /Déjeuners/ }));
    expect(screen.getByText('Restes ou wrap')).toBeInTheDocument(); // jeudi : prête d'emblée
    await user.click(screen.getByRole('button', { name: /Boxes faites/ }));
    const checks = JSON.parse(localStorage.getItem('sportapp:checks:2026-S40')!);
    expect(checks['menu:jeudi:dejeunerMarc']).toBe(true); // coche seule, pas de melanie
  });

  it('menu vide : état vide', () => {
    render(<MenuView menu={[]} recettes={[]} semaine="2026-S40" />);
    expect(screen.getByText('Aucun menu pour cette semaine.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

```bash
npm test -- tests/components.test.tsx
```
Expected: FAIL — les nouveaux tests échouent (l'UI affiche encore la réserve 33 items) ET les anciens tests du describe supprimé n'existent plus.

- [ ] **Step 3: Réécrire `MenuView.tsx` intégralement**

Remplacer tout le contenu de `src/components/cuisine/MenuView.tsx` par :

```tsx
import { useState } from 'react';
import type { BaseCuisine, MenuDay, Recette } from '../../lib/model';
import {
  construireOnglets,
  construirePaires,
  debloquePar,
  faitsParRecette,
  paireFaite,
  pairePrete,
  selectionInitiale,
} from '../../lib/menu';
import type { OngletDiner, PaireDejeuners } from '../../lib/menu';
import { getChecks, setCheck } from '../../lib/storage';
import { Icon } from '../Icon';

// Menu v3 : 1 onglet par recette/dîner + 🍱 Déjeuners (file dynamique).
// Aucun jour affiché — l'ordre du fichier est l'ordre conseillé
// (batch/frigo d'abord, frais ensuite). Logique dans src/lib/menu.ts.
export function MenuView({
  menu,
  recettes = [],
  bases = [],
  semaine,
}: {
  menu: MenuDay[];
  recettes?: Recette[];
  bases?: BaseCuisine[];
  semaine: string;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  const onglets = construireOnglets(menu, recettes);
  const paires = construirePaires(menu, recettes);
  const faits = faitsParRecette(menu);

  // Pattern render-phase reset (syncedSemaine) — cf. Checklist.tsx.
  const [syncedSemaine, setSyncedSemaine] = useState(semaine);
  const [actif, setActif] = useState(() => selectionInitiale(onglets, menu, checks));
  if (syncedSemaine !== semaine) {
    setSyncedSemaine(semaine);
    setChecks(getChecks(semaine));
    setActif(selectionInitiale(onglets, menu, getChecks(semaine)));
  }

  if (onglets.length === 0 && paires.length === 0) {
    return <p className="muted">Aucun menu pour cette semaine.</p>;
  }

  const basculerDiner = (onglet: OngletDiner) => {
    const next = !checks[onglet.cleCoche];
    setCheck(semaine, onglet.cleCoche, next);
    setChecks((prev) => ({ ...prev, [onglet.cleCoche]: next }));
  };

  // Une action par paire : coche toutes les clés déjeuner présentes ce jour-là.
  const basculerPaire = (paire: PaireDejeuners) => {
    const cible = !paireFaite(paire, checks);
    const next = { ...checks };
    for (const id of paire.ids) {
      setCheck(semaine, id, cible);
      next[id] = cible;
    }
    setChecks(next);
  };

  const dFaites = onglets.filter((o) => checks[o.cleCoche]).length;
  const bFaites = paires.filter((p) => paireFaite(p, checks)).length;
  const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

  return (
    <div className="menu-recettes">
      <div className="menu-head">
        <p className="menu-progress">
          Dîners {dFaites}/{onglets.length}{' '}
          <span className="bar">
            <i style={{ width: pct(dFaites, onglets.length) }} />
          </span>
          <span>
            · Boxes {bFaites}/{paires.length}{' '}
            <span className="bar">
              <i style={{ width: pct(bFaites, paires.length) }} />
            </span>
          </span>
        </p>
      </div>
      <div className="rtabs" role="tablist" aria-label="Recettes du menu">
        {onglets.map((o, i) => (
          <button
            key={o.cleCoche}
            type="button"
            role="tab"
            aria-selected={i === actif}
            className={`rtab${i === actif ? ' active' : ''}${checks[o.cleCoche] ? ' fait' : ''}`}
            onClick={() => setActif(i)}
          >
            {checks[o.cleCoche] && (
              <span className="tick" aria-hidden="true">
                <Icon name="check" size={12} strokeWidth={3} />
              </span>
            )}
            <span className="rn">{o.label}</span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={actif === onglets.length}
          className={`rtab${actif === onglets.length ? ' active' : ''}`}
          onClick={() => setActif(onglets.length)}
        >
          <span className="rn">🍱 Déjeuners</span>
        </button>
      </div>
      {actif === onglets.length ? (
        <FileDejeuners paires={paires} checks={checks} faits={faits} onBasculer={basculerPaire} />
      ) : (
        onglets[actif] && (
          <OngletRecette
            onglet={onglets[actif]}
            bases={bases}
            fait={!!checks[onglets[actif].cleCoche]}
            onBasculer={() => basculerDiner(onglets[actif])}
          />
        )
      )}
    </div>
  );
}

function OngletRecette({
  onglet,
  bases,
  fait,
  onBasculer,
}: {
  onglet: OngletDiner;
  bases?: BaseCuisine[];
  fait: boolean;
  onBasculer: () => void;
}) {
  const r = onglet.recette;
  return (
    <article className={fait ? 'onglet-recette fait' : 'onglet-recette'} aria-label={onglet.label}>
      {r && (
        <div className="onglet-meta">
          <div className="meta-row">
            {r.temps && (
              <span className="meta-pill">
                <Icon name="clock" size={12} /> {r.temps.split('·')[0]?.trim()}
              </span>
            )}
            {r.kcal != null && (
              <span className="meta-pill">
                <Icon name="flame" size={12} /> {r.kcal} kcal
              </span>
            )}
            {r.score != null && (
              <span className="meta-pill">
                Score {r.score}/10
                <span className="score-bar">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={i < r.score! ? 'score-seg on' : 'score-seg'} />
                  ))}
                </span>
              </span>
            )}
          </div>
          {r.fraicheur && (
            <p className="fraicheur">
              <Icon name="box" size={12} /> {r.fraicheur}
            </p>
          )}
        </div>
      )}
      {(onglet.diner || onglet.mel) && (
        <div className="qui">
          <p className="qui-titre">Qui mange quoi</p>
          {onglet.diner && (
            <p>
              <span className={`mtag ${onglet.diner.tagClass}`}>{onglet.diner.tag}</span>{' '}
              {onglet.diner.texte}
            </p>
          )}
          {onglet.mel && (
            <p>
              <span className={`mtag ${onglet.mel.tagClass}`}>{onglet.mel.tag}</span>{' '}
              {onglet.mel.texte}
            </p>
          )}
        </div>
      )}
      {r?.portions && (r.portions.marc || r.portions.melanie) && (
        <div className="portions">
          <p className="portions-titre">Portions — par personne</p>
          {r.portions.marc && (
            <p>
              <span className="mtag tag-marc">Marc</span> {r.portions.marc}
            </p>
          )}
          {r.portions.melanie && (
            <p>
              <span className="mtag tag-mel">Mél</span> {r.portions.melanie}
            </p>
          )}
        </div>
      )}
      {r && (r.pour || (r.etapes && r.etapes.length > 0)) && (
        <div className="onglet-prepa">
          <h4>Préparation</h4>
          {r.pour && <p className="recette-pour">{r.pour}</p>}
          {r.bases && r.bases.length > 0 && <BasesChips refs={r.bases} bases={bases} />}
          {r.etapes && r.etapes.length > 0 && (
            <ol className="recette-etapes">
              {r.etapes.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      {onglet.batch && (
        <div className="onglet-batch">
          <h4>Batch associé</h4>
          <div className="bat">
            <span className="mtag tag-bat">Batch</span>
            <span>{onglet.batch.texte}</span>
          </div>
        </div>
      )}
      <button
        type="button"
        className={fait ? 'cta done' : 'cta'}
        aria-pressed={fait}
        onClick={onBasculer}
      >
        {fait ? (
          <>Dîner fait ✓ — annuler</>
        ) : (
          <>
            <Icon name="check" size={15} strokeWidth={2.5} /> C'est fait — dîner fini
          </>
        )}
      </button>
    </article>
  );
}

function BasesChips({ refs, bases }: { refs: string[]; bases?: BaseCuisine[] }) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const liste = refs.map((ref) => trouverBase(ref, bases)).filter((b): b is BaseCuisine => !!b);
  const affichees =
    liste.length > 0 ? liste : [{ id: 'cuisson-du-jour', nom: 'Cuisson du jour', texte: '' }];
  return (
    <div className="recette-bases">
      {affichees.map((b) => (
        <button
          type="button"
          key={b.id}
          className={ouverte === b.id ? 'recette-bchip on' : 'recette-bchip'}
          aria-expanded={ouverte === b.id}
          onClick={() => setOuverte(ouverte === b.id ? null : b.id)}
        >
          🧂 {b.nom}
        </button>
      ))}
      {ouverte &&
        affichees
          .filter((b) => b.id === ouverte && b.texte)
          .map((b) => (
            <p className="recette-bdesc" key={b.id}>
              🧂 {b.nom} : {b.texte}
            </p>
          ))}
    </div>
  );
}

function FileDejeuners({
  paires,
  checks,
  faits,
  onBasculer,
}: {
  paires: PaireDejeuners[];
  checks: Record<string, boolean>;
  faits: Record<string, string[]>;
  onBasculer: (paire: PaireDejeuners) => void;
}) {
  if (paires.length === 0) {
    return <p className="muted">Aucun déjeuner dans cette semaine.</p>;
  }
  const pretes = paires.filter((p) => !paireFaite(p, checks) && pairePrete(p, checks, faits));
  const aVenir = paires.filter((p) => !paireFaite(p, checks) && !pairePrete(p, checks, faits));
  const mangees = paires.filter((p) => paireFaite(p, checks));
  return (
    <div className="file-dejeuners">
      {pretes.length > 0 && (
        <>
          <p className="fhead">Prêtes à emporter</p>
          {pretes.map((p) => (
            <div className="box-pair" key={p.jour}>
              {p.lignes.map((l) => (
                <p key={l.id}>
                  <span className={`mtag ${l.tagClass}`}>{l.tag}</span> {l.texte}
                </p>
              ))}
              <button type="button" className="mini-cta" onClick={() => onBasculer(p)}>
                <Icon name="check" size={13} strokeWidth={2.5} /> Boxes faites
              </button>
            </div>
          ))}
        </>
      )}
      {aVenir.length > 0 && (
        <>
          <p className="fhead">À venir</p>
          {aVenir.map((p) => {
            const manque = debloquePar(p, checks, faits);
            return (
              <div className="box-pair locked" key={p.jour}>
                {p.lignes.map((l) => (
                  <p key={l.id}>
                    <span className={`mtag ${l.tagClass}`}>{l.tag}</span> {l.texte}
                  </p>
                ))}
                {manque && (
                  <p className="lock-note">
                    <Icon name="lock" size={11} /> débloquée quand <b>&nbsp;{manque}&nbsp;</b> est
                    fait
                  </p>
                )}
              </div>
            );
          })}
        </>
      )}
      {mangees.length > 0 && (
        <>
          <p className="fhead">Mangées</p>
          {mangees.map((p) => (
            <div className="box-pair mangees" key={p.jour}>
              {p.lignes.map((l) => (
                <p key={l.id}>
                  <span className={`mtag ${l.tagClass}`}>{l.tag}</span> {l.texte}
                </p>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function trouverBase(ref: string, bases: BaseCuisine[] | undefined): BaseCuisine | undefined {
  if (!bases) return undefined;
  const cible = ref.toLowerCase();
  // égalité exacte d'abord, puis préfixe borné (`b4` ne doit pas matcher `b40-…`)
  return bases.find((b) => b.id === cible) ?? bases.find((b) => b.id.startsWith(`${cible}-`));
}
```

- [ ] **Step 4: Corriger les consommateurs existants**

Dans `tests/components.test.tsx`, vérifier le bloc `import type` en tête : ajouter `MenuDay` et `Recette` s'ils manquent :

```tsx
import type {
  ChecklistItem,
  CourseItem,
  DepenseEntry,
  MenuDay,
  ProfileData,
  Recette,
  UserProfile,
  WeeklyData,
} from '../src/lib/model';
```

Dans `tests/app.test.tsx` (test « navigue entre Cuisine et Mon suivi »), remplacer les lignes 205-206 :

```tsx
    expect(document.querySelector('.menu-card')).not.toBeNull();
    expect(screen.getByText('Poulet rôti')).toBeInTheDocument(); // diner-famille lundi en carte v2
```

par :

```tsx
    expect(document.querySelector('.rtab')).not.toBeNull();
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Poulet rôti');
```

- [ ] **Step 5: Vérifier le vert**

```bash
npm test
```
Expected: PASS (343 - anciens tests menu + nouveaux tests v3). Si un test v3 échoue sur un texte d'accessibilité, vérifier que le `name` du rôle correspond au contenu textuel de la pill/du bouton.

- [ ] **Step 6: Commit**

```bash
git add src/components/cuisine/MenuView.tsx tests/components.test.tsx tests/app.test.tsx
git commit -m "feat: MenuView v3 — onglets par recette, coche dîner, file de déjeuners dynamique"
```

---

### Task 6: CSS — styles du Menu v3

**Files:**
- Modify: `src/index.css` (remplace le bloc `/* ---------- Progression ---------- */` + ajoute une section Menu v3)

- [ ] **Step 1: Remplacer le bloc « Progression » (`.progress` + `progress`) par les styles Menu v3**

Dans `src/index.css`, remplacer tout le bloc `/* ---------- Progression ---------- */` (de `/* ---------- Progression ---------- */` jusqu'avant `/* ---------- Onboarding ---------- */` environ — la règle `.progress { … }` et `progress { … }` qui la suit) par :

```css
/* ---------- Menu v3 (onglets par recette) ---------- */

.menu-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.menu-progress {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  /* Compteur sur --bg : le muted seul descend à 3,99:1 — mix pour passer ≥ 4,5:1. */
  color: color-mix(in srgb, var(--muted) 70%, var(--text));
  font-size: 12.5px;
  font-weight: 700;
}

.menu-progress .bar {
  display: inline-block;
  width: 72px;
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.menu-progress .bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 0.2s ease;
}

.rtabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 8px;
  margin-bottom: 8px;
  scrollbar-width: none;
}
.rtabs::-webkit-scrollbar {
  display: none;
}
.rtab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 42px; /* même plancher que les pills .chip */
  padding: 6px 14px;
  border: 1.5px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: 600 12.5px Poppins, sans-serif;
  white-space: nowrap;
  cursor: pointer;
}
.rtab.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent);
}
.rtab.fait {
  opacity: 0.45;
}
.rtab.fait .rn {
  text-decoration: line-through;
}
.rtab.fait.active {
  opacity: 0.75;
}
.rtab .tick {
  display: inline-flex;
}

.onglet-recette {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
/* L'air demandé entre « Qui mange quoi » / « Portions » / « Préparation ». */
.onglet-recette .qui,
.onglet-recette .portions {
  margin-bottom: 6px;
}
.onglet-recette.fait > :not(.cta) {
  opacity: 0.55;
}

.onglet-meta,
.onglet-prepa,
.onglet-batch {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}

.onglet-prepa h4,
.onglet-batch h4 {
  margin: 0 0 8px;
  font-size: 13.5px;
  font-weight: 600;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
.meta-pill svg {
  color: var(--muted);
}

.fraicheur {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.qui,
.portions {
  padding: 11px 13px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 15%, var(--border));
}
.qui-titre,
.portions-titre {
  margin: 0 0 7px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.qui p,
.portions p {
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.5;
}

.bat {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 11px;
  border-radius: 10px;
  background: var(--surface-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  border: none;
  border-radius: 14px;
  background: var(--accent);
  color: #ffffff;
  font: 700 15px Poppins, sans-serif;
  cursor: pointer;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 35%, transparent);
}
.cta:active {
  transform: scale(0.97);
}
.cta.done {
  background: var(--surface-2);
  color: var(--text);
  box-shadow: none;
}

.file-dejeuners {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 14px 12px;
}
.fhead {
  margin: 10px 2px 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.box-pair {
  padding: 10px 2px;
  border-bottom: 1px dashed var(--border);
}
.box-pair:last-child {
  border-bottom: none;
}
.box-pair p {
  margin: 3px 0;
  font-size: 13px;
  line-height: 1.5;
}
.box-pair.locked {
  opacity: 0.55;
}
.box-pair.mangees {
  opacity: 0.5;
}
.box-pair.mangees p {
  text-decoration: line-through;
}
.lock-note {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--muted);
}
.mini-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: #ffffff;
  font: 700 13.5px Poppins, sans-serif;
  cursor: pointer;
}
.mini-cta:active {
  transform: scale(0.97);
}
```

- [ ] **Step 2: Vérifier**

```bash
npm test && npm run typecheck && npm run build
```
Expected: PASS + build sans warning CSS.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: styles Menu v3 — barre d onglets, blocs recette, file déjeuners"
```

---

### Task 7: CSS — nettoyage des classes orphelines + CHANGELOG

**Files:**
- Modify: `src/index.css`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Vérifier les orphelins**

```bash
rg -n "menu-reserve|menu-card|menu-coche|mtile|\.mt \{|mname|mmeta|menu-card-meta|mchips|mchip|\.mh \{|portions-box|portion-tag|rtoggle|\.progress|today-badge" src/ tests/
```
Expected: uniquement `src/index.css` (les définitions) — plus aucune utilisation dans les composants ni les tests (les tests v2 ont été remplacés au Task 5). Si un usage traîne, corriger avant de supprimer.

- [ ] **Step 2: Supprimer les définitions orphelines de `src/index.css`**

Supprimer ces règles (bloc « Menu v2 réserve » autour des lignes 609-830 et le bloc `.progress` si résiduel) : `.menu-reserve`, `.menu-reserve-head`, `.menu-reserve-note`, `.menu-card`, `.menu-card.fait .mname`, `.menu-card-top`, `.menu-coche`, `.menu-coche input`, `.menu-coche-box`, `.menu-coche input:checked + .menu-coche-box`, `.menu-coche input:focus-visible + .menu-coche-box`, `.mtile`, `.mt`, `.mname`, `.mmeta`, `.mmeta span`, `.menu-card-meta`, `.mchips`, `.mchip`, `.mh`, `.portions-box`, `.portions-title`, `.portions-box p`, `.portion-tag`, `.portion-tag.keto`, `.rtoggle`, `.rtoggle .chev`, `.rtoggle .chev.up`.

**Conserver** : `.mtag` et ses variantes `.tag-marc` / `.tag-mel` / `.tag-fam` / `.tag-bat` (réutilisées par MenuView v3), `.recette-*` (fiches recettes).

- [ ] **Step 3: Vérifier**

```bash
rg -n "menu-card|mtile|rtoggle|portion-tag|menu-reserve" src/ ; npm test && npm run typecheck && npm run build
```
Expected: grep sans résultat (hors historique git), tests + build verts.

- [ ] **Step 4: Mettre à jour le CHANGELOG**

Dans `CHANGELOG.md`, section `## [Non publié]` → `### Modifié`, remplacer la ligne :

```md
- Menu : réserve de recettes en cartes (coche « c'est fait », plus aucun jour imposé)
```

par :

```md
- Menu v3 : navigation par onglets de **recettes** (7 dîners + 🍱 Déjeuners, aucun jour affiché), fiche recette complète dans l'onglet, coche unique « C'est fait » par dîner (onglet grisé), file de déjeuners dynamique (les boxes se débloquent quand leur recette est faite), progression « Dîners X/N · Boxes X/N »
- Portions en mesures maison (pièces, poignées, c. à soupe, louches) — les grammes entre parenthèses ne servent qu'à caler l'œil (semaine d'exemple, template, prompt IA)
```

- [ ] **Step 5: Commit**

```bash
git add src/index.css CHANGELOG.md
git commit -m "chore: nettoyage CSS menu v2 + CHANGELOG"
```

---

### Task 8: Semaine d'exemple — refs déjeuners + portions mesures maison (TDD)

**Files:**
- Modify: `src/assets/semaine-exemple.md`
- Test: `tests/menu.test.ts` (section intégration)

- [ ] **Step 1: Écrire les tests (rouge)**

Ajouter à la fin de `tests/menu.test.ts` :

```ts
import { parseWeeklyFile } from '../src/lib/parse';
import semaineExempleRaw from '../src/assets/semaine-exemple.md?raw';

describe('menu — semaine d exemple (intégration)', () => {
  const semaine = parseWeeklyFile(semaineExempleRaw).data;

  it('les déjeuners portent les refs de leur recette source', () => {
    expect(semaine.menu[0].recetteRefs?.dejeunerMarc).toBe('R7'); // boîte du batch dimanche
    expect(semaine.menu[0].recetteRefs?.dejeunerMelanie).toBe('R7');
    expect(semaine.menu[1].recetteRefs?.dejeunerMarc).toBe('R1'); // boîte poulet-riz (lun)
    expect(semaine.menu[2].recetteRefs?.dejeunerMarc).toBe('R2'); // boîte bolo
    expect(semaine.menu[2].recetteRefs?.dejeunerMelanie).toBe('R2');
    expect(semaine.menu[3].recetteRefs?.dejeunerMelanie).toBe('R3'); // restes omelette
    // Vendredi (restes/wrap) et samedi : pas de source claire → pas de ref.
    expect(semaine.menu[4].recetteRefs?.dejeunerMarc).toBeUndefined();
  });

  it('7 onglets + 7 paires ; mardi se débloque avec R1, mercredi avec R2', () => {
    const onglets = construireOnglets(semaine.menu, semaine.recettes ?? []);
    const paires = construirePaires(semaine.menu, semaine.recettes ?? []);
    expect(onglets).toHaveLength(7);
    expect(paires).toHaveLength(7);
    const faits = faitsParRecette(semaine.menu);
    expect(pairePrete(paires[1], {}, faits)).toBe(false);
    expect(pairePrete(paires[1], { 'menu:lundi:dinerFamille': true }, faits)).toBe(true);
    expect(pairePrete(paires[2], { 'menu:mardi:dinerFamille': true }, faits)).toBe(true);
  });

  it('portions en mesures maison : jamais une portion qui oblige à peser en premier', () => {
    const r1 = semaine.recettes?.find((r) => r.id.startsWith('r1-'));
    expect(r1?.portions?.marc).toContain('poignée de riz');
    expect(r1?.portions?.marc).toMatch(/\(~150 g cuit\)/);
    const r4 = semaine.recettes?.find((r) => r.id.startsWith('r4-'));
    expect(r4?.portions?.marc).toContain('paume de poulet');
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

```bash
npm test -- tests/menu.test.ts
```
Expected: FAIL — les refs déjeuner n'existent pas encore dans la semaine d'exemple.

- [ ] **Step 3: Modifier `src/assets/semaine-exemple.md`**

Dans `## Menu`, ajouter les refs en fin de ligne (le texte affiché reste identique, la ref est extraite par le parser) :

```md
- dejeuner-marc: Boîte dinde-quinoa (batch dim) + légumes → R7
- dejeuner-melanie: Restes dinde + gratin courgettes + ½ avocat → R7
```
(= lundi)

```md
- dejeuner-marc: Boîte poulet-riz (lun) → R1
- dejeuner-melanie: Restes poulet + œuf dur + crudités → R1
```
(= mardi)

```md
- dejeuner-marc: Boîte bolo → R2
- dejeuner-melanie: Bolo sur courgettes (restes) → R2
```
(= mercredi)

```md
- dejeuner-marc: Boîte bolo → R2
- dejeuner-melanie: Box thon-avocat ou restes omelette + salade → R3
```
(= jeudi)

Vendredi, samedi et dimanche : **aucune ref** (pas de source claire → toujours prêtes).

Dans `## Recettes`, réécrire les portions qui exigeaient une balance :

```md
- portions marc: 1 poignée de riz (~150 g cuit) · 2 cuisses + légumes rôtis
```
(R1, remplace `riz 150 g cuit · 2 cuisses + légumes rôtis`)

```md
- portions marc: 1 grosse poignée de pâtes (~120 g cuites) + bolo
```
(R2, remplace `pâtes 120 g cuites + bolo`)

```md
- portions marc: 4 œufs + jambon · 1 poignée de pommes vapeur (~200 g)
```
(R3, remplace `4 œufs + jambon + pommes vapeur`)

```md
- portions marc: 1 paume de poulet (~180 g) · 1 poignée de riz (~150 g)
```
(R4, remplace `poulet 180 g + riz 150 g`)

```md
- portions marc: 2 tartines + 2 œufs + 1 louche de soupe
- portions melanie: 1 louche de soupe (portion réduite) + 2 œufs (sans tartines)
```
(R6, remplace `2 tartines + 2 œufs + soupe` / `soupe réduite + 2 œufs (sans tartines)`)

```md
- portions marc: 1 poignée de quinoa (~150 g) + 1 paume de dinde (~180 g)
```
(R7, remplace `quinoa 150 g + dinde 180 g`)

Les autres portions (R5, mel de R1/R4/R7) sont déjà en mesures maison — ne pas y toucher.

- [ ] **Step 4: Vérifier le vert + zéro warning d'import**

```bash
npm test && npm run typecheck
```
Expected: PASS — y compris les tests parse existants (les refs déjeuner ne changent ni les ids de coches ni les textes des autres clés).

- [ ] **Step 5: Commit**

```bash
git add src/assets/semaine-exemple.md tests/menu.test.ts
git commit -m "feat: semaine d'exemple — refs déjeuners + portions en mesures maison"
```

---

### Task 9: Templates, prompt IA et README

**Files:**
- Modify: `docs/templates/template-semaine.md`
- Modify: `docs/templates/prompt-semaine-ia.md`
- Modify: `README.md`

- [ ] **Step 1: Template — règles et placeholders**

Dans `docs/templates/template-semaine.md`, ajouter aux règles absolues du commentaire d'en-tête (après la règle « Refs recette ») :

```html
- Portions recette en MESURES MAISON (pièces, poignées, c. à soupe, louches) ;
  les grammes vont entre parenthèses pour caler l'œil : « 1 poignée de riz
  (~150 g cuit) ». Jamais de portion qui exige une balance.
- Une box de midi est toujours liée au plat qui la produit : la ligne
  `dejeuner-*` porte `→ slug` quand elle vient d'un batch ou d'un dîner
  (sans ref, l'app la considère « toujours prête »).
```

Dans la section `## Menu`, remplacer :

```md
- dejeuner-marc: {{boîte ou repas}} → {{slug-recette si ref}}
- dejeuner-melanie: {{assiette keto}}
```

par :

```md
- dejeuner-marc: {{boîte du batch ou repas}} → {{slug-recette-source}}
- dejeuner-melanie: {{assiette keto ou box}} → {{slug-recette-source si ref}}
```

Dans la section `## Recettes`, ajouter après la ligne `- pour 4: …` :

```md
- portions marc: {{mesures maison — pièces, poignées, c. à soupe, louches}}
- portions melanie: {{mesures maison keto}}
```

- [ ] **Step 2: Prompt IA — règles dures**

Dans `docs/templates/prompt-semaine-ia.md`, à l'étape 3 (**Menu**), remplacer la phrase « Ajoute `→ slug` quand le plat correspond à une recette du fichier. » par :

```md
   OBLIGATOIRE pour les déjeuners : une box de midi porte toujours
   `→ slug` vers la recette qui la produit (batch ou dîner de la veille) —
   sans ref, l'app la considère « toujours prête ». Les portions
   (`- portions marc/melanie:` des recettes) sont en MESURES MAISON :
   pièces, poignées, c. à soupe, louches — grammes entre parenthèses
   uniquement pour caler l'œil. Jamais de portion qui exige une balance.
```

Dans la section `## Auto-contrôle`, ajouter :

```md
- [ ] Chaque box de midi (`dejeuner-*`) issue d'un batch/dîner porte `→ slug` ;
      les portions des recettes sont en mesures maison (pas de pesée obligatoire)
```

- [ ] **Step 3: README — section Cuisine**

Dans `README.md` (section « L'écran Cuisine »), remplacer les deux puces **Menu** et **Cartes recettes** par :

```md
- **Menu** : une barre d'onglets par **recette** (les 7 dîners du fichier + 🍱 Déjeuners) — aucun jour affiché, l'ordre du fichier est l'ordre conseillé (batch/frigo d'abord, frais ensuite) ; l'onglet du jour courant est présélectionné. La progression lit « Dîners X/N · Boxes X/N ».
- **Onglet recette** : la fiche complète d'un bloc (temps, kcal, health score, fraîcheur), « Qui mange quoi » (dîner famille + adaptation keto de Mél), « Portions — par personne » en **mesures maison** (pièces, poignées, c. à soupe, louches — les grammes entre parenthèses ne servent qu'à caler l'œil), la préparation (ingrédients « pour 4 », étapes, bases cliquables), le batch du jour en info, et la coche unique « C'est fait — dîner fini » (l'onglet se grise, nom barré + ✓).
- **Déjeuners dynamiques** : une paire de boxes devient « prête » quand la recette qui la produit (`→ R#` sur la ligne déjeuner) est cochée ; verrouillée sinon (« débloquée quand … est fait ») ; une box sans ref est toujours disponible. Une coche par paire (« Boxes faites ») coche les lignes Marc + Mél du jour.
```

- [ ] **Step 4: Vérifier + commit**

```bash
npm test && npm run lint
git add docs/templates/template-semaine.md docs/templates/prompt-semaine-ia.md README.md
git commit -m "docs: convention mesures maison + boxes liées aux recettes (template, prompt, README)"
```

---

### Task 10: e2e — parcours Menu v3

**Files:**
- Modify: `tests/e2e/cuisine.spec.ts`

- [ ] **Step 1: Réécrire le test menu (rouge→vert)**

Dans `tests/e2e/cuisine.spec.ts`, remplacer le test `menu : réserve de recettes — 33 cartes, coche persistée, fiche dépliable` (lignes ~68-90) par :

```ts
  test('menu : onglets par recette, coche dîner, boxes débloquées', async ({ page }) => {
    await page.goto(ORIGIN);

    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('.rtab')).toHaveCount(8); // 7 dîners + 🍱 Déjeuners
    // Les pills n'affichent aucun jour :
    await expect(page.locator('.rtab').first()).not.toContainText(/lundi/i);

    // Onglet recette : contenu complet (mercredi actif d'office)
    await page.getByRole('tab', { name: /Omelette fromage/ }).click();
    await expect(page.getByText('Qui mange quoi')).toBeVisible();
    await expect(page.getByText(/1 poignée de pommes vapeur/)).toBeVisible();
    await expect(page.getByText('Préparation')).toBeVisible();

    // Coche du dîner R1 (lundi) → pill grisée + paire mardi débloquée
    await page.getByRole('tab', { name: /Cuisses de poulet/ }).click();
    await page.getByRole('button', { name: /C'est fait — dîner fini/ }).click();
    await expect(page.getByRole('tab', { name: /Cuisses de poulet/ })).toHaveClass(/fait/);

    await page.getByRole('tab', { name: /Déjeuners/ }).click();
    await expect(page.getByText('Prêtes à emporter')).toBeVisible();
    // Prêtes : mardi (source R1 ✓) + vendredi/samedi/dimanche (sans ref).
    // Verrouillées : lundi (R7), mercredi (R2), jeudi (R2/R3) → 3 notes.
    await expect(page.getByText(/débloquée quand/)).toHaveCount(3);
    // La première paire prête dans l'ordre du fichier = mardi (source R1).
    await page.getByRole('button', { name: /Boxes faites/ }).first().click();
    await expect(page.getByText('Mangées')).toBeVisible();

    const checks = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('sportapp:checks:2026-S37')!),
    );
    expect(checks['menu:lundi:dinerFamille']).toBe(true);
    expect(checks['menu:mardi:dejeunerMarc']).toBe(true);
    expect(checks['menu:mardi:dejeunerMelanie']).toBe(true);
  });
```

- [ ] **Step 2: Mettre à jour le commentaire contrat d'entête**

Remplacer le commentaire de maintenance (lignes 3-11) par :

```ts
// Contrat de maintenance : la semaine d'exemple (S37, 2026-09-07 → 2026-09-13)
// doit couvrir la semaine courante. Quand on la rafraîchit, mettre à jour
// « Semaine 2026-S37 » et les compteurs exacts ci-dessous (même contrat que
// les tests unitaires). Hypothèses à préserver aussi : le frontmatter garde
// `menu: A` (pill assertée), le Menu compte 7 onglets dîners + 1 onglet
// Déjeuners (7 paires de boxes), et la 1ʳᵉ pill = R1 (Cuisses de poulet).
// Les coches menu partent d'un storageState vierge. Le test dépenses sème
// une dépense datée 2026-09-09 (∈ S37), en saisit une datée 2026-09-10 et
// épingle le total « Payé cette semaine » à 73,30 € — déplacer le tout au refresh.
```

- [ ] **Step 3: Vérifier le vert (les 2 projets mobile)**

```bash
npx playwright test tests/e2e/cuisine.spec.ts
```
Expected: PASS — y compris les tests de débordement (la barre d'onglets scrollable ne doit jamais déborder).

- [ ] **Step 4: Vérifier le 375 et le 320 visuellement (optionnel, mode UI)**

```bash
npm run e2e:ui
```
Vérifier : pills tronquées propres, blocs espacés (20 px), états grisés lisibles.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/cuisine.spec.ts
git commit -m "test: e2e Menu v3 — onglets par recette, coche dîner, boxes dynamiques"
```

---

### Task 11: Gates complets + validation PWA

- [ ] **Step 1: Batterie complète**

```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run e2e
```
Expected: tout vert (unit, typecheck, lint, build, e2e 375 + 320).

- [ ] **Step 2: Validation build de prod + PWA**

```bash
npm run build && npm run preview
```
Vérifier dans le navigateur : dist/ sert le nouveau Menu, l'état persisté (recharger la page conserve coches et onglet actif = jour courant), aucun débordement à 320 px.

- [ ] **Step 3: Dogfooding coches existantes (spec § Vérifications)**

Avec un storage contenant des coches v2 (ex. `menu:lundi:dinerFamille: true`) : l'onglet R1 arrive grisé d'emblée — aucune perte d'état au déploiement.

- [ ] **Step 4: Commit final éventuel (fixes de dernière minute)**

```bash
git status
# si des ajustements ont été faits pendant la revue :
git add -A src/ tests/ docs/
git commit -m "fix: retours revue Menu v3"
```

---

## Self-review du plan (fait à l'écriture)

1. **Couverture spec** : §1 structure onglets (Task 5, 6) · §2 contenu recette + anti-duplication (Task 5) · §3 file déjeuners (Task 5) · §4 coches/ids (Tasks 2, 3, 5 — ids inchangés, zéro migration testé) · §5 convention mesures maison (Task 8, 9) · §6 implémentation lib+composants (Tasks 2-5) · Tests (Tasks 2, 3, 5, 8, 10) · Risques 320 px (Task 10 overflow + Task 11 e2e) · CHANGELOG (Task 7).
2. **Placeholders** : aucun TBD/TODO ; chaque étape de code contient le code complet.
3. **Cohérence des types** : `OngletDiner`/`PaireDejeuners`/`Occurrence` définis Tasks 2-3 et consommés Task 5 avec les mêmes noms ; `labelCourt`, `pairePrete`, `paireFaite`, `debloquePar`, `faitsParRecette`, `selectionInitiale` signés identiquement partout.
