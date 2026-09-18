# UX v1.4 — Vague 2 « volet Batch » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le volet Batch de la vague 2 v1.4 : renommage Batch → « Mon Rituel », refs recette sur les tâches et les étapes du rituel (contrat .md étendu, rétrocompatible), mode guidé recette-aware (fiche recette dépliable à chaque étape), micro-batch enrichi (durée, quantité, ref), réserve avec état disponible/consommé et joker « Sors la réserve » dans le Menu.

**Architecture:** Tout le parsing reste dans `src/lib/parse.ts` (les refs `→ slug` sont validées contre les recettes du fichier pour ne jamais corrompre les libellés existants — donc jamais les ids de coches). La logique pure (ids de réserve, soirs sans dîner) va dans `src/lib/batch.ts`. Les vues (`BatchView`, `MenuView`) restent présentatives ; les nouvelles coches (`reserve:{cle}:{slug}`) passent par `setCheck`, donc la sync les emporte sans changement. Le contrat .md est étendu de façon rétrocompatible : une semaine v1/v2/v3 parse sans aucun warning et s'affiche comme avant.

**Spec:** `docs/superpowers/specs/2026-09-18-refonte-ux-v14-design.md` (§ 4.2, 4.3, 4.4)

**Tech Stack:** TypeScript strict, React 18 (hooks), vitest + Testing Library (happy-dom), Playwright (WebKit, 320/375), CSS sémantique tokenisé (`src/index.css`).

---

## Fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `src/lib/model.ts` | modify | types : `ref` sur `ChecklistItem`/`RituelEtape`, `duree`/`quantite`/`ref` sur `MicroBatchJour` |
| `src/lib/parse.ts` | modify | `extraireRef` + refs tâches/étapes + segmentation micro-batch ; recettes parsées AVANT le batch |
| `src/lib/batch.ts` | modify | `reserveId`, `soirsSansDiner` (pur) |
| `src/components/cuisine/CuisineView.tsx` | modify | libellé d'onglet « Mon Rituel » ; passage de `recettes`/`reserve` |
| `src/components/cuisine/BatchView.tsx` | modify | libellés, `FicheRecette`, micro-batch enrichi, réserve avec état |
| `src/components/cuisine/MenuView.tsx` | modify | encart joker « Sors la réserve » |
| `src/index.css` | modify | `.micro-meta`/`.micro-pill`/`.micro-ref`, `.reserve-*`, `.guide-fiche*`/`.fiche-*`, `.menu-joker`/`.joker-*` |
| `src/assets/semaine-exemple.md` | modify | refs en exemple (0 warning exigé) |
| `docs/templates/template-semaine.md` | modify | contrat humain |
| `src/assets/prompt-cycle-template.md` | modify | contrat IA |
| `README.md` | modify | règles du format + écran |
| `AGENTS.md` | modify | contrat + nom d'onglet + ids |
| `CHANGELOG.md` | modify | section `[Non publié]` |
| `tests/parse.test.ts` | modify | describes « Batch v4 » |
| `tests/lib/batch.test.ts` | modify | `reserveId`, `soirsSansDiner` |
| `tests/components.test.tsx` | modify | renommages + fiche + pills + réserve + joker |
| `tests/app.test.tsx` | modify | onglet « Mon Rituel » + refs de la sample |
| `tests/e2e/cuisine.spec.ts` | modify | renommages + fiche guidée |

Décisions de design fixées par ce plan :

1. **Refs validées contre les recettes du fichier.** Un `→ mot` en fin de ligne n'est une ref que si la recette existe (égalité ou préfixe `slug-`). Sinon le texte reste dans le libellé (prose légitime : « → boîte lundi Marc »), sans warning. C'est ce qui protège les ids de coches existants.
2. **La ref n'entre JAMAIS dans l'id de coche** : elle est retirée du libellé avant `slugify`. Ajouter/retirer une ref conserve l'état coché.
3. **Micro-batch** : `quoi | durée | quantité → slug | détail`. La durée n'est reconnue que si le segment est strict (« 10 min », « 1 h ») ; la quantité n'est reconnue qu'accompagnée de sa ref. Tout segment libre reste un détail (v1 acceptée).
4. **Id de coche de la réserve** : `reserve:{cle}:{slugify(plat)}` (stable, dérive du plat, jamais de l'ordre). La clé `mel` n'est jamais suggérée dans le Menu.
5. **Fiche recette** : dépliable, fermée par défaut, dans le mode guidé uniquement (la timeline ne change pas). Ref cassée → repli silencieux (pas de fiche).
6. **Joker** : encart en tête de l'onglet Menu (sous la barre de progression), un par soir sans `diner-famille` **ni** `diner-melanie` ayant une ligne de réserve au nom du jour. La coche du joker = la coche de la réserve (même id) → l'état se reflète dans « Mon Rituel ».

---

### Task 0: Branche

- [ ] **Step 1: Créer la branche depuis main**

```bash
git checkout main && git pull && git checkout -b feat/ux-v14-vague2-batch
```

---

### Task 1: Types + refs sur les tâches batch (parser)

**Files:**
- Modify: `src/lib/model.ts:29-32` (ChecklistItem)
- Modify: `src/lib/parse.ts` (helpers + `parseWeeklyFile` + `parseBatch`)
- Test: `tests/parse.test.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/parse.test.ts`, ajouter à la fin du fichier :

```ts
describe('Batch v4 — refs recette sur les tâches', () => {
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

## Recettes
### R7 · Rôti de dinde + gratin courgettes + quinoa
temps: 60 min · four 180°

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

  it('tâche avec ref valide : label net, ref portée, id sans la ref', () => {
    const { data, warnings } = parseWeeklyFile(
      md('- [ ] Egg muffins ×10 → R7\n- [ ] Légumes lavés\n'),
    );
    expect(data.batch[0]).toEqual({ id: 'batch:egg-muffins-x10', label: 'Egg muffins ×10', ref: 'R7' });
    expect(data.batch[1]).toEqual({ id: 'batch:legumes-laves', label: 'Légumes lavés' });
    expect(warnings).toEqual([]);
  });

  it('« → prose » sans recette correspondante : reste dans le libellé, id inchangé', () => {
    const { data, warnings } = parseWeeklyFile(md('- [ ] Doubler dinde + quinoa → boîte lundi Marc\n'));
    expect(data.batch[0].label).toBe('Doubler dinde + quinoa → boîte lundi Marc');
    expect(data.batch[0].ref).toBeUndefined();
    expect(data.batch[0].id).toBe('batch:doubler-dinde-quinoa-boite-lundi-marc');
    expect(warnings).toEqual([]);
  });

  it('stabilité d id : ajouter une ref ne change pas l id de coche', () => {
    const sans = parseWeeklyFile(md('- [ ] Egg muffins ×10\n')).data.batch[0].id;
    const avec = parseWeeklyFile(md('- [ ] Egg muffins ×10 → R7\n')).data.batch[0].id;
    expect(avec).toBe(sans);
  });

  it('ref inconnue (R99) : conservée dans le libellé, pas de warning', () => {
    const { data, warnings } = parseWeeklyFile(md('- [ ] Sauce tomate → R99\n'));
    expect(data.batch[0].label).toBe('Sauce tomate → R99');
    expect(data.batch[0].ref).toBeUndefined();
    expect(warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/parse.test.ts -t "Batch v4 — refs recette sur les tâches"`
Expected: FAIL (`data.batch[0]` n'a pas de `ref`)

- [ ] **Step 3: Types — `src/lib/model.ts`**

Ajouter `ref` à `ChecklistItem` (lignes 29-32) :

```ts
export interface ChecklistItem {
  id: string;
  label: string;
  ref?: string; // ref recette (batch v4) — jamais dans l'id de coche
}
```

- [ ] **Step 4: Parser — `src/lib/parse.ts`**

4a. Juste après la fonction `registerId` (ligne 51), ajouter :

```ts
// Ref recette en fin de ligne : « → slug ». Une ref n'est retenue que si le slug
// correspond à une recette du fichier (égalité, ou préfixe « slug- ») — sinon le
// « → … » reste dans le texte (prose légitime : « → boîte lundi Marc »).
const REF_SHAPE = /\s*→\s*(\S+)\s*$/;

function refConnue(ref: string, recettes: Recette[]): boolean {
  const cible = ref.toLowerCase();
  return recettes.some((r) => r.id === cible || r.id.startsWith(`${cible}-`));
}

function extraireRef(texte: string, recettes: Recette[]): { texte: string; ref?: string } {
  const m = texte.match(REF_SHAPE);
  if (!m || !refConnue(m[1], recettes)) return { texte };
  return { texte: texte.slice(0, m.index).trimEnd(), ref: m[1] };
}
```

4b. Dans `parseWeeklyFile` (lignes 83-97), déplacer le parsing des recettes/bases AVANT le batch et passer `recettes` à `parseBatch` :

```ts
  const coursesParse = parseCourses(sections.get('courses') ?? '', 'courses', warnings, seen);
  const courses = coursesParse.items;
  const menu = parseMenu(sections.get('menu') ?? '', 'menu', warnings);
  // Recettes et bases AVANT le batch : les refs « → slug » des tâches, étapes
  // et micro-batch sont validées contre les recettes du fichier.
  const recettes = parseRecettes(sections.get('recettes') ?? '', warnings, seen);
  const bases = parseBases(sections.get('bases') ?? '', warnings, seen);
  const lignes = lignesBatch(sections.get('batch') ?? '', warnings);
  const batch = parseBatch(lignes, warnings, seen, recettes);
  const rituelParse = parseRituel(lignes, 'batch', warnings, seen);
  const rituel = rituelParse.etapes;
  const microBatch = parseMicroBatch(lignes, warnings);
  const reserve = parseReserve(lignes, warnings);
```

(`parseRituel` et `parseMicroBatch` recevront `recettes` au Task 2 — ne pas les modifier ici.)

4c. `parseBatch` (lignes 250-280) — nouvelle signature et extraction :

```ts
function parseBatch(
  lignes: LigneBatch[],
  warnings: string[],
  seen: Set<string>,
  recettes: Recette[],
): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  for (const [line, cur] of lignes) {
    if (cur) continue;
    const plain = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!plain) {
      if (line.trim()) warnings.push(`Ligne ignorée (batch) : « ${preview(line)} »`);
      continue;
    }
    const withBox = plain[1].match(/^\[( |x|X)\]\s+(.+)$/);
    if (!withBox) {
      if (RITUEL_SHAPE.test(line)) {
        warnings.push('Ligne rituel hors sous-section « Rituel dimanche » ignorée (batch).');
        continue;
      }
      if (/^\s*[-*]\s+(production|termine)\s*:/.test(line)) {
        warnings.push('Ligne production/termine hors sous-section « Rituel dimanche » ignorée (batch).');
        continue;
      }
      if (MICRO_SHAPE.test(line)) {
        warnings.push('Ligne micro-batch hors sous-section « Micro-batch » ignorée (batch).');
        continue;
      }
    }
    const brut = withBox ? withBox[2] : plain[1];
    // Ref optionnelle « → slug », retirée AVANT le slug d'id : l'état de coche
    // survit à l'ajout ou au retrait d'une ref.
    const { texte: label, ref } = extraireRef(brut, recettes);
    const id = `batch:${slugify(label)}`;
    registerId(id, 'batch', seen, warnings);
    out.push({ id, label, ...(ref ? { ref } : {}) });
  }
  return out;
}
```

- [ ] **Step 5: Vérifier le vert (parse complet)**

Run: `npx vitest run tests/parse.test.ts tests/app.test.tsx tests/menu.test.ts`
Expected: PASS (aucune régression — les libellés existants avec « → prose » sont intacts)

- [ ] **Step 6: Commit**

```bash
git add tests/parse.test.ts src/lib/model.ts src/lib/parse.ts
git commit -m "feat: parse — refs recette sur les tâches batch (contrat étendu)"
```

---

### Task 2: refs sur les étapes du rituel + micro-batch enrichi (parser)

**Files:**
- Modify: `src/lib/model.ts:59-70` (RituelEtape, MicroBatchJour)
- Modify: `src/lib/parse.ts` (`parseRituel`, `parseMicroBatch`)
- Test: `tests/parse.test.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/parse.test.ts`, après le describe du Task 1 (même fixture `md`, avec la section `## Recettes`) :

```ts
describe('Batch v4 — refs sur le rituel et micro-batch enrichi', () => {
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

## Recettes
### R7 · Rôti de dinde + gratin courgettes + quinoa
temps: 60 min · four 180°

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

  it('étape rituel avec ref : ref extraite, détail intact, id inchangé', () => {
    const { data } = parseWeeklyFile(md(`### Rituel dimanche
- 5-30 min · Cuissons en double — dîner du soir ×2 + féculent ×2 → boîte lundi → R7
`));
    expect(data.rituel).toEqual([
      {
        id: 'batch:rituel:cuissons-en-double',
        creneau: '5-30 min',
        label: 'Cuissons en double',
        detail: 'dîner du soir ×2 + féculent ×2 → boîte lundi',
        ref: 'R7',
      },
    ]);
  });

  it('étape sans ref : pas de clé ref', () => {
    const { data } = parseWeeklyFile(md(`### Rituel dimanche
- 0-5 min · Four à 180° — egg muffins
`));
    expect(data.rituel![0].ref).toBeUndefined();
  });

  it('micro-batch v4 : durée, quantité → ref, détail', () => {
    const { data } = parseWeeklyFile(md(`### Micro-batch
- mardi: précuire brocolis | 10 min | 2 boîtes → R7 | sortir la veille
`));
    expect(data.microBatch).toEqual([
      { jour: 'mardi', quoi: 'précuire brocolis', duree: '10 min', quantite: '2 boîtes', ref: 'R7', detail: 'sortir la veille' },
    ]);
  });

  it('micro-batch : quantité sans durée, ref seule', () => {
    const { data } = parseWeeklyFile(md(`### Micro-batch
- lundi: doubler le riz | 2 boîtes → R7
`));
    expect(data.microBatch).toEqual([
      { jour: 'lundi', quoi: 'doubler le riz', quantite: '2 boîtes', ref: 'R7' },
    ]);
  });

  it('micro-batch v1 : « | 10 min · détail » reste un détail entier (rétrocompatibilité)', () => {
    const { data } = parseWeeklyFile(md(`### Micro-batch
- lundi: doubler le plat | 10 min · la boîte de mardi passe au frigo
`));
    expect(data.microBatch).toEqual([
      { jour: 'lundi', quoi: 'doubler le plat', detail: '10 min · la boîte de mardi passe au frigo' },
    ]);
  });

  it('micro-batch : segment sans ref après une durée = détail (pas une quantité)', () => {
    const { data } = parseWeeklyFile(md(`### Micro-batch
- samedi: œufs durs | 10 min | collations prêtes
`));
    expect(data.microBatch).toEqual([
      { jour: 'samedi', quoi: 'œufs durs', duree: '10 min', detail: 'collations prêtes' },
    ]);
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/parse.test.ts -t "Batch v4 — refs sur le rituel"`
Expected: FAIL (pas de `ref` sur les étapes, pas de `duree`/`quantite` sur le micro-batch)

- [ ] **Step 3: Types — `src/lib/model.ts`**

Remplacer `RituelEtape` et `MicroBatchJour` (lignes 59-70) :

```ts
export interface RituelEtape {
  id: string;
  creneau: string;
  label: string;
  detail?: string;
  ref?: string; // ref recette (batch v4) — le mode guidé affiche sa fiche
}

export interface MicroBatchJour {
  jour: string;
  quoi: string;
  detail?: string; // suffixe ` | détail` — 3e ligne de la carte micro-batch
  duree?: string; // segment strict « 10 min » / « 1 h » (v4)
  quantite?: string; // segment accompagné de sa ref (v4)
  ref?: string; // ref recette (v4) — chip recette sur la carte
}
```

- [ ] **Step 4: Parser — `src/lib/parse.ts`**

4a. Dans `parseWeeklyFile`, passer `recettes` aux deux fonctions :

```ts
  const rituelParse = parseRituel(lignes, 'batch', warnings, seen, recettes);
  const rituel = rituelParse.etapes;
  const microBatch = parseMicroBatch(lignes, warnings, recettes);
```

4b. `parseRituel` — nouvelle signature et extraction AVANT le `RITUEL_SHAPE` (les lignes `production:`/`termine:` et les warnings gardent la ligne d'origine) :

```ts
function parseRituel(
  lignes: LigneBatch[],
  section: string,
  warnings: string[],
  seen: Set<string>,
  recettes: Recette[],
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
    // Ref optionnelle en fin de ligne, avant le découpage créneau · label — détail.
    const { texte: ligneNet, ref } = extraireRef(line, recettes);
    const m = ligneNet.match(RITUEL_SHAPE);
    if (!m) {
      warnings.push(`Ligne ignorée (${section}/rituel) : « ${preview(line)} »`);
      continue;
    }
    const [, creneau, label, detail] = m;
    const id = `batch:rituel:${slugify(label)}`;
    registerId(id, `${section}/rituel`, seen, warnings);
    etapes.push({
      id,
      creneau,
      label,
      ...(detail ? { detail } : {}),
      ...(ref ? { ref } : {}),
    });
  }
  return {
    etapes,
    ...(production !== undefined ? { production } : {}),
    ...(termine !== undefined ? { termine } : {}),
  };
}
```

4c. `parseMicroBatch` — segmentation par segments (remplace l'extraction au premier `|`) :

```ts
// Segment « durée » strict du micro-batch : « 10 min », « 1 h ». Un segment plus
// long (« 10 min · la boîte passe au frigo ») reste un détail (v1 acceptée).
const DUREE_SEG = /^\d+\s*(?:min|h|minutes?|heures?)\s*$/i;

function parseMicroBatch(
  lignes: LigneBatch[],
  warnings: string[],
  recettes: Recette[],
): MicroBatchJour[] {
  const out: MicroBatchJour[] = [];
  for (const [line, cur] of lignes) {
    if (cur !== 'micro-batch') continue;
    if (!line.trim()) continue;
    const m = line.match(/^\s*[-*]\s+([a-z-]+)\s*:\s*(.+?)\s*$/);
    if (!m) {
      warnings.push(`Ligne ignorée (batch/micro-batch) : « ${preview(line)} »`);
      continue;
    }
    const segs = m[2].split(/\s*\|\s*/).filter((s) => s.length > 0);
    const quoi = segs[0] ?? '';
    const rest = segs.slice(1);
    let i = 0;
    let duree: string | undefined;
    let quantite: string | undefined;
    let ref: string | undefined;
    if (rest[i] && DUREE_SEG.test(rest[i])) {
      duree = rest[i];
      i++;
    }
    if (rest[i]) {
      const ex = extraireRef(rest[i], recettes);
      // La quantité n'est reconnue qu'accompagnée de sa ref recette
      // (« 2 boîtes → r2 ») — un segment libre reste un détail (v1).
      if (ex.ref) {
        quantite = ex.texte || undefined;
        ref = ex.ref;
        i++;
      }
    }
    const detail = rest[i] ? rest.slice(i).join(' | ') : undefined;
    out.push({
      jour: m[1],
      quoi,
      ...(duree ? { duree } : {}),
      ...(quantite ? { quantite } : {}),
      ...(ref ? { ref } : {}),
      ...(detail ? { detail } : {}),
    });
  }
  return out;
}
```

- [ ] **Step 5: Vérifier le vert (parse complet — rétrocompatibilité v3 incluse)**

Run: `npx vitest run tests/parse.test.ts tests/app.test.tsx`
Expected: PASS (le describe « Batch v3 » — pipes suivants dans le détail, réserve — doit rester vert)

- [ ] **Step 6: Commit**

```bash
git add tests/parse.test.ts src/lib/model.ts src/lib/parse.ts
git commit -m "feat: parse — refs sur les étapes du rituel + micro-batch enrichi"
```

---

### Task 3: lib/batch — `reserveId` et `soirsSansDiner`

**Files:**
- Modify: `src/lib/batch.ts`
- Test: `tests/lib/batch.test.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/lib/batch.test.ts`, ajouter (et compléter l'import en tête du fichier + `import type { MenuDay } from '../../src/lib/model';` si absent) :

```ts
import { dureeRituel, iconeReserve, reserveId, soirsSansDiner } from '../../src/lib/batch';
```

```ts
describe('reserveId', () => {
  it('id stable dérivé de la clé et du plat (accents et ponctuation normalisés)', () => {
    expect(reserveId({ cle: 'lundi', plat: 'Boîte dinde-quinoa', conservation: 'frigo' })).toBe(
      'reserve:lundi:boite-dinde-quinoa',
    );
    expect(reserveId({ cle: 'mardi', plat: 'Chili ×2', conservation: 'congel' })).toBe(
      'reserve:mardi:chili-2',
    );
  });
});

describe('soirsSansDiner', () => {
  const RESERVE = [
    { cle: 'mardi', plat: 'Chili ×2', conservation: 'congélateur' },
    { cle: 'mel', plat: 'Box keto', conservation: 'à part' },
  ];

  it('soir sans dîner (ni famille ni mel) avec une ligne de réserve dédiée', () => {
    const menu: MenuDay[] = [
      { jour: 'Lundi', dinerFamille: 'Chili' },
      { jour: 'Mardi', dejeunerMarc: 'Restes' },
      { jour: 'Mercredi' },
    ];
    expect(soirsSansDiner(menu, RESERVE)).toEqual([{ jour: 'Mardi', ligne: RESERVE[0] }]);
  });

  it('un soir sans dîner sans ligne de réserve ne suggère rien ; la clé mel jamais', () => {
    const menu: MenuDay[] = [{ jour: 'Mardi' }, { jour: 'Jeudi' }];
    expect(soirsSansDiner(menu, RESERVE)).toEqual([]);
  });

  it('diner-melanie seul compte comme un dîner planifié', () => {
    const menu: MenuDay[] = [{ jour: 'Mardi', dinerMelanie: 'Wok keto' }];
    expect(soirsSansDiner(menu, RESERVE)).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/lib/batch.test.ts`
Expected: FAIL (`reserveId`/`soirsSansDiner` non exportés)

- [ ] **Step 3: Implémentation — `src/lib/batch.ts`**

En tête du fichier, remplacer les imports par :

```ts
import type { MenuDay, ReserveLigne, RituelEtape } from './model';
import { normaliseComplement } from './model';
import { slugify } from './parse';
```

Ajouter en fin de fichier :

```ts
// Id de coche d'une ligne de réserve — stable : dérive de la clé et du plat,
// jamais de l'ordre du fichier (renommer le plat perd l'état, comme partout).
export const reserveId = (ligne: ReserveLigne): string =>
  `reserve:${ligne.cle}:${slugify(ligne.plat)}`;

export interface SoirJoker {
  jour: string;
  ligne: ReserveLigne;
}

// Soirs sans dîner planifié (ni diner-famille ni diner-melanie) ayant une ligne
// de réserve dédiée → suggestion « Sors la réserve » dans l'onglet Menu.
// La clé « mel » n'est jamais suggérée (elle n'est pas un soir).
export function soirsSansDiner(menu: MenuDay[], reserve: ReserveLigne[]): SoirJoker[] {
  const out: SoirJoker[] = [];
  for (const day of menu) {
    if (day.dinerFamille || day.dinerMelanie) continue;
    const cle = day.jour.trim().toLowerCase();
    const ligne = reserve.find((l) => l.cle === cle);
    if (ligne) out.push({ jour: day.jour, ligne });
  }
  return out;
}
```

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/lib/batch.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/lib/batch.test.ts src/lib/batch.ts
git commit -m "feat: lib batch — ids de réserve et soirs sans dîner"
```

---

### Task 4: Renommage Batch → « Mon Rituel » (libellés)

**Files:**
- Modify: `src/components/cuisine/CuisineView.tsx:13`
- Modify: `src/components/cuisine/BatchView.tsx:77,96,105,225`
- Test: `tests/components.test.tsx`, `tests/app.test.tsx`

- [ ] **Step 1: Mettre à jour les tests (rouge)**

Dans `tests/components.test.tsx` (describe `BatchView v2 — rituel et micro-batch`), remplacer :

- `name: /Lancer le batch/` → `name: /Lancer le rituel/` (occurrences lignes 793, 811, 818, 920, 930, 949)
- `screen.getByText('Batch terminé !')` → `screen.getByText('Rituel terminé !')` (ligne 800)
- `screen.getByText('Aucun batch prévu cette semaine.')` → `screen.getByText('Aucun rituel prévu cette semaine.')` (lignes 824, 834) et `queryByText('Aucun batch prévu cette semaine.')` → `queryByText('Aucun rituel prévu cette semaine.')` (ligne 943)
- nom du test ligne 790 : `'mode guidé : Lancer le rituel → étape par étape → écran terminé → retour aperçu (sans cocher)'`
- nom du test ligne 946 : `'« Lancer le rituel » est un bouton pleine largeur sous la timeline (plus de pilule dans le head)'`
- ligne 492 : `expect(screen.getByRole('button', { name: 'Mon Rituel' })).toHaveClass('tab');`

Dans `tests/app.test.tsx` ligne 208 :

```ts
    await user.click(screen.getByRole('button', { name: 'Mon Rituel' }));
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/components.test.tsx tests/app.test.tsx`
Expected: FAIL (les libellés affichent encore « Batch »)

- [ ] **Step 3: Implémentation**

`src/components/cuisine/CuisineView.tsx` ligne 13 (l'id de nav `batch` reste — seul le libellé change) :

```ts
  { id: 'batch', label: 'Mon Rituel' },
```

`src/components/cuisine/BatchView.tsx` — 4 libellés :

- ligne 77 : `{idx + 1 < rituel.length ? 'Étape terminée →' : 'Terminer le rituel ✓'}`
- ligne 96 : `<h3 className="guide-titre">Rituel terminé !</h3>`
- ligne 105 : `{!hasRituel && !hasMicro && !hasReserve && <p className="muted">Aucun rituel prévu cette semaine.</p>}`
- ligne 225 : `<Icon name="play" size={14} /> Lancer le rituel`

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/components.test.tsx tests/app.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/components.test.tsx tests/app.test.tsx src/components/cuisine/CuisineView.tsx src/components/cuisine/BatchView.tsx
git commit -m "feat: renommage Batch → Mon Rituel (libellés)"
```

---

### Task 5: Mode guidé recette-aware (fiche recette dépliable)

**Files:**
- Modify: `src/components/cuisine/BatchView.tsx`
- Modify: `src/components/cuisine/CuisineView.tsx:80-90`
- Modify: `src/index.css` (section « Batch : lancer + mode guidé »)
- Test: `tests/components.test.tsx`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/components.test.tsx`, compléter l'import type en tête du fichier (garder les types déjà importés) :

```ts
import type { MenuDay, Recette, ReserveLigne } from '../src/lib/model';
```

Dans le describe `BatchView v2 — rituel et micro-batch`, après les fixtures `RITUEL`/`MICRO` (ligne ~726), ajouter :

```ts
  const RECETTE_BATCH: Recette = {
    id: 'r7-roti-de-dinde-gratin-courgettes-quinoa',
    nom: 'R7 · Rôti de dinde + gratin courgettes + quinoa',
    temps: '60 min · four 180°',
    pour: 'rôti de dinde ~800 g · 4 courgettes · 15 cl crème + 80 g râpé · 300 g quinoa',
    etapes: [
      'Four 180°. Rôti : huile + herbes + sel, 50-55 min.',
      'Gratin : courgettes précuites + crème + fromage, 25 min.',
      'Quinoa 15 min — en double.',
    ],
  };
  const RITUEL_AVEC_REF = [{ ...RITUEL[0], ref: 'r7' }, ...RITUEL.slice(1)];
```

Et en fin de describe :

```ts
  it('mode guidé : une étape avec ref affiche la fiche recette dépliable', async () => {
    const user = userEvent.setup();
    render(
      <BatchView rituel={RITUEL_AVEC_REF} recettes={[RECETTE_BATCH]} microBatch={[]} semaine="2026-S39" />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    const btn = screen.getByRole('button', { name: 'Voir la fiche recette' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('60 min · four 180°')).toBeInTheDocument();
    expect(screen.getByText('Gratin : courgettes précuites + crème + fromage, 25 min.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Masquer la fiche' }));
    expect(screen.queryByText('60 min · four 180°')).toBeNull();
  });

  it('étape sans ref : pas de fiche recette', async () => {
    const user = userEvent.setup();
    render(
      <BatchView rituel={RITUEL_AVEC_REF} recettes={[RECETTE_BATCH]} microBatch={[]} semaine="2026-S39" />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    await user.click(screen.getByRole('button', { name: 'Étape terminée →' }));
    expect(screen.queryByRole('button', { name: /fiche recette/ })).toBeNull();
  });

  it('ref cassée : repli silencieux (pas de fiche, pas de crash)', async () => {
    const user = userEvent.setup();
    render(
      <BatchView
        rituel={[{ ...RITUEL[0], ref: 'r99' }]}
        recettes={[RECETTE_BATCH]}
        microBatch={[]}
        semaine="2026-S39"
      />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    expect(screen.queryByRole('button', { name: /fiche recette/ })).toBeNull();
    expect(document.querySelector('.guide-titre')).toHaveTextContent('Four à 180°');
  });
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/components.test.tsx -t "fiche recette"`
Expected: FAIL (pas de prop `recettes` ni de bouton fiche)

- [ ] **Step 3: Implémentation — `src/components/cuisine/BatchView.tsx`**

3a. Imports (en tête) :

```ts
import { useRef, useState } from 'react';
import type { MicroBatchJour, Recette, ReserveLigne, RituelEtape } from '../../lib/model';
import { getChecks, setCheck } from '../../lib/storage';
import { todayKey } from '../../lib/dates';
import { capitalize } from '../../lib/text';
import { dureeRituel, iconeReserve } from '../../lib/batch';
import { recetteParRef } from '../../lib/stats';
import { Icon } from '../Icon';
```

3b. Signature du composant — ajouter `recettes` :

```ts
export function BatchView({
  rituel,
  microBatch,
  reserve,
  production,
  termine,
  recettes = [],
  semaine,
  syncVersion = 0,
}: {
  rituel?: RituelEtape[];
  microBatch?: MicroBatchJour[];
  reserve?: ReserveLigne[];
  production?: string;
  termine?: string;
  recettes?: Recette[];
  semaine: string;
  syncVersion?: number;
}) {
```

3c. Après la ligne `const ceSoir = microBatch?.find((m) => m.jour === todayKey());`, ajouter :

```ts
  // Fiche recette de l'étape en cours (mode guidé) — ref cassée → undefined.
  const etape = rituel?.[idx];
  const recetteEtape = mode === 'run' && etape?.ref ? recetteParRef(etape.ref, recettes) : undefined;
```

3d. Dans le bloc du mode guidé, insérer la fiche entre le détail et la barre de progression :

```tsx
          {rituel[idx].detail && <p className="guide-detail">{rituel[idx].detail}</p>}
          {recetteEtape && <FicheRecette recette={recetteEtape} />}
          <progress value={idx} max={rituel.length} aria-hidden="true" />
```

3e. Ajouter le composant (avant `function MicroBatch`) :

```tsx
function FicheRecette({ recette }: { recette: Recette }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <div className="guide-fiche">
      <button
        type="button"
        className="guide-fiche-btn"
        aria-expanded={ouverte}
        onClick={() => setOuverte(!ouverte)}
      >
        <Icon name="box" size={14} />
        {ouverte ? 'Masquer la fiche' : 'Voir la fiche recette'}
      </button>
      {ouverte && (
        <div className="fiche-corps">
          {recette.temps && (
            <p className="fiche-temps">
              <Icon name="clock" size={14} /> {recette.temps}
            </p>
          )}
          {recette.pour && (
            <>
              <p className="fiche-soustitre">Ingrédients</p>
              <p className="fiche-pour">{recette.pour}</p>
            </>
          )}
          {recette.etapes && recette.etapes.length > 0 && (
            <>
              <p className="fiche-soustitre">Étapes</p>
              <ol className="fiche-etapes">
                {recette.etapes.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

3f. `src/components/cuisine/CuisineView.tsx` — passer les recettes :

```tsx
      {tab === 'batch' && (
        <BatchView
          rituel={data.rituel}
          microBatch={data.microBatch}
          reserve={data.reserve}
          production={data.rituelProduction}
          termine={data.rituelTermine}
          recettes={data.recettes}
          semaine={semaine}
          syncVersion={syncVersion}
        />
      )}
```

- [ ] **Step 4: CSS — `src/index.css`**

Dans la section `/* ---------- Batch : lancer + mode guidé ---------- */`, après le bloc `.guide-detail { … }` (ligne ~1489), insérer :

```css
.guide-fiche {
  width: 100%;
}
.guide-fiche-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-6);
  min-height: 42px;
  padding: var(--sp-8) var(--sp-14);
  border: 1px dashed var(--accent);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--accent);
  font: 600 var(--fs-sec) Poppins, sans-serif;
}
.fiche-corps {
  width: 100%;
  padding: var(--sp-12);
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg);
}
.fiche-soustitre {
  margin: 0 0 var(--sp-4);
  font-size: var(--fs-micro);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent);
}
.fiche-temps {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-6);
  margin: 0 0 var(--sp-8);
  font-size: var(--fs-sec);
  font-weight: 600;
}
.fiche-pour {
  margin: 0;
  font-size: var(--fs-sec);
  line-height: var(--lh-body);
}
.fiche-etapes {
  margin: 0;
  padding-left: var(--sp-20);
  font-size: var(--fs-sec);
  line-height: var(--lh-body);
  display: grid;
  gap: var(--sp-4);
}
```

- [ ] **Step 5: Vérifier le vert**

Run: `npx vitest run tests/components.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/components.test.tsx src/components/cuisine/BatchView.tsx src/components/cuisine/CuisineView.tsx src/index.css
git commit -m "feat: Mon Rituel — fiche recette dans le mode guidé"
```

---

### Task 6: Micro-batch enrichi (pills durée/quantité + ref recette)

**Files:**
- Modify: `src/components/cuisine/BatchView.tsx` (composant `MicroBatch`)
- Modify: `src/index.css` (section Batch)
- Test: `tests/components.test.tsx`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans le describe `BatchView v2 — rituel et micro-batch` :

```ts
  it('micro-batch enrichi : pills durée/quantité + chip recette', () => {
    render(
      <BatchView
        rituel={RITUEL}
        recettes={[RECETTE_BATCH]}
        microBatch={[{ jour: 'mardi', quoi: 'précuire brocolis', duree: '10 min', quantite: '2 boîtes', ref: 'r7' }]}
        semaine="2026-S39"
      />,
    );
    expect(document.querySelectorAll('.micro-pill')).toHaveLength(2);
    expect(screen.getByText('10 min')).toBeInTheDocument();
    expect(screen.getByText('2 boîtes')).toBeInTheDocument();
    expect(document.querySelector('.micro-ref')).toHaveTextContent('Rôti de dinde');
    expect(document.querySelector('.micro-jour-detail')).toBeNull();
  });

  it('micro-batch avec ref cassée : la ref brute s affiche (repli)', () => {
    render(
      <BatchView
        rituel={RITUEL}
        microBatch={[{ jour: 'lundi', quoi: 'X', ref: 'r99' }]}
        semaine="2026-S39"
      />,
    );
    expect(document.querySelector('.micro-ref')).toHaveTextContent('r99');
  });
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/components.test.tsx -t "micro-batch"`
Expected: FAIL (`.micro-pill`/`.micro-ref` absents)

- [ ] **Step 3: Implémentation — composant `MicroBatch`**

Remplacer le composant, et mettre à jour son appel : `{hasMicro && mode === 'apercu' && microBatch && <MicroBatch jours={microBatch} recettes={recettes} />}`.

```tsx
function MicroBatch({ jours, recettes = [] }: { jours: MicroBatchJour[]; recettes?: Recette[] }) {
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
        {jours.map((m) => {
          const recette = m.ref ? recetteParRef(m.ref, recettes) : undefined;
          return (
            <div className="micro-jour" key={m.jour}>
              <div className="micro-jour-nom">{capitalize(m.jour)}</div>
              <div className="micro-jour-quoi">{m.quoi}</div>
              {(m.duree || m.quantite || m.ref) && (
                <div className="micro-meta">
                  {m.duree && (
                    <span className="micro-pill">
                      <Icon name="clock" size={14} /> {m.duree}
                    </span>
                  )}
                  {m.quantite && (
                    <span className="micro-pill">
                      <Icon name="box" size={14} /> {m.quantite}
                    </span>
                  )}
                  {m.ref && (
                    <span className="micro-ref">{recette ? nomCourt(recette.nom) : m.ref}</span>
                  )}
                </div>
              )}
              {m.detail && <div className="micro-jour-detail">{m.detail}</div>}
            </div>
          );
        })}
      </div>
      <div className="micro-dots" aria-hidden="true">
        {jours.map((_, i) => (
          <i key={i} className={i === actif ? 'on' : ''} />
        ))}
      </div>
    </section>
  );
}
```

Ajouter l'import de `nomCourt` :

```ts
import { nomCourt } from '../../lib/menu';
```

- [ ] **Step 4: CSS — `src/index.css`**

Après le bloc `.micro-jour-quoi { … }` (ligne ~1364), insérer :

```css
.micro-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4);
  margin-top: var(--sp-6);
}

.micro-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-2) var(--sp-8);
  border-radius: 7px;
  background: var(--surface-2);
  color: var(--text);
  font-size: var(--fs-micro);
  font-weight: 600;
  line-height: var(--lh-tight);
  white-space: nowrap;
}

.micro-ref {
  display: inline-flex;
  align-items: center;
  padding: var(--sp-2) var(--sp-8);
  border-radius: 7px;
  border: 1px dashed var(--accent);
  color: var(--accent);
  font-size: var(--fs-micro);
  font-weight: 700;
  line-height: var(--lh-tight);
  white-space: nowrap;
}
```

- [ ] **Step 5: Vérifier le vert**

Run: `npx vitest run tests/components.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/components.test.tsx src/components/cuisine/BatchView.tsx src/index.css
git commit -m "feat: Mon Rituel — micro-batch enrichi (durée, quantité, recette)"
```

---

### Task 7: Réserve avec état (disponible / consommé)

**Files:**
- Modify: `src/components/cuisine/BatchView.tsx` (composant `Reserve`)
- Modify: `src/index.css` (section Batch)
- Test: `tests/components.test.tsx`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans le describe `BatchView v2 — rituel et micro-batch` :

```ts
  it('réserve : état disponible/consommé persisté sous reserve:{cle}:{plat}', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BatchView
        rituel={RITUEL}
        microBatch={[]}
        reserve={[{ cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' }]}
        semaine="2026-S39"
      />,
    );
    const ligne = container.querySelector('.reserve-ligne')!;
    expect(ligne).not.toHaveClass('consomme');
    expect(ligne.querySelector('.reserve-etat')).toHaveTextContent('Disponible');
    await user.click(screen.getByRole('checkbox', { name: 'Poulet-riz — marquer consommé' }));
    expect(getChecks('2026-S39')).toEqual({ 'reserve:lundi:poulet-riz': true });
    expect(ligne.querySelector('.reserve-etat')).toHaveTextContent('Consommé');
    expect(ligne).toHaveClass('consomme');
  });

  it('la réserve porte l explication d une ligne', () => {
    render(
      <BatchView
        reserve={[{ cle: 'mel', plat: 'Box keto', conservation: 'à part' }]}
        semaine="2026-S39"
      />,
    );
    expect(screen.getByText('Les plats d’avance qui attendent leur soir.')).toBeInTheDocument();
  });

  it('réserve : resynchronise l état au changement de semaine (render-phase reset)', () => {
    const { rerender } = render(
      <BatchView
        rituel={RITUEL}
        microBatch={[]}
        reserve={[{ cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' }]}
        semaine="2026-S39"
      />,
    );
    setCheck('2026-S39', 'reserve:lundi:poulet-riz', true);
    rerender(
      <BatchView
        rituel={RITUEL}
        microBatch={[]}
        reserve={[{ cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' }]}
        semaine="2026-S40"
      />,
    );
    expect(document.querySelector('.reserve-etat')).toHaveTextContent('Disponible');
  });
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/components.test.tsx -t "réserve"`
Expected: FAIL (pas de `.reserve-etat`, pas d'explication)

- [ ] **Step 3: Implémentation — composant `Reserve`**

Remplacer le composant et son appel : `{mode === 'apercu' && hasReserve && reserve && <Reserve lignes={reserve} semaine={semaine} syncVersion={syncVersion} />}`.

```tsx
function Reserve({
  lignes,
  semaine,
  syncVersion = 0,
}: {
  lignes: ReserveLigne[];
  semaine: string;
  syncVersion?: number;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  // Pattern render-phase reset — cf. RituelTimeline : un changement remote
  // (syncVersion) ou de semaine relit le storage.
  const [synced, setSynced] = useState({ semaine, version: syncVersion });
  if (synced.semaine !== semaine || synced.version !== syncVersion) {
    setSynced({ semaine, version: syncVersion });
    setChecks(getChecks(semaine));
  }
  const toggle = (id: string) => {
    const next = !checks[id];
    setCheck(semaine, id, next);
    setChecks((prev) => ({ ...prev, [id]: next }));
  };
  return (
    <section className="batch-section">
      <h3>La réserve — au frigo cette semaine</h3>
      <p className="reserve-note">Les plats d’avance qui attendent leur soir.</p>
      <div className="reserve-list">
        {lignes.map((l, i) => {
          const id = reserveId(l);
          const consomme = !!checks[id];
          return (
            <label
              className={consomme ? 'reserve-ligne consomme' : 'reserve-ligne'}
              key={`${l.cle}-${i}`}
            >
              <input
                type="checkbox"
                checked={consomme}
                onChange={() => toggle(id)}
                aria-label={`${l.plat} — marquer consommé`}
              />
              <span className="reserve-ic">
                <Icon name={iconeReserve(l)} size={16} />
              </span>
              <span className="reserve-corps">
                <span className="reserve-nom">
                  {l.cle === 'mel' ? 'Mél' : capitalize(l.cle)} — {l.plat}
                </span>
                <span className="reserve-cons">{l.conservation}</span>
              </span>
              <span className={consomme ? 'reserve-etat fait' : 'reserve-etat'}>
                {consomme ? 'Consommé' : 'Disponible'}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
```

Ajouter l'import de `reserveId` :

```ts
import { dureeRituel, iconeReserve, reserveId } from '../../lib/batch';
```

- [ ] **Step 4: CSS — `src/index.css`**

Après le bloc `.reserve-cons { … }` (ligne ~1417), insérer :

```css
.reserve-note {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-micro);
  color: var(--muted);
  line-height: var(--lh-body);
}

.reserve-ligne {
  cursor: pointer;
}

.reserve-ligne input {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  flex-shrink: 0;
}

.reserve-ligne.consomme .reserve-nom,
.reserve-ligne.consomme .reserve-cons {
  text-decoration: line-through;
  opacity: 0.7;
}

.reserve-etat {
  margin-left: auto;
  padding: var(--sp-2) var(--sp-8);
  border-radius: 999px;
  font-size: var(--fs-micro);
  font-weight: 700;
  line-height: var(--lh-tight);
  white-space: nowrap;
  background: var(--surface-2);
  color: var(--text);
}

.reserve-etat.fait {
  background: color-mix(in srgb, var(--accent) 15%, var(--surface));
  color: var(--accent);
}
```

- [ ] **Step 5: Vérifier le vert**

Run: `npx vitest run tests/components.test.tsx && npm run typecheck`
Expected: PASS (y compris les tests réserve existants : `.reserve-ligne` compte toujours 4, textes « Mél — … » inchangés)

- [ ] **Step 6: Commit**

```bash
git add tests/components.test.tsx src/components/cuisine/BatchView.tsx src/index.css
git commit -m "feat: Mon Rituel — réserve avec état disponible/consommé"
```

---

### Task 8: Encart joker « Sors la réserve » dans le Menu

**Files:**
- Modify: `src/components/cuisine/MenuView.tsx`
- Modify: `src/components/cuisine/CuisineView.tsx:71-79`
- Modify: `src/index.css` (section « Menu v3 »)
- Test: `tests/components.test.tsx`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/components.test.tsx`, dans le describe `MenuView v3 — onglets par recette`, ajouter en fin de describe :

```ts
  const MENU_JOKER: MenuDay[] = [
    { jour: 'Lundi', dinerFamille: 'Chili + riz' },
    { jour: 'Mardi', dejeunerMarc: 'Restes' },
  ];
  const RESERVE_JOKER: ReserveLigne[] = [
    { cle: 'mardi', plat: 'Chili ×2', conservation: 'congélateur' },
  ];

  it('joker : un soir sans dîner prévu avec une ligne de réserve → encart « Sors la réserve »', async () => {
    const user = userEvent.setup();
    render(<MenuView menu={MENU_JOKER} reserve={RESERVE_JOKER} semaine="2026-S40" />);
    const joker = document.querySelector('.menu-joker');
    expect(joker).not.toBeNull();
    expect(joker).toHaveTextContent('Soir sans dîner prévu · Mardi');
    expect(joker).toHaveTextContent('Sors la réserve :');
    expect(joker).toHaveTextContent('Chili ×2');
    expect(joker).toHaveTextContent('(congélateur)');
    await user.click(screen.getByRole('button', { name: 'Sortie ✓' }));
    expect(getChecks('2026-S40')).toEqual({ 'reserve:mardi:chili-2': true });
    expect(document.querySelector('.joker-ligne.fait')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Soirée gérée ✓' })).toBeInTheDocument();
  });

  it('pas d encart quand tous les soirs ont un dîner', () => {
    render(
      <MenuView menu={[{ jour: 'Lundi', dinerFamille: 'Chili' }]} reserve={RESERVE_JOKER} semaine="2026-S40" />,
    );
    expect(document.querySelector('.menu-joker')).toBeNull();
  });

  it('pas d encart sans ligne de réserve correspondante', () => {
    render(
      <MenuView
        menu={MENU_JOKER}
        reserve={[{ cle: 'mercredi', plat: 'Chili', conservation: 'congel' }]}
        semaine="2026-S40"
      />,
    );
    expect(document.querySelector('.menu-joker')).toBeNull();
  });
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/components.test.tsx -t "joker"`
Expected: FAIL (pas de `.menu-joker`)

- [ ] **Step 3: Implémentation — `src/components/cuisine/MenuView.tsx`**

3a. Imports (en tête) :

```ts
import type { BaseCuisine, MenuDay, Recette, ReserveLigne } from '../../lib/model';
import { reserveId, soirsSansDiner } from '../../lib/batch';
import { capitalize } from '../../lib/text';
```

3b. Props — ajouter `reserve` :

```ts
export function MenuView({
  menu,
  recettes = [],
  bases = [],
  reserve,
  semaine,
  syncVersion = 0,
}: {
  menu: MenuDay[];
  recettes?: Recette[];
  bases?: BaseCuisine[];
  reserve?: ReserveLigne[];
  semaine: string;
  syncVersion?: number;
}) {
```

3c. Après `const faits = faitsParRecette(menu);`, ajouter :

```ts
  const jokers = soirsSansDiner(menu, reserve ?? []);
```

3d. Après `basculerPaire`, ajouter :

```ts
  // Joker réserve : cocher = réserve consommée (même id que la section Réserve
  // de Mon Rituel — les deux vues restent synchronisées).
  const basculerJoker = (id: string) => {
    const next = !checks[id];
    setCheck(semaine, id, next);
    setChecks((prev) => ({ ...prev, [id]: next }));
  };
```

3e. Dans le JSX, entre le bloc `.menu-head` et le bloc `.rtabs`, insérer :

```tsx
      {jokers.length > 0 && (
        <div className="menu-joker" role="group" aria-label="Réserve à sortir">
          {jokers.map((j) => {
            const id = reserveId(j.ligne);
            const sorti = !!checks[id];
            return (
              <div className={sorti ? 'joker-ligne fait' : 'joker-ligne'} key={id}>
                <span className="joker-corps">
                  <span className="joker-titre">Soir sans dîner prévu · {capitalize(j.jour)}</span>
                  <span className="joker-suggestion">
                    Sors la réserve : <b>{j.ligne.plat}</b> ({j.ligne.conservation})
                  </span>
                </span>
                <button
                  type="button"
                  className={sorti ? 'joker-cta fait' : 'joker-cta'}
                  aria-pressed={sorti}
                  onClick={() => basculerJoker(id)}
                >
                  {sorti ? 'Soirée gérée ✓' : 'Sortie ✓'}
                </button>
              </div>
            );
          })}
        </div>
      )}
```

3f. `src/components/cuisine/CuisineView.tsx` — passer la réserve :

```tsx
      {tab === 'menu' && (
        <MenuView
          menu={data.menu}
          recettes={data.recettes}
          bases={data.bases}
          reserve={data.reserve}
          semaine={semaine}
          syncVersion={syncVersion}
        />
      )}
```

- [ ] **Step 4: CSS — `src/index.css`**

Dans la section `/* ---------- Menu v3 (onglets par recette) ---------- */`, après le bloc `.menu-head { … }` (ligne ~870), insérer :

```css
.menu-joker {
  display: grid;
  gap: var(--sp-8);
  margin-bottom: var(--sp-10);
}

.joker-ligne {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-8);
  padding: var(--sp-10) var(--sp-12);
  border: 1px solid var(--border);
  border-left: 4px solid var(--accent);
  border-radius: 14px;
  background: var(--surface);
}

.joker-ligne.fait {
  border-left-color: var(--border);
  opacity: 0.75;
}

.joker-corps {
  min-width: 0;
  flex: 1 1 180px;
}

.joker-titre {
  display: block;
  font-size: var(--fs-micro);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--accent);
}

.joker-suggestion {
  display: block;
  margin-top: var(--sp-2);
  font-size: var(--fs-sec);
  line-height: var(--lh-body);
}

.joker-cta {
  flex-shrink: 0;
  min-height: 48px;
  padding: 0 var(--sp-16);
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: #ffffff;
  font: 700 var(--fs-sec) Poppins, sans-serif;
}

.joker-cta.fait {
  background: var(--surface-2);
  color: var(--accent);
}
```

- [ ] **Step 5: Vérifier le vert**

Run: `npx vitest run tests/components.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/components.test.tsx src/components/cuisine/MenuView.tsx src/components/cuisine/CuisineView.tsx src/index.css
git commit -m "feat: Menu — encart « Sors la réserve » pour les soirs sans dîner"
```

---

### Task 9: Contrat .md & docs (sample, template, prompt IA, README, AGENTS, CHANGELOG)

**Files:**
- Modify: `src/assets/semaine-exemple.md`
- Modify: `docs/templates/template-semaine.md`
- Modify: `src/assets/prompt-cycle-template.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Test: `tests/parse.test.ts` (describe sample), `tests/app.test.tsx`

- [ ] **Step 1: Écrire les tests d'abord (rouge)**

Dans `tests/parse.test.ts`, describe `semaine-exemple.md — la sample réelle`, ajouter après le test « porte les nouveautés batch v3 » :

```ts
  it('porte les refs recette batch v4 (tâches, étapes, micro-batch) — 0 warning', () => {
    expect(data.batch.find((t) => t.label === 'Egg muffins ×10')?.ref).toBeTruthy();
    expect(data.rituel?.filter((e) => e.ref).length).toBeGreaterThanOrEqual(2);
    expect(data.microBatch?.some((m) => m.duree && m.quantite && m.ref)).toBe(true);
  });
```

Dans `tests/app.test.tsx`, describe `Semaine d'exemple — contenu réel`, après `expect(data.batch[0].label).toBe('Egg muffins ×10');` (ligne 404), ajouter :

```ts
    expect(data.batch[0].ref).toBe('R7');
    expect(data.rituel?.filter((e) => e.ref).length).toBeGreaterThanOrEqual(2);
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/parse.test.ts tests/app.test.tsx`
Expected: FAIL (la sample n'a pas encore de refs)

- [ ] **Step 3: `src/assets/semaine-exemple.md`**

3a. Section `### Rituel dimanche` (lignes 242-247) — refs en fin de 3 étapes (créneaux, labels, détails et ids inchangés) :

```markdown
### Rituel dimanche
- production: 2 boîtes frigo · 1 boîte congélateur · 1 sauce · 6 œufs durs — le quinoa ne tient pas la semaine : 2 jours au frigo max, le reste congelé.
- 0-5 min · Four à 180° — egg muffins ×10 lancés, on fait le reste → R7
- 5-30 min · Cuissons en double — dîner du soir ×2 + féculent ×2 → boîte lundi (+ cuisses de poulet du lundi) → R1
- 30-35 min · Œufs durs ×6-8 — boxes de la semaine pour Mél
- 35-50 min · Légumes + vinaigrette — laver, couper, ranger
- 50-60 min · Montage des boxes — boîte lundi Marc + 1 box keto Mél → R7
- termine: 4 boîtes prêtes — la semaine est servie. Prochain rituel : dimanche prochain, 13h45.
```

3b. Section `### Micro-batch` (lignes 249-252) — lundi en format v4 :

```markdown
### Micro-batch
- lundi: doubler le plat (boîtes mar/mer) | 10 min | 2 boîtes → R1 | la boîte de mardi passe au frigo
- mardi: doubler la sauce + courgettes en julienne (5 min le soir) | base sauce pour la semaine
- samedi: œufs durs ×6-8 | collations prêtes
```

3c. Tâches du gros batch (lignes 260-264) :

```markdown
- [ ] Egg muffins ×10 → R7
- [ ] 6-8 œufs durs (boxes keto de Mél)
- [ ] Doubler dinde + quinoa → boîte lundi Marc → R7
- [ ] Légumes de la semaine lavés/coupés
- [ ] Vinaigrette olive-citron
```

- [ ] **Step 4: `docs/templates/template-semaine.md`**

4a. Dans le commentaire d'en-tête (après la règle « Refs recette », ligne ~17), ajouter :

```
- Refs recette dans ## Batch : « → slug » en fin de tâche `- [ ]` et d'étape du
  rituel, et sur la quantité du micro-batch — la ref vise un slug de
  ## Recettes ; sans correspondance le texte reste dans le libellé. La ref
  n'entre JAMAIS dans l'id de coche : l'ajouter ou la retirer conserve l'état.
```

4b. Section `### Rituel dimanche` (lignes 95-102) — refs en exemple :

```markdown
### Rituel dimanche
- production: {{ce que le batch produit + conservation — ex. « 2 boîtes frigo · 1 boîte congélateur — le riz : 2 jours max au frigo »}}
- 0-5 min · Four à 180° — egg muffins ×10 lancés, on fait le reste → {{slug-recette si ref, ex. R7}}
- 5-30 min · Cuissons en double — {{dîner du soir ×2 + féculent ×2 → boîte lundi}} → {{slug-recette si ref}}
- 30-35 min · Œufs durs ×6-8 — boxes de la semaine pour Mél
- 35-50 min · Légumes + vinaigrette — laver, couper, ranger
- 50-60 min · Montage des boxes — boîte lundi Marc + 1 box keto Mél
- termine: {{message de fin du mode guidé — ex. « 4 boîtes prêtes — la semaine est servie. Prochain rituel : dimanche prochain, 13h45. »}}
```

4c. Section `### Micro-batch` (lignes 104-107) :

```markdown
### Micro-batch
- lundi: {{quoi}} | {{durée — ex. 10 min}} | {{quantité → slug-recette si ref — ex. 2 boîtes → R7}} | {{détail optionnel}}
- mardi: {{...}} | {{détail optionnel}}
<!-- Uniquement les jours du menu ; samedi = œufs durs ; un seul item par jour ;
la durée et la quantité sont optionnelles (v1 « | détail » seul acceptée) -->
```

4d. Tâches (lignes 115-116) :

```markdown
- [ ] Egg muffins ×10 → {{slug-recette si ref, ex. R7}}
- [ ] {{tâches du gros batch (3-5)}}
```

- [ ] **Step 5: `src/assets/prompt-cycle-template.md`**

5a. §4 Batch (lignes 41-47) — après « + 3-5 tâches `- [ ]` du gros batch. », ajouter :

```markdown
   Refs recette dans le batch : une tâche `- [ ]` ou une étape du rituel qui
   produit une recette du fichier porte `→ slug` en fin de ligne
   (`- [ ] Egg muffins ×10 → R7`) ; dans le micro-batch, la quantité porte la
   ref (`- mardi: précuire brocolis | 10 min | 2 boîtes → R7 | détail`) — la
   forme v1 (` | détail` seul) reste acceptée.
```

5b. Corps du template (lignes 126-149) : appliquer les mêmes exemples que `template-semaine.md` (étapes avec `→ {{slug-recette si ref}}`, micro-batch `| durée | quantité → slug | détail`, tâche `- [ ] Egg muffins ×10 → {{slug-recette si ref}}`).

5c. Checklist finale (lignes 204-213) — ajouter :

```markdown
- [ ] Refs recette du batch (tâches, étapes rituel, quantités micro-batch) → slugs présents dans ## Recettes
```

- [ ] **Step 6: `README.md`**

6a. Extrait sample (lignes 69-70, 74, 81) — aligner sur la sample :

```markdown
- 0-5 min · Four à 180° — egg muffins ×10 lancés, on fait le reste → R7
- 5-30 min · Cuissons en double — dîner du soir ×2 + féculent ×2 → boîte lundi
```

```markdown
- lundi: doubler le plat (boîtes mar/mer) | 10 min | 2 boîtes → R1 | la boîte de mardi passe au frigo
```

```markdown
- [ ] Egg muffins ×10 → R7
- [ ] Doubler dinde + quinoa → boîte lundi Marc
```

6b. Règle `## Batch` (ligne 111) — remplacer par :

```markdown
- `## Batch` : la checklist `- [ ]`, plus trois blocs optionnels — `### Rituel dimanche` (étapes `- <créneau> · <label> — <détail>`, cochables en timeline, plus les lignes-clés `- production:` et `- termine:` — badge de durée calculé par l'app), `### Micro-batch` (`- jour: quoi | durée | quantité → slug | détail` — la forme v1 ` | détail` reste acceptée, carrousel horizontal) et `### Réserve` (`- <jour|mel>: <plat> | <conservation>`, plats stockés, état disponible/consommé cochable). Une référence `→ slug` en fin de tâche ou d'étape (ou sur la quantité du micro-batch) lie l'étape à une recette : le mode guidé affiche alors sa fiche.
```

6c. Ids (ligne 114) — remplacer par :

```markdown
- **Ids de coches stables**, dérivés du contenu : `courses:…`, `batch:…`, `batch:rituel:…`, `reserve:…`, `seances:…` — renommer un item = perdre son état coché. La ref `→ slug` n'entre jamais dans l'id : l'ajouter ou la retirer conserve l'état.
```

6d. Écran Cuisine (ligne 145) : « Trois sous-onglets partagés (Courses · Menu · Batch) » → « Trois sous-onglets partagés (Courses · Menu · Mon Rituel) ».

6e. Ligne 152 — remplacer par :

```markdown
- **Mon Rituel** : le rituel du dimanche s'affiche en **timeline cochable** et se lance en **mode guidé** — chaque étape portant une ref recette déplie sa fiche (ingrédients, étapes, temps, four) ; le micro-batch en **carrousel** enrichi (durée, quantité, recette) ; la réserve affiche son état (disponible/consommé). Un soir sans dîner prévu déclenche l'encart « Sors la réserve » dans le Menu.
```

- [ ] **Step 7: `AGENTS.md`**

7a. Ligne 10 : « Courses / Menu / Batch » → « Courses / Menu / Mon Rituel ».

7b. Ligne 82 — remplacer la description de `## Batch` par :

```markdown
- Sections : `## Courses` (### rayons + items, un rayon `### Keto` = encadré dédié), `## Menu` (### jours + `- clé: texte` avec les 5 clés valides, refs `→ <slug recette>` autorisées), `## Batch` (`- [ ]` tâches, ref `→ <slug recette>` optionnelle + `### Rituel dimanche` (étapes `- <créneau> · <label> — <détail>`, ref optionnelle en fin de ligne, lignes-clés `- production:` / `- termine:`) + `### Micro-batch` (`- jour: quoi | durée | quantité → slug | détail` — ` | détail` seul reste accepté) + `### Réserve` (`- <jour|mel>: <plat> | <conservation>`)), `## Recettes` (optionnel : `temps:`, `kcal:`, `proteines:`, `glucides:`, `lipides:`, `score:` (entier 0-10), `image:` (URL https), `bases:`, `- pour 4:`, étapes numérotées, `- mel:`, `- batch:`), `## Bases` (optionnel), `## Marc`, `## Melanie`
```

7c. Ligne 83 — ajouter `reserve:{jour|mel}:{slug-plat}` à la liste des ids :

```markdown
- Les ids de coches (`courses:…`, `batch:…`, `batch:rituel:…`, `reserve:{jour|mel}:{slug-plat}`, `menu:{jour}:{clé}`, `seances:marc:…`, `seances:melanie:…`) sont **stables** : ne jamais les modifier, sinon les états cochés se perdent. La ref `→ slug` des tâches/étapes/micro-batch n'entre jamais dans l'id.
```

- [ ] **Step 8: `CHANGELOG.md`** — insérer après la ligne 6 (avant `## [1.3.0]`) :

```markdown
## [Non publié]

### Ajouté

- Mon Rituel (ex-onglet Batch) : références recette sur les tâches et les étapes du rituel (`- [ ] Egg muffins ×10 → R7`, extension rétrocompatible du contrat .md), fiche recette dépliable à chaque étape du mode guidé, micro-batch enrichi (durée, quantité, recette liée), réserve avec état disponible/consommé et joker interactif dans le Menu (un soir sans dîner prévu → « Sors la réserve : … », coche = consommée).
```

- [ ] **Step 9: Vérifier le vert (sample = 0 warning partout)**

Run: `npx vitest run tests/parse.test.ts tests/app.test.tsx tests/menu.test.ts && npm run typecheck`
Expected: PASS (la sample parse avec `warnings: []`, les refs pointent toutes vers R1/R7)

- [ ] **Step 10: Commit**

```bash
git add src/assets/semaine-exemple.md docs/templates/template-semaine.md src/assets/prompt-cycle-template.md README.md AGENTS.md CHANGELOG.md tests/parse.test.ts tests/app.test.tsx
git commit -m "docs: contrat .md batch v4 (refs, micro enrichi, réserve) — sample, template, prompt, README"
```

---

### Task 10: e2e, portes finales et Pull Request

**Files:**
- Modify: `tests/e2e/cuisine.spec.ts`

- [ ] **Step 1: Mettre à jour les e2e (rouge)**

Dans `tests/e2e/cuisine.spec.ts` :

- ligne 192 : `await page.getByRole('button', { name: 'Mon Rituel' }).click();`
- lignes 215-223 — remplacer le parcours guidé par :

```ts
    // Parcours guidé : l'étape 1 (Four à 180° → R7) affiche la fiche recette
    // dépliable ; le run ne coche aucune étape — au retour à l'aperçu, la
    // timeline retrouve ses 5 étapes dans leur état d'origine.
    await page.getByRole('button', { name: 'Lancer le rituel' }).click();
    await page.getByRole('button', { name: 'Voir la fiche recette' }).click();
    await expect(page.locator('.fiche-corps')).toContainText('four 180°');
    await page.getByRole('button', { name: 'Étape terminée →' }).click();
    // Étape 2 sans ref : plus de fiche.
    await expect(page.getByRole('button', { name: 'Voir la fiche recette' })).toHaveCount(0);
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Étape terminée →' }).click();
    }
    await page.getByRole('button', { name: 'Terminer le rituel ✓' }).click();
    await expect(page.locator('.batch-guide')).toContainText('Rituel terminé');
    await page.getByRole('button', { name: "Revoir l'aperçu" }).click();
    await expect(page.locator('.rituel-timeline')).toBeVisible();
    await expect(page.locator('.rituel-etape.done')).toHaveCount(0);
```

- après la ligne 211 (`.micro-dots i`), ajouter les assertions des nouveautés :

```ts
    await expect(page.locator('.micro-pill').first()).toBeVisible();
    await expect(page.locator('.micro-ref')).toHaveCount(1);
    await expect(page.locator('.reserve-note')).toContainText("plats d'avance");
    await expect(page.locator('.reserve-etat').first()).toContainText('Disponible');
```

- ligne 235 : `for (const onglet of ['Courses', 'Menu', 'Mon Rituel']) {`

- [ ] **Step 2: Portes finales**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```
Expected: tout PASS.

- [ ] **Step 3: e2e (build de prod — même mode que le workflow Deploy)**

```bash
npm run e2e:preview
```
Expected: PASS (zéro débordement sur 320/375 pour les 3 sous-onglets, fiche guidée incluse). En cas de débordement lié aux nouveaux blocs, vérifier `flex-wrap` + `min-width: 0` (`.joker-ligne` wrap déjà prévu).

- [ ] **Step 4: Push et Pull Request**

```bash
git push -u origin feat/ux-v14-vague2-batch
gh pr create --title "feat: UX v1.4 vague 2 — volet Batch (Mon Rituel, refs recette, réserve, joker)" --body "Implémente le volet Batch de la vague 2 v1.4 (spec docs/superpowers/specs/2026-09-18-refonte-ux-v14-design.md § 4.2-4.4) : renommage Mon Rituel, refs recette sur tâches/étapes/micro-batch (contrat étendu rétrocompatible), fiche recette dans le mode guidé, réserve avec état, joker « Sors la réserve » dans le Menu."
```

Attendre la CI PR (`.github/workflows/ci.yml`) verte avant le merge — ne jamais merger un état qui ne build pas.

---

## Auto-revue (exécutée à l'écriture du plan)

1. **Couverture spec (§ 4.2-4.4)** :
   - 4.2 renommage → Task 4 ; refs contrat + mode guidé recette-aware → Tasks 1, 2, 5 ; « timeline, durée cumulée, production/termine restent » → aucun de ces éléments n'est modifié (vérifié : seule la fiche s'insère entre détail et progress).
   - 4.3 micro-batch enrichi (durée, quantité, ref, bannière Ce soir intacte) → Tasks 2, 6.
   - 4.4 réserve (conservation + état, suggestion auto, coche = consommée, jour « déjà géré », explication d'une ligne) → Tasks 3, 7, 8.
2. **Contrat & rétrocompatibilité** : la sample, le template, le prompt IA, README et AGENTS.md sont alignés (Task 9) ; les ids de coches existants ne changent pas (refs hors id — testé Task 1 Step 1).
3. **Cohérence des types** : `ref?: string` (ChecklistItem, RituelEtape, MicroBatchJour), `duree?`/`quantite?` (MicroBatchJour), `SoirJoker { jour, ligne }`, `reserveId(ligne)`, `soirsSansDiner(menu, reserve)` — mêmes noms dans les Tasks 1-8.
4. **Sync** : rien à faire (vague 2 : ids techniques inchangés ; les nouvelles coches `reserve:` passent par `setCheck` → outbox automatique).
5. **PWA/offline** : aucune dépendance nouvelle, aucun changement de manifest/sw.

