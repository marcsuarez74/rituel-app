import exemple from '../src/assets/semaine-exemple.md?raw';
import { parseWeeklyFile, slugify } from '../src/lib/parse';

const FULL_WEEK = `---
semaine: 2026-S39
menu: A
titre: Menu A — Base poulet & bolo
du: 2026-09-21
au: 2026-09-27
---

## Courses
### Fraîcheur
- Poulet 600 g
- Yaourts skyr

### Épicerie
- Riz basmati
- Huile olive

## Menu
### Lundi
- dejeuner-marc: Poulet riz
- dejeuner-melanie: Salade poulet
- diner-famille: Bolo pâtes

### Mardi
- diner-famille: Curry légumes
- diner-melanie: Curry keto
- batch: Riz à l'avance

## Batch
- [ ] Cuire le riz
- [x] Sauce bolo
- Couper les légumes

## Marc
### Cibles
- 2200 kcal
- 150 g de protéines

### Séances
- [ ] PPG lundi
- Course 30 min

### Rappels
- Pesée le lundi

## Melanie
### Cibles
- 1600 kcal

### Séances
- [ ] Yoga mardi

### Rappels
- Pesée le lundi
`;

function frontmatterOnly(): string {
  return `---
semaine: 2026-S39
menu: A
du: 2026-09-21
au: 2026-09-27
---
`;
}

describe('parseWeeklyFile — semaine complète', () => {
  const { data, warnings } = parseWeeklyFile(FULL_WEEK);

  it('parse le frontmatter (meta) avec du/au toujours en chaînes', () => {
    expect(data.meta).toEqual({
      semaine: '2026-S39',
      menu: 'A',
      du: '2026-09-21',
      au: '2026-09-27',
      titre: 'Menu A — Base poulet & bolo',
    });
    expect(typeof data.meta.du).toBe('string');
    expect(typeof data.meta.au).toBe('string');
  });

  it('parse Courses avec rayons et préfixes d’id', () => {
    expect(data.courses).toEqual([
      { id: 'courses:fraicheur:poulet-600-g', rayon: 'fraicheur', label: 'Poulet 600 g' },
      { id: 'courses:fraicheur:yaourts-skyr', rayon: 'fraicheur', label: 'Yaourts skyr' },
      { id: 'courses:epicerie:riz-basmati', rayon: 'epicerie', label: 'Riz basmati' },
      { id: 'courses:epicerie:huile-olive', rayon: 'epicerie', label: 'Huile olive' },
    ]);
  });

  it('parse Menu avec clés mappées en camelCase et champs absents undefined', () => {
    expect(data.menu).toEqual([
      {
        jour: 'Lundi',
        dejeunerMarc: 'Poulet riz',
        dejeunerMelanie: 'Salade poulet',
        dinerFamille: 'Bolo pâtes',
      },
      {
        jour: 'Mardi',
        dinerFamille: 'Curry légumes',
        dinerMelanie: 'Curry keto',
        batch: "Riz à l'avance",
      },
    ]);
    expect(data.menu[0].dinerMelanie).toBeUndefined();
    expect(data.menu[0].batch).toBeUndefined();
    expect(data.menu[1].dejeunerMarc).toBeUndefined();
  });

  it('parse Batch (cases cochées ou non, items simples) avec ids, sans état done', () => {
    expect(data.batch).toEqual([
      { id: 'batch:cuire-le-riz', label: 'Cuire le riz' },
      { id: 'batch:sauce-bolo', label: 'Sauce bolo' },
      { id: 'batch:couper-les-legumes', label: 'Couper les légumes' },
    ]);
  });

  it('parse les profils Marc et Melanie', () => {
    expect(data.profiles.marc.cibles).toEqual(['2200 kcal', '150 g de protéines']);
    expect(data.profiles.marc.seances).toEqual([
      { id: 'seances:marc:ppg-lundi', label: 'PPG lundi' },
      { id: 'seances:marc:course-30-min', label: 'Course 30 min' },
    ]);
    expect(data.profiles.marc.rappels).toEqual(['Pesée le lundi']);

    expect(data.profiles.melanie.cibles).toEqual(['1600 kcal']);
    expect(data.profiles.melanie.seances).toEqual([
      { id: 'seances:melanie:yoga-mardi', label: 'Yoga mardi' },
    ]);
    expect(data.profiles.melanie.rappels).toEqual(['Pesée le lundi']);
  });

  it('ne produit aucun warning pour une semaine valide', () => {
    expect(warnings).toEqual([]);
  });
});

describe('parseWeeklyFile — variantes de checkboxes', () => {
  const { data } = parseWeeklyFile(`---
semaine: 2026-S40
menu: A
du: 2026-09-28
au: 2026-10-04
---

## Batch
- Plain item
- [ ] Todo item
- [x] Done item
`);

  it('parse - label, - [ ] label et - [x] label en items id+label uniquement', () => {
    expect(data.batch).toEqual([
      { id: 'batch:plain-item', label: 'Plain item' },
      { id: 'batch:todo-item', label: 'Todo item' },
      { id: 'batch:done-item', label: 'Done item' },
    ]);
  });
});

describe('parseWeeklyFile — en-tête avec accents', () => {
  const withAccent = parseWeeklyFile(`---
semaine: 2026-S41
menu: B
du: 2026-10-05
au: 2026-10-11
---

## Mélanie
### Rappels
- Pesée le lundi
`);
  const withoutAccent = parseWeeklyFile(`---
semaine: 2026-S41
menu: B
du: 2026-10-05
au: 2026-10-11
---

## Melanie
### Rappels
- Pesée le lundi
`);

  it('rattache ## Mélanie à profiles.melanie (slug sans accents)', () => {
    expect(withAccent.data.profiles.melanie.rappels).toEqual(['Pesée le lundi']);
  });

  it('## Melanie (sans accent) donne le même résultat', () => {
    expect(withoutAccent.data.profiles.melanie).toEqual(withAccent.data.profiles.melanie);
  });
});

describe('parseWeeklyFile — erreurs bloquantes', () => {
  it('sans frontmatter → throw « Frontmatter introuvable »', () => {
    expect(() => parseWeeklyFile('# Juste un titre, pas de frontmatter')).toThrow(
      /Frontmatter introuvable/,
    );
  });

  it('frontmatter incomplet (semaine manquante) → throw « Frontmatter incomplet »', () => {
    expect(() =>
      parseWeeklyFile(`---
menu: A
du: 2026-09-21
au: 2026-09-27
---
`),
    ).toThrow(/Frontmatter incomplet/);
  });

  it('du non ISO (21/09) → throw format AAAA-MM-JJ', () => {
    expect(() =>
      parseWeeklyFile(`---
semaine: 2026-S39
menu: A
du: 21/09
au: 2026-09-27
---
`),
    ).toThrow('Frontmatter incomplet : du et au doivent être au format AAAA-MM-JJ.');
  });

  it('au non ISO (2026-9-27) → throw format AAAA-MM-JJ', () => {
    expect(() =>
      parseWeeklyFile(`---
semaine: 2026-S39
menu: A
du: 2026-09-21
au: 2026-9-27
---
`),
    ).toThrow('Frontmatter incomplet : du et au doivent être au format AAAA-MM-JJ.');
  });
});

describe('parseWeeklyFile — corps vide', () => {
  const { data, warnings } = parseWeeklyFile(frontmatterOnly());

  it('produit toutes les sections vides', () => {
    expect(data.courses).toEqual([]);
    expect(data.menu).toEqual([]);
    expect(data.batch).toEqual([]);
    expect(data.profiles.marc.cibles).toEqual([]);
    expect(data.profiles.marc.seances).toEqual([]);
    expect(data.profiles.marc.rappels).toEqual([]);
    expect(data.profiles.melanie.cibles).toEqual([]);
    expect(data.profiles.melanie.seances).toEqual([]);
    expect(data.profiles.melanie.rappels).toEqual([]);
  });

  it('signale les 5 sections manquantes dans les warnings', () => {
    expect(warnings).toHaveLength(5);
    for (const section of ['courses', 'menu', 'batch', 'marc', 'melanie']) {
      expect(warnings.some((w) => w.includes(section))).toBe(true);
    }
  });
});

describe('parseWeeklyFile — clé menu inconnue', () => {
  const { data, warnings } = parseWeeklyFile(`---
semaine: 2026-S42
menu: C
du: 2026-10-12
au: 2026-10-18
---

## Menu
### Mercredi
- dessert: tarte
`);

  it('ignore la clé inconnue (non posée sur le jour)', () => {
    expect(data.menu).toEqual([{ jour: 'Mercredi' }]);
  });

  it('émet un warning mentionnant la clé et le jour', () => {
    expect(warnings.some((w) => w.includes('dessert') && w.includes('Mercredi'))).toBe(true);
  });
});

describe('stabilité des ids', () => {
  const week1 = parseWeeklyFile(`---
semaine: 2026-S39
menu: A
du: 2026-09-21
au: 2026-09-27
---

## Batch
- [ ] Cuire le riz
`);
  const week2 = parseWeeklyFile(`---
semaine: 2026-S40
menu: B
du: 2026-09-28
au: 2026-10-04
---

## Batch
- Cuire le riz
`);

  it('même label dans deux fichiers différents → même id', () => {
    expect(week1.data.batch[0].id).toBe('batch:cuire-le-riz');
    expect(week2.data.batch[0].id).toBe('batch:cuire-le-riz');
  });

  it('slugify gère accents, espaces et unités', () => {
    expect(slugify('Poulet 600 g')).toBe('poulet-600-g');
    expect(slugify('Mélanie')).toBe('melanie');
  });
});

describe('fins de ligne CRLF', () => {
  it('parse un fichier CRLF comme un fichier LF', () => {
    const lf = parseWeeklyFile(FULL_WEEK);
    const crlf = parseWeeklyFile(FULL_WEEK.replace(/\n/g, '\r\n'));
    expect(crlf.data).toEqual(lf.data);
    expect(crlf.warnings).toEqual(lf.warnings);
  });
});

function weekWith(body: string): string {
  return `---
semaine: 2026-S99
menu: X
du: 2026-12-21
au: 2026-12-27
---

${body}`;
}

describe('syntaxe supportée : puces *, cases [X], items indentés', () => {
  const { data, warnings } = parseWeeklyFile(weekWith(`## Courses
### Fraîcheur
* Poireaux

## Menu
### Jeudi
  - diner-famille: Soupe poireaux
* batch: Pain

## Batch
* [X] Cuire les poireaux
  - [ ] Préparer la soupe
`));

  it('parse les puces astérisque et les items indentés', () => {
    expect(data.courses).toEqual([
      { id: 'courses:fraicheur:poireaux', rayon: 'fraicheur', label: 'Poireaux' },
    ]);
    expect(data.menu).toEqual([{ jour: 'Jeudi', dinerFamille: 'Soupe poireaux', batch: 'Pain' }]);
    expect(data.batch).toEqual([
      { id: 'batch:cuire-les-poireaux', label: 'Cuire les poireaux' },
      { id: 'batch:preparer-la-soupe', label: 'Préparer la soupe' },
    ]);
  });

  it('traite [X] majuscule comme case cochée (préfixe retiré)', () => {
    expect(data.batch[0].label).toBe('Cuire les poireaux');
  });

  it('ne génère aucun warning de ligne ignorée', () => {
    expect(warnings.filter((w) => !w.startsWith('Section ##'))).toEqual([]);
  });
});

describe('lignes ignorées', () => {
  it('courses : ligne non reconnue → warning « Ligne ignorée »', () => {
    const { warnings } = parseWeeklyFile(weekWith(`## Courses
### Fraîcheur
Texte libre sans puce
`));
    expect(warnings).toContain('Ligne ignorée (courses) : « Texte libre sans puce »');
  });

  it('courses : une case à cocher devient un item normal (préfixe retiré, pas de warning)', () => {
    const { data, warnings } = parseWeeklyFile(weekWith(`## Courses
### Fraîcheur
- [x] Poulet 600 g
`));
    expect(data.courses).toEqual([
      { id: 'courses:fraicheur:poulet-600-g', rayon: 'fraicheur', label: 'Poulet 600 g' },
    ]);
    expect(warnings.filter((w) => !w.startsWith('Section ##'))).toEqual([]);
  });

  it('menu : paire clé:valeur avant tout jour → warning « Ligne ignorée »', () => {
    const { data, warnings } = parseWeeklyFile(weekWith(`## Menu
- diner-famille: Repas orphelin
`));
    expect(data.menu).toEqual([]);
    expect(warnings).toContain('Ligne ignorée (menu) : « - diner-famille: Repas orphelin »');
  });

  it('profils : item avant tout ### → warning « Ligne ignorée »', () => {
    const { data, warnings } = parseWeeklyFile(weekWith(`## Marc
- Orphelin

### Cibles
- 2200 kcal
`));
    expect(data.profiles.marc.cibles).toEqual(['2200 kcal']);
    expect(warnings).toContain('Ligne ignorée (marc) : « - Orphelin »');
  });

  it('profils : item sous un ### inconnu → warning « Ligne ignorée »', () => {
    const { data, warnings } = parseWeeklyFile(weekWith(`## Melanie
### Divers
- Perdu
`));
    expect(data.profiles.melanie).toEqual({ cibles: [], seances: [], rappels: [] });
    expect(warnings).toContain('Ligne ignorée (melanie) : « - Perdu »');
  });

  it('tronque le contenu des longues lignes ignorées', () => {
    const long = 'Ligne'.repeat(16);
    const { warnings } = parseWeeklyFile(weekWith(`## Courses
${long}
`));
    const w = warnings.find((x) => x.startsWith('Ligne ignorée (courses)'));
    expect(w).toBeDefined();
    expect(w?.includes('…')).toBe(true);
    expect(w?.includes(long)).toBe(false);
  });
});

describe('ids dupliqués', () => {
  const { data, warnings } = parseWeeklyFile(weekWith(`## Courses
### Fraîcheur
- Eau
- Eau

### Épicerie
- Eau

## Batch
- Riz
- Riz
- Sauce
`));

  it('garde tous les éléments (pas de dédoublonnage ni suffixe)', () => {
    expect(data.courses.map((i) => i.id)).toEqual([
      'courses:fraicheur:eau',
      'courses:fraicheur:eau',
      'courses:epicerie:eau',
    ]);
    expect(data.batch.map((i) => i.id)).toEqual(['batch:riz', 'batch:riz', 'batch:sauce']);
  });

  it('émet un warning par id dupliqué, pas pour les ids distincts', () => {
    expect(warnings.filter((w) => w.startsWith('Id dupliqué'))).toEqual([
      'Id dupliqué « courses:fraicheur:eau » (courses) — les éléments partagent leur état de coche.',
      'Id dupliqué « batch:riz » (batch) — les éléments partagent leur état de coche.',
    ]);
  });
});

describe('ids de séances par profil', () => {
  const { data, warnings } = parseWeeklyFile(weekWith(`## Marc
### Séances
- [ ] PPG lundi

## Melanie
### Séances
- PPG lundi
`));

  it('même label de séance dans les deux profils → ids différents (état de coche non partagé)', () => {
    expect(data.profiles.marc.seances[0].id).toBe('seances:marc:ppg-lundi');
    expect(data.profiles.melanie.seances[0].id).toBe('seances:melanie:ppg-lundi');
    expect(data.profiles.marc.seances[0].id).not.toBe(data.profiles.melanie.seances[0].id);
  });

  it('aucun warning d’id dupliqué pour un même label présent dans les deux profils', () => {
    expect(warnings.filter((w) => w.startsWith('Id dupliqué'))).toEqual([]);
  });
});

describe('section dupliquée', () => {
  it('deux fois ## Batch → warning et la seconde écrase la première', () => {
    const { data, warnings } = parseWeeklyFile(weekWith(`## Batch
- Un

## Batch
- Deux
`));
    expect(warnings).toContain('Section dupliquée « batch » — la seconde écrase la première.');
    expect(data.batch).toEqual([{ id: 'batch:deux', label: 'Deux' }]);
  });
});

describe('robustesse de l’entrée', () => {
  it('gère un BOM UTF-8 en tête de fichier', () => {
    const { data } = parseWeeklyFile('\uFEFF' + FULL_WEEK);
    expect(data.meta.semaine).toBe('2026-S39');
    expect(data.meta.au).toBe('2026-09-27');
  });

  it('rejette une valeur non textuelle dans le frontmatter (menu: 1)', () => {
    expect(() =>
      parseWeeklyFile(`---
semaine: 2026-S39
menu: 1
du: 2026-09-21
au: 2026-09-27
---
`),
    ).toThrow(/Frontmatter incomplet/);
  });
});

const V2_WEEK = `---
semaine: 2026-S39
menu: A
du: 2026-09-21
au: 2026-09-27
---

## Courses
### Protéines
- Poulet 600 g

### Keto
- Avocats ×3-4
- Chocolat noir ≥ 85 %

## Menu
### Mardi
- dejeuner-marc: Boîte poulet-riz
- diner-famille: Pâtes bolognaise + salade → R2
- diner-melanie: Bolo sur courgettes + parmesan → r2
- batch: Double sauce → boîte mer

## Recettes
### R2 · Pâtes bolognaise + salade
temps: 25 min · plaque + casserole
kcal: 620
proteines: 42
bases: B4, B6
- pour 4: 800 g haché 5 % · 2 boîtes tomates · 400 g pâtes
1. Oignons + ail à l'huile 5 min, haché 8 min.
2. Tomates + herbes, 15 min doux.
3. Pâtes al dente en parallèle.
- mel: bolo sur courgettes spaghetti + parmesan
- batch: double sauce → boîte mercredi

### R7 · Rôti de dinde + gratin courgettes
temps: 60 min · four 180°

## Bases
### B4 · Vinaigrette minute
3 c.à.s huile d'olive + 1 moutarde + jus d'½ citron + sel.

### B6 · Courgettes spaghetti
Julienne à l'économe, 3-4 min poêle très chaude, jamais à l'avance.

## Batch
### Rituel dimanche
- 0-5 min · Four à 180° — egg muffins ×10 lancés
- 5-30 min · Cuissons en double — dîner ×2 + féculent ×2

### Micro-batch
- lundi: doubler le plat
- mardi: doubler la sauce

- [ ] Egg muffins ×10

## Marc
### Cibles
- 2200 kcal

### Séances
- [ ] PPG lundi

### Rappels
- Pesée le lundi

## Melanie
### Cibles
- 1600 kcal

### Séances
- [ ] Yoga mardi

### Rappels
- Pesée le lundi
`;

describe('parseWeeklyFile — format v2 (recettes, bases, rituel, micro-batch)', () => {
  const { data, warnings } = parseWeeklyFile(V2_WEEK);

  it('extrait les recettes avec tous leurs champs', () => {
    expect(data.recettes).toHaveLength(2);
    const r2 = data.recettes![0];
    expect(r2.id).toBe('r2-pates-bolognaise-salade');
    expect(r2.nom).toBe('R2 · Pâtes bolognaise + salade');
    expect(r2.temps).toBe('25 min · plaque + casserole');
    expect(r2.kcal).toBe(620);
    expect(r2.proteines).toBe(42);
    expect(r2.bases).toEqual(['B4', 'B6']);
    expect(r2.pour).toContain('800 g haché');
    expect(r2.etapes).toEqual([
      "Oignons + ail à l'huile 5 min, haché 8 min.",
      'Tomates + herbes, 15 min doux.',
      'Pâtes al dente en parallèle.',
    ]);
    expect(r2.mel).toContain('courgettes spaghetti');
    expect(r2.batch).toContain('double sauce');
  });

  it('extrait les bases du carnet', () => {
    expect(data.bases).toHaveLength(2);
    expect(data.bases![0].id).toBe('b4-vinaigrette-minute');
    expect(data.bases![0].texte).toContain("huile d'olive");
  });

  it('lie les repas aux recettes via → et retire la référence du texte', () => {
    const mardi = data.menu[0];
    expect(mardi.recetteRefs).toEqual({ dinerFamille: 'R2', dinerMelanie: 'r2' });
    expect(mardi.dinerFamille).toBe('Pâtes bolognaise + salade');
    expect(mardi.dejeunerMarc).toBe('Boîte poulet-riz');
  });

  it('extrait le rituel du dimanche avec créneaux et ids stables', () => {
    expect(data.rituel).toHaveLength(2);
    expect(data.rituel![0]).toEqual({
      id: 'batch:rituel:four-a-180',
      creneau: '0-5 min',
      label: 'Four à 180°',
      detail: 'egg muffins ×10 lancés',
    });
  });

  it('extrait le micro-batch par jour', () => {
    expect(data.microBatch).toEqual([
      { jour: 'lundi', quoi: 'doubler le plat' },
      { jour: 'mardi', quoi: 'doubler la sauce' },
    ]);
  });

  it('garde les tâches batch hors sous-sections avec ids inchangés', () => {
    expect(data.batch).toEqual([{ id: 'batch:egg-muffins-10', label: 'Egg muffins ×10' }]);
  });

  it('ne produit aucun warning pour une semaine v2 complète', () => {
    expect(warnings).toEqual([]);
  });
});

describe('sous-section batch inconnue', () => {
  const { data, warnings } = parseWeeklyFile(weekWith(`## Batch
- [ ] Tâche réelle

### Snack
- Barre protéinée
- [ ] Autre barre
`));

  it('n’absorbe pas les lignes de la sous-section inconnue comme tâches batch', () => {
    expect(data.batch).toEqual([{ id: 'batch:tache-reelle', label: 'Tâche réelle' }]);
  });

  it('émet exactement UN warning de sous-section ignorée (pas de triplé)', () => {
    expect(warnings.filter((w) => !w.startsWith('Section ##'))).toEqual([
      'Sous-section « Snack » ignorée (batch).',
    ]);
  });
});

describe('lignes v2 hors sous-section (batch)', () => {
  it('étape rituel top-level → warning dédié et pas de tâche', () => {
    const { data, warnings } = parseWeeklyFile(weekWith(`## Batch
- 0-5 min · Four à 180° — egg muffins ×10
`));
    expect(data.batch).toEqual([]);
    expect(warnings.filter((w) => !w.startsWith('Section ##'))).toEqual([
      'Ligne rituel hors sous-section « Rituel dimanche » ignorée (batch).',
    ]);
  });

  it('ligne micro-batch top-level → warning dédié et pas de tâche', () => {
    const { data, warnings } = parseWeeklyFile(weekWith(`## Batch
- lundi: doubler le plat
`));
    expect(data.batch).toEqual([]);
    expect(warnings.filter((w) => !w.startsWith('Section ##'))).toEqual([
      'Ligne micro-batch hors sous-section « Micro-batch » ignorée (batch).',
    ]);
  });

  it('les cases à cocher restent des tâches top-level (même avec la forme jour:)', () => {
    const { data, warnings } = parseWeeklyFile(weekWith(`## Batch
- [ ] lundi: préparer les boîtes
`));
    expect(data.batch).toEqual([
      { id: 'batch:lundi-preparer-les-boites', label: 'lundi: préparer les boîtes' },
    ]);
    expect(warnings.filter((w) => !w.startsWith('Section ##'))).toEqual([]);
  });
});

describe('kcal/proteines invalides (recettes)', () => {
  const { data, warnings } = parseWeeklyFile(weekWith(`## Recettes
### R2 · Gratin de courgettes
kcal: ~620 kcal
proteines: beaucoup
temps: 30 min
`));

  it('laisse kcal et proteines undefined (pas de NaN silencieux)', () => {
    expect(data.recettes).toEqual([
      { id: 'r2-gratin-de-courgettes', nom: 'R2 · Gratin de courgettes', temps: '30 min' },
    ]);
  });

  it('émet un warning par valeur invalide', () => {
    expect(warnings.filter((w) => !w.startsWith('Section ##'))).toEqual([
      'Valeur kcal invalide pour la recette « R2 · Gratin de courgettes » : ligne ignorée.',
      'Valeur proteines invalide pour la recette « R2 · Gratin de courgettes » : ligne ignorée.',
    ]);
  });
});

describe('recettes — clés macros, score, image', () => {
  const base = `---
semaine: 2026-S39
menu: A
du: 2026-09-21
au: 2026-09-27
---

## Marc
### Cibles
- x
### Seances
- [ ] y
### Rappels
- z

## Melanie
### Cibles
- x
### Seances
- [ ] y
### Rappels
- z

## Courses
### Fraicheur
- Poulet

## Menu
### Lundi
- dejeuner-marc: A

## Batch
- [ ] B

## Recettes
### R1 · Poulet rôti
kcal: 450
proteines: 35
glucides: 30
lipides: 12
score: 9
image: https://images.unsplash.com/photo-123
1. Étape un
`;

  it('parse les nouvelles clés optionnelles', () => {
    const { data, warnings } = parseWeeklyFile(base);
    const [r1] = data.recettes ?? [];
    expect(r1?.nom).toBe('R1 · Poulet rôti');
    expect(r1?.glucides).toBe(30);
    expect(r1?.lipides).toBe(12);
    expect(r1?.score).toBe(9);
    expect(r1?.image).toBe('https://images.unsplash.com/photo-123');
    expect(warnings).toEqual([]);
  });

  it('score invalide (hors 0-10 ou non entier) → warning + champ absent', () => {
    for (const valeur of ['42', '9.5']) {
      const { data, warnings } = parseWeeklyFile(base.replace('score: 9', `score: ${valeur}`));
      expect(data.recettes?.[0].score).toBeUndefined();
      expect(warnings).toEqual([
        'Valeur score invalide pour la recette « R1 · Poulet rôti » : ligne ignorée.',
      ]);
    }
  });

  it('image non-https → warning + champ absent', () => {
    const { data, warnings } = parseWeeklyFile(base.replace('image: https://', 'image: http://'));
    expect(data.recettes?.[0].image).toBeUndefined();
    expect(warnings).toEqual([
      'Valeur image invalide pour la recette « R1 · Poulet rôti » : ligne ignorée.',
    ]);
  });

  it('glucides/lipides invalides → warning + champ absent (comme kcal)', () => {
    const glucides = parseWeeklyFile(base.replace('glucides: 30', 'glucides: abc'));
    const lipides = parseWeeklyFile(base.replace('lipides: 12', 'lipides: abc'));
    expect(glucides.data.recettes?.[0].glucides).toBeUndefined();
    expect(lipides.data.recettes?.[0].lipides).toBeUndefined();
    expect(glucides.warnings).toEqual([
      'Valeur glucides invalide pour la recette « R1 · Poulet rôti » : ligne ignorée.',
    ]);
    expect(lipides.warnings).toEqual([
      'Valeur lipides invalide pour la recette « R1 · Poulet rôti » : ligne ignorée.',
    ]);
  });
});

describe('ids de recettes/bases dupliqués', () => {
  const { data, warnings } = parseWeeklyFile(weekWith(`## Recettes
### R2 · Sauce tomate
temps: 10 min

### R2 · Sauce tomate
temps: 15 min

## Bases
### B1 · Vinaigrette
Huile + moutarde.

### B1 · Vinaigrette
Huile + citron.
`));

  it('garde les deux occurrences (pas de dédoublonnage)', () => {
    expect(data.recettes).toHaveLength(2);
    expect(data.bases).toHaveLength(2);
  });

  it('émet un warning par identifiant déjà utilisé', () => {
    expect(warnings.filter((w) => w.includes('déjà utilisé'))).toEqual([
      'Identifiant « r2-sauce-tomate » déjà utilisé.',
      'Identifiant « b1-vinaigrette » déjà utilisé.',
    ]);
  });
});

describe('épinglage v2', () => {
  it('R7 sans étapes : objet exactement {id, nom, temps}', () => {
    const { data } = parseWeeklyFile(V2_WEEK);
    expect(data.recettes![1]).toEqual({
      id: 'r7-roti-de-dinde-gratin-courgettes',
      nom: 'R7 · Rôti de dinde + gratin courgettes',
      temps: '60 min · four 180°',
    });
  });

  it('référence non finale (→ R2 extra) : texte intact et pas de recetteRefs', () => {
    const { data } = parseWeeklyFile(weekWith(`## Menu
### Mardi
- diner-famille: Bolo pâtes → R2 extra
`));
    expect(data.menu).toEqual([{ jour: 'Mardi', dinerFamille: 'Bolo pâtes → R2 extra' }]);
  });
});

describe('parseWeeklyFile — rétrocompatibilité v1', () => {
  it('une semaine sans blocs v2 ne définit pas les champs optionnels', () => {
    const { data } = parseWeeklyFile(FULL_WEEK);
    expect(data.recettes).toBeUndefined();
    expect(data.bases).toBeUndefined();
    expect(data.rituel).toBeUndefined();
    expect(data.microBatch).toBeUndefined();
  });
});

describe('parse v2 — budget, rituel, note, portions, fraîcheur', () => {
  it('lit la ligne budget en tête de ## Courses', () => {
    const md = FULL_WEEK.replace('## Courses', '## Courses\n- budget: ≈ 35 €');
    const { data, warnings } = parseWeeklyFile(md);
    expect(data.budget).toBe('≈ 35 €');
    expect(warnings).toHaveLength(0);
  });

  it('marque les items suffixés « · rituel » et nettoie le label (id stable sans le suffixe)', () => {
    const md = FULL_WEEK.replace('- Riz basmati', '- Riz basmati · rituel');
    const { data } = parseWeeklyFile(md);
    const riz = data.courses.find((c) => c.label.startsWith('Riz'));
    expect(riz?.rituel).toBe(true);
    expect(riz?.label).toBe('Riz basmati');
    expect(riz?.id).toBe('courses:epicerie:riz-basmati');
  });

  it('lit la note de fraîcheur en suffixe « | note »', () => {
    const md = FULL_WEEK.replace('- Yaourts skyr', '- Yaourts skyr | à acheter vendredi, pas avant');
    const { data, warnings } = parseWeeklyFile(md);
    const skyr = data.courses.find((c) => c.label === 'Yaourts skyr');
    expect(skyr?.note).toBe('à acheter vendredi, pas avant');
    expect(warnings).toHaveLength(0);
  });

  it('combine « · rituel » et « | note » sur le même item', () => {
    const md = FULL_WEEK.replace('- Riz basmati', '- Riz basmati · rituel | acheter vendredi');
    const { data, warnings } = parseWeeklyFile(md);
    const riz = data.courses.find((c) => c.label === 'Riz basmati');
    expect(riz?.rituel).toBe(true);
    expect(riz?.note).toBe('acheter vendredi');
    expect(riz?.id).toBe('courses:epicerie:riz-basmati');
    expect(warnings).toHaveLength(0);
  });

  it('lit portions marc / portions melanie et fraicheur dans une recette', () => {
    const md = V2_WEEK.replace(
      'kcal: 620',
      'kcal: 620\nfraicheur: batch dimanche → boîte\n- portions marc: riz 150 g cuit\n- portions melanie: sans riz ni patate douce',
    );
    const { data } = parseWeeklyFile(md);
    const r2 = data.recettes?.find((r) => r.id === 'r2-pates-bolognaise-salade');
    expect(r2?.fraicheur).toBe('batch dimanche → boîte');
    expect(r2?.portions?.marc).toBe('riz 150 g cuit');
    expect(r2?.portions?.melanie).toBe('sans riz ni patate douce');
  });

  it('reste silencieux sur un fichier v1 sans ces champs', () => {
    const { data, warnings } = parseWeeklyFile(FULL_WEEK);
    expect(data.budget).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });
});

// ⚠️ La sample est alignée sur la semaine COURANTE (S37 au 08/09/2026) tant qu'il n'y a pas
// de template hebdo. Pour la rafraîchir, bump en lockstep : frontmatter + `# Semaine` de
// src/assets/semaine-exemple.md, ce describe (dates), tests/app.test.tsx (fixture + meta +
// dates bannière), tests/profil-screen.test.tsx, tests/e2e/{onboarding-mobile,dock}.spec.ts.
describe('semaine-exemple.md — la sample réelle (v2, semaine courante)', () => {
  const { data, warnings } = parseWeeklyFile(exemple);

  it('frontmatter aligné sur la semaine courante : S37, du = lundi, au = dimanche', () => {
    expect(data.meta.semaine).toBe('2026-S37');
    expect(data.meta.du).toBe('2026-09-07');
    expect(data.meta.au).toBe('2026-09-13');
    const du = new Date('2026-09-07T12:00:00');
    const au = new Date('2026-09-13T12:00:00');
    expect(du.getDay()).toBe(1); // lundi
    expect(au.getDay()).toBe(0); // dimanche
    // Le code semaine du frontmatter == numéro de semaine ISO de `du`
    const [y, m, d] = data.meta.du.split('-').map(Number);
    const jeudi = new Date(y, m - 1, d + 3);
    const debutAnnee = new Date(jeudi.getFullYear(), 0, 1);
    const semaine = Math.ceil(((jeudi.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7);
    expect(data.meta.semaine).toBe(`2026-S${String(semaine).padStart(2, '0')}`);
  });

  it('ne produit aucun warning', () => {
    expect(warnings).toEqual([]);
  });

  it('contient des recettes, des bases, un rituel et un micro-batch', () => {
    expect(data.recettes!.length).toBeGreaterThanOrEqual(3);
    expect(data.bases!.length).toBeGreaterThanOrEqual(3);
    expect(data.rituel!.length).toBeGreaterThanOrEqual(5);
    expect(data.microBatch!.length).toBeGreaterThanOrEqual(3);
    expect(data.rituel![0].label).toContain('180');
  });

  it('le menu contient 7 jours ordonnés du lundi au dimanche', () => {
    expect(data.menu.map((d) => d.jour)).toEqual([
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
      'Dimanche',
    ]);
  });

  it('les refs → du menu pointent toutes vers des recettes existantes', () => {
    for (const day of data.menu) {
      for (const [repas, ref] of Object.entries(day.recetteRefs ?? {})) {
        if (!ref) continue;
        const cible = ref.toLowerCase();
        const trouvée = data.recettes!.some(
          (r) => r.id === cible || r.id.startsWith(cible + '-'),
        );
        expect(trouvée, `ref ${ref} (${repas}, jour ${day.jour}) introuvable`).toBe(true);
      }
    }
  });

  it('les bases référencées par les recettes existent', () => {
    for (const r of data.recettes ?? []) {
      for (const b of r.bases ?? []) {
        const cible = b.toLowerCase();
        expect(
          data.bases!.some((base) => base.id === cible || base.id.startsWith(cible + '-')),
          b,
        ).toBe(true);
      }
    }
  });

  it('le rayon Keto existe dans les courses', () => {
    expect(data.courses.some((c) => c.rayon === 'keto')).toBe(true);
  });

  it('le carnet contient les recettes clés du carnet papier', () => {
    const ids = data.recettes!.map((r) => r.id);
    expect(ids).toContain('r1-cuisses-de-poulet-roties-legumes-riz');
    expect(ids).toContain('r2-pates-bolognaise-salade');
  });

  it('porte les nouveautés batch v3 : production, termine, détails micro, Réserve (0 warning)', () => {
    const { data, warnings } = parseWeeklyFile(exemple);
    expect(data.rituelProduction).toBeTruthy();
    expect(data.rituelTermine).toBeTruthy();
    expect(data.microBatch?.some((m) => m.detail)).toBe(true);
    expect(data.reserve?.length).toBeGreaterThanOrEqual(4);
    expect(warnings).toEqual([]);
  });

  it('porte les refs recette batch v4 (tâches, étapes, micro-batch) — 0 warning', () => {
    expect(data.batch.find((t) => t.label === 'Egg muffins ×10')?.ref).toBeTruthy();
    expect(data.rituel?.filter((e) => e.ref).length).toBeGreaterThanOrEqual(2);
    expect(data.microBatch?.some((m) => m.duree && m.quantite && m.ref)).toBe(true);
  });
});

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

  it('micro-batch : les pipes suivants restent dans le détail (aucune perte)', () => {
    const { data } = parseWeeklyFile(md(`### Micro-batch
- lundi: doubler le plat | cuire 10 min | vérifier la cuisson
`));
    expect(data.microBatch).toEqual([
      { jour: 'lundi', quoi: 'doubler le plat', detail: 'cuire 10 min | vérifier la cuisson' },
    ]);
  });

  it('réserve : les pipes suivants restent dans la conservation (aucune perte)', () => {
    const { data } = parseWeeklyFile(md(`### Réserve
- lundi: Plat | frigo | 2 j max
`));
    expect(data.reserve).toEqual([
      { cle: 'lundi', plat: 'Plat', conservation: 'frigo | 2 j max' },
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

  it('réserve : id dupliqué → warning (comme les autres sections)', () => {
    const { warnings } = parseWeeklyFile(md(`### Réserve
- mardi: Chili | congélateur
- mardi: Chili | congélateur
`));
    expect(warnings.some((w) => w.includes('dupliqué'))).toBe(true);
  });

  it('production/termine hors sous-section Rituel dimanche → warning, pas une tâche batch', () => {
    const { data, warnings } = parseWeeklyFile(md(`- production: égarée
- [ ] Egg muffins ×10
`));
    expect(data.batch).toHaveLength(1);
    expect(warnings.some((w) => w.includes('production/termine'))).toBe(true);
  });
});

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
    expect(data.batch[0]).toEqual({ id: 'batch:egg-muffins-10', label: 'Egg muffins ×10', ref: 'R7' });
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

  it('refConnue : égalité avec le slug complet → ref extraite, label net', () => {
    const { data, warnings } = parseWeeklyFile(
      md('- [ ] Sauce → r7-roti-de-dinde-gratin-courgettes-quinoa\n'),
    );
    expect(data.batch[0]).toEqual({
      id: 'batch:sauce',
      label: 'Sauce',
      ref: 'r7-roti-de-dinde-gratin-courgettes-quinoa',
    });
    expect(warnings).toEqual([]);
  });

  it('refConnue : préfixe insensible à la casse (→ r7) → ref extraite, label net', () => {
    const { data, warnings } = parseWeeklyFile(md('- [ ] Sauce → r7\n'));
    expect(data.batch[0]).toEqual({ id: 'batch:sauce', label: 'Sauce', ref: 'r7' });
    expect(warnings).toEqual([]);
  });

  it('entrée dégénérée « → R7 » seul : libellé intact, id inchangé (pré-refs), pas de ref', () => {
    const { data, warnings } = parseWeeklyFile(md('- [ ] → R7\n'));
    expect(data.batch[0]).toEqual({ id: 'batch:r7', label: '→ R7' });
    expect(warnings).toEqual([]);
  });
});

describe('Batch v4 — refs sur le rituel et micro-batch enrichi', () => {
  // … même fixture md() que le describe « Batch v4 — refs recette sur les tâches » …
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

  it('micro-batch : un segment portant une ref connue devient le slot quantité, même en prose', () => {
    const { data } = parseWeeklyFile(md(`### Micro-batch
- mardi: sauce | 10 min | voir la fiche → R7
`));
    expect(data.microBatch).toEqual([
      { jour: 'mardi', quoi: 'sauce', duree: '10 min', quantite: 'voir la fiche', ref: 'R7' },
    ]);
  });

  it('micro-batch : durée traînante en fin de ligne = détail', () => {
    const { data } = parseWeeklyFile(md(`### Micro-batch
- jeudi: doubler quinoa | 2 boîtes → R7 | 10 min
`));
    expect(data.microBatch).toEqual([
      { jour: 'jeudi', quoi: 'doubler quinoa', quantite: '2 boîtes', ref: 'R7', detail: '10 min' },
    ]);
  });
});
