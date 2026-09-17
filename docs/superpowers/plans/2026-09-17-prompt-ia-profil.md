# Prompt IA de cycle (Profil) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le bouton du Profil copie un prompt complet de génération de cycle (contexte personnel du profil + contrat de format .md inline) au lieu d'un simple bloc « Paramètres ».

**Architecture:** Fonction pure `assemblePromptIa` dans `src/lib/promptIa.ts` qui remplit les placeholders `{{OUVERTURE}}`/`{{CONTEXTE}}` du template maître `src/assets/prompt-cycle-template.md` (import `?raw`, même pattern que la semaine-exemple). Le composant Profil passe le profil + la dernière pesée ; les 3 placeholders de chat (`{{SEMAINE_DEPART}}`, `{{MENUS_ORDRE}}`, `{{EVENEMENTS}}`) restent à éditer dans le chat.

**Tech Stack:** TypeScript strict, React 18 (hooks), Vitest + Testing Library, CSS sémantique existant.

**Spec:** `docs/superpowers/specs/2026-09-17-prompt-ia-profil-design.md`

**Écarts assumés vs spec (validés dans le design, à rappeler au user si question) :**
1. `assemblePromptIa(profil, dernierPoids)` — pas de paramètre `maintenant` : l'âge passe par `ageDepuis` (dates.ts) qui lit `new Date()`, testable via `vi.setSystemTime`. Signature plus simple, même garanties.
2. `{{CONTEXTE}}` inclut le titre « Son contexte : » et **disparaît entièrement** si aucune donnée maison (la spec prévoyait un titre orphelin — un titre sans contenu embrouille l'IA qui lit le prompt).

---

## Fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/assets/prompt-cycle-template.md` | créer | template maître du prompt (placeholders) |
| `src/lib/promptIa.ts` | créer | `assemblePromptIa` — pur, testé |
| `tests/lib/promptIa.test.ts` | créer | tests de la fonction pure |
| `src/components/ProfilScreen.tsx` | modifier | bouton « Copier le prompt IA », retrait `paramsIaTexte` |
| `tests/profil-screen.test.tsx` | modifier | describe « Génération IA » réécrit |
| `docs/templates/prompt-semaine-ia.md` | modifier | devient pointeur |
| `README.md`, `AGENTS.md`, `ai/context/design-system.md`, `ai/context/ui-guideline.md`, `CHANGELOG.md` | modifier | docs alignées |

---

### Task 1: Template maître `src/assets/prompt-cycle-template.md`

**Files:**
- Create: `src/assets/prompt-cycle-template.md`

- [ ] **Step 1: Créer le template maître**

Le fichier fusionne `docs/templates/prompt-semaine-ia.md` (mission/process/règles/auto-contrôle/sortie) et le squelette de `docs/templates/template-semaine.md` (sans son bloc de commentaire d'en-tête — ses règles sont pliées dans « Règles dures »). Contenu EXACT :

````markdown
{{OUVERTURE}}

{{CONTEXTE}}

Pièces jointes attendues (à attacher dans ce chat) :
1. diet/carnet-recettes-batch-AAAA-MM-JJ.html — le carnet (24 recettes, 4 menus, rituel, micro-batches)
2. diet/listes-courses-AAAA-MM-JJ.html — les listes Lidl par menu + encadré keto
3. diet/plan-diet-AAAA-MM-JJ.html — le plan diet de Marc (cibles, séances, rappels)
4. diet/melanie/plan-keto-if-melanie-AAAA-MM-JJ.html — le plan keto+IF de Mélanie

À compléter avant d'envoyer :
- Semaine de départ : {{SEMAINE_DEPART}} (ex. 2026-S39, lundi 2026-09-21)
- Menus à générer, dans l'ordre du roulement : {{MENUS_ORDRE}} (ex. B, C, D, A)
- Événements de la période : {{EVENEMENTS}} (ex. mercredi : soirée danse 16h — ils PRIMENT sur le carnet)

## Ta mission

Génère un fichier .md par semaine demandée, conformes au squelette ci-dessous
(format « Rituel », fichier hebdo de l'app). Nommage : `AAAA-Sxx-menu-{lettre}.md`.
Suis EXACTEMENT le process et les règles dures ci-dessous, puis l'auto-contrôle.

## Process (dans l'ordre)

1. **Dates** : pour chaque semaine, lundi (`du`) → dimanche (`au`) en ISO
   AAAA-MM-JJ, sans erreur de calendrier. Le code semaine ISO (ex. 2026-S38)
   correspond à la semaine de la date du lundi.
2. **Courses** : les rayons de la liste du menu (source listes-courses) + le
   rayon `### Keto` EN DERNIER (encadré permanent de Mélanie, identique chaque
   semaine). Items au format `- label`, mentions « (Mélanie) » si spécifique.
3. **Menu** : 7 jours Lundi→Dimanche, les 5 clés par jour
   (`dejeuner-marc`, `dejeuner-melanie`, `diner-famille`, `diner-melanie`,
   `batch`). Les dîners = les recettes du menu du carnet ; les déjeuners
   suivent la logique boxes (boîte du batch pour Marc, restes/box keto pour
   Mélanie). OBLIGATOIRE pour les déjeuners : une box issue d'un batch/dîner
   porte toujours `→ slug` vers la recette qui la produit (batch ou dîner de
   la veille) — sans ref, l'app la considère « toujours prête ». Les portions
   (`- portions marc/melanie:` des recettes) sont en MESURES MAISON :
   pièces, poignées, c. à soupe, louches — grammes entre parenthèses
   uniquement pour caler l'œil. Jamais de portion qui exige une balance.
   Intègre les événements fournis en paramètres (ils PRIMENT sur le carnet).
4. **Batch** : le rituel générique du carnet (5-6 étapes horodatées, détail
   ajusté au dîner du dimanche du menu) + une ligne `- production:` (ce que le
   batch produit + conservation) + une ligne `- termine:` (message de fin du
   mode guidé) + le micro-batch du menu (du tableau micro-batches, avec le
   suffixe ` | détail` : durée/conservation) + la sous-section `### Réserve`
   (une ligne par plat stocké : `- <jour|mel>: <plat> | <conservation>`) +
   3-5 tâches `- [ ]` du gros batch.
5. **Recettes** : uniquement celles du menu, titres EXACTS du carnet,
   enrichies : `temps`, `kcal`, `proteines`, `glucides`, `lipides` (estimations
   réalistes par personne), `score` (0-10), `image` (URL Unsplash https),
   `bases`, `- pour 4:`, étapes numérotées, `- mel:`, `- batch:`. Une même
   recette garde les MÊMES valeurs dans tous les fichiers du cycle.
6. **Bases** : uniquement celles citées par les recettes du fichier.
7. **Marc / Melanie** : copie CONFORME des blocs du squelette ci-dessous
   (cibles, séances, rappels). Ne réinvente rien ; n'adapte que ce qu'un
   événement impose.

## Squelette à remplir (format « Rituel »)

---
semaine: {{AAAA-Sxx}}
menu: {{A|B|C|D}}
titre: {{Menu X — nom du menu, sans #}}
du: {{AAAA-MM-JJ, lundi}}
au: {{AAAA-MM-JJ, dimanche}}
---

# Semaine {{xx}}

## Courses

### Proteines & Laitiers
- {{provenance listes-courses du menu, mentions (Mélanie) si spécifique keto}}

### Frais, sec & surgelés
- {{item}}

### Keto
- Avocats ×3-4
- Beurre 250 g · crème fraîche 20 cl
- Fromages variés : emmental, chèvre, mozzarella
- Olives 1 bocal
- Salade ×2 · épinards · courgettes ×4 · brocoli · chou-fleur · concombre · poivrons · champignons
- Amandes 200 g · noix de Grenoble 200 g
- Chocolat noir ≥ 85 %
- Baies surgelées 300 g
- Eau pétillante · citron
- Sardines/maquereau à l'huile

## Menu

### Lundi
- dejeuner-marc: {{boîte du batch ou repas}} → {{slug-recette-source si ref}}
- dejeuner-melanie: {{assiette keto ou box}} → {{slug-recette-source si ref}}
- diner-famille: {{dîner}} → {{slug-recette}}
- diner-melanie: {{dîner version keto}}
- batch: {{prep du jour ou « Zéro prep — ... »}}

### Mardi
<!-- Répéter × 7 jours, mêmes 5 clés (un jour sans batch : la clé `batch:` est simplement absente) -->

## Recettes

### {{R# · Nom EXACT du carnet}}
temps: {{X min · matériel}}
kcal: {{par personne, estimation réaliste}}
proteines: {{g par personne}}
glucides: {{g par personne}}
lipides: {{g par personne}}
score: {{entier 0-10}}
image: {{URL https://images.unsplash.com/... vérifiée}}
bases: {{B#, B#}}
- pour 4: {{ingrédients quantifiés, séparés par ·}}
- portions marc: {{mesures maison — pièces, poignées, c. à soupe, louches}}
- portions melanie: {{mesures maison keto}}
1. {{étape}}
2. {{étape}}
- mel: {{assiette keto de Mélanie}}
- batch: {{consigne batch du carnet}}

## Bases

### {{B# · Nom}}
{{préparation en une ou deux phrases}}

## Batch

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

- [ ] Egg muffins ×10
- [ ] {{tâches du gros batch (3-5)}}

## Marc

### Cibles
- 2 450 kcal std · 2 750 sortie · 2 300 repos
- Protéines 160 g/j (constante) · glucides autour des séances
- Créatine 5 g/j tous les jours · clear whey post-séance
- Eau 2,5 L · coucher 22h (bureau) / 22h30 (maison)
### Séances
- [ ] Lundi — Muscu libre 10h30 (rameur + poids) + navette vélo Z1
- [ ] Mardi — Course 5 km / VMA (maison)
- [ ] Mercredi — Coach 9h + navette vélo
- [ ] Jeudi — Muscu libre 9h/10h30 + navette vélo
- [ ] Vendredi — Course ou repos
- [ ] Samedi — Sortie longue (alternance sam/dim, 7h)
### Rappels
- Pesée lun/mer/ven à jeun → moyenne hebdo
- 10 km < 50 min : test à S12 · 5 km < 23:00 à S10

## Melanie

### Cibles
- 1 450-1 500 kcal · protéines 110 g · ≤ 25-30 g glucides nets
- Fenêtre 12h→20h (mardi : 21h après pilates)
- Sel généreux (adaptation keto) · eau 2-2,5 L
- Pré-menstruelle : fenêtre 12h-21h + 100-200 kcal keto
### Séances
- [ ] Lundi — Danse 21h
- [ ] Mardi — Pilates 19h45 (snack 18h30 : 2 œufs + ½ avocat)
- [ ] Vendredi — Marche à jeun 6h30-7h30
### Rappels
- Jeûne matin : eau · café noir · thé uniquement
- Snack keto si creux : amandes · olives · fromage · œuf dur

## Règles dures (contrat — toute violation casse l'app)

- Zéro ligne hors format : chaque fichier doit être importable avec **0 warning**.
- Frontmatter : `semaine`, `menu`, `du`, `au` requis (ISO AAAA-MM-JJ), pas de
  « # » dans les valeurs.
- Ne modifie JAMAIS le libellé d'une coche existante (courses, rituel, tâches
  batch, séances) : le slug dérive du libellé.
- Les refs `→ slug` doivent viser des recettes présentes dans le même fichier
  (slug = slugify du titre, sans accents ni majuscules).
- Un item de courses = une ligne ; pas de sous-puces, pas de gras, pas de table.
- Pas de section en plus ni de section renommée (## exactement : Courses, Menu,
  Batch, Recettes, Bases, Marc, Melanie).
- Les jours du menu s'écrivent Lundi → Dimanche.
- Le rayon `### Keto` est toujours le DERNIER rayon.
- Le placard permanent (réassort mensuel) ne va JAMAIS dans un fichier hebdo.
- Titre de recette = EXACTEMENT celui du carnet (le slug = l'id, il doit rester
  identique d'une semaine à l'autre, surtout pour les recettes partagées).

## Auto-contrôle (à faire AVANT de répondre)

- [ ] Les 4 frontmatters : lundi→dimanche consécutifs, code semaine ISO correct
- [ ] Chaque fichier : les 7 jours, 5 clés, aucune clé inconnue
- [ ] Chaque `→ slug` correspond à une recette du fichier
- [ ] Chaque box de midi (`dejeuner-*`) issue d'un batch/dîner porte `→ slug` ;
      les portions sont en mesures maison (pas de pesée obligatoire)
- [ ] Recettes partagées entre menus : valeurs identiques
- [ ] Aucune ligne hors format (pas de gras, pas de tables, pas de sous-listes)
- [ ] Les blocs Marc/Melanie sont identiques d'une semaine à l'autre
- [ ] `### Réserve` : clés = jours ou « mel », chaque ligne a plat ET conservation
- [ ] production/termine/détails/réserve cohérents avec le rituel et le menu

## Sortie attendue

4 blocs de code markdown, un par fichier, précédés chacun d'une ligne
`### Fichier : AAAA-Sxx-menu-x.md` — rien d'autre.
````

- [ ] **Step 2: Commit**

```bash
git add src/assets/prompt-cycle-template.md
git commit -m "feat: template maître du prompt IA de cycle (asset ?raw)"
```

---

### Task 2: `assemblePromptIa` dans `src/lib/promptIa.ts` (TDD)

**Files:**
- Test: `tests/lib/promptIa.test.ts`
- Create: `src/lib/promptIa.ts`

- [ ] **Step 1: Écrire le fichier de tests (rouge)**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assemblePromptIa } from '../../src/lib/promptIa';
import type { UserProfile } from '../../src/lib/model';
import type { WeightEntry } from '../../src/lib/storage';

const profilComplet: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  poidsObjectif: 72,
  objectif: { type: 'affiner', echeance: '2027-03-01' },
  complements: ['Créatine', 'Whey'],
  regime: 'keto',
  magasin: 'Lidl',
  budgetMax: 40,
  personnes: 4,
  repasJour: 3,
  preferences: ['Healthy', 'Batch-friendly'],
};

const pesee: WeightEntry = { date: '2026-09-14', kg: 82.4 };

describe('assemblePromptIa', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-17T10:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('embarque le contrat de format inline (squelette, règles, sortie)', () => {
    const texte = assemblePromptIa(profilComplet, pesee);
    expect(texte).toContain('## Squelette à remplir');
    expect(texte).toContain('## Règles dures');
    expect(texte).toContain('## Sortie attendue');
    expect(texte).toContain('semaine: {{AAAA-Sxx}}');
  });

  it('remplit l ouverture avec le contexte personnel', () => {
    const texte = assemblePromptIa(profilComplet, pesee);
    expect(texte).toContain(
      'Tu es un nutritionniste. Marc (41 ans, 82,4 kg — dernière pesée du 14/09, 178 cm) te demande de lui réaliser une rotation de menus sur 4 semaines',
    );
    expect(texte).toContain("Objectif : affiner la silhouette vers 72 kg d'ici mars 2027.");
  });

  it('assemble le bloc contexte avec les données maison', () => {
    const texte = assemblePromptIa(profilComplet, pesee);
    expect(texte).toContain('- Régime particulier : keto');
    expect(texte).toContain('- Compléments : Créatine, Whey');
    // formatEuro insère une espace insécable (U+00A0) avant € — cf. lib/prix.test.ts.
    expect(texte).toContain('- Courses : Lidl, budget 40,00\u00a0€/semaine');
    expect(texte).toContain('- Personnes à table : 4 · 3 repas/jour');
    expect(texte).toContain('- Préférences : healthy, batch-friendly');
  });

  it('omet les lignes des champs non configurés (bloc contexte vide -> absent)', () => {
    const texte = assemblePromptIa(
      {
        id: 'melanie',
        dateNaissance: '1994-06-30',
        taille: 165,
        objectif: { type: 'maintien' },
        complements: [],
        regime: 'aucun',
      },
      null,
    );
    expect(texte).toContain('Tu es un nutritionniste. Mélanie (32 ans, 165 cm)');
    expect(texte).toContain('Objectif : maintenir le poids.');
    expect(texte).not.toContain('- Régime');
    expect(texte).not.toContain('- Compléments');
    expect(texte).not.toContain('- Courses');
    expect(texte).not.toContain('- Budget');
    expect(texte).not.toContain('- Personnes');
    expect(texte).not.toContain('- Préférences');
    expect(texte).not.toContain('Son contexte');
  });

  it('gère magasin sans budget et budget sans magasin', () => {
    const texte = assemblePromptIa({ ...profilComplet, magasin: 'Lidl', budgetMax: undefined }, pesee);
    expect(texte).toContain('- Courses : Lidl');
    const texte2 = assemblePromptIa({ ...profilComplet, magasin: undefined, budgetMax: 30 }, pesee);
    expect(texte2).toContain('- Budget : 30,00\u00a0€/semaine');
  });

  it('omet la mention poids quand il n y a aucune pesée', () => {
    const texte = assemblePromptIa(profilComplet, null);
    expect(texte).toContain('Marc (41 ans, 178 cm)');
    expect(texte).not.toContain('82,4');
  });

  it('formate l objectif selon les 4 types (sans échéance ni poids cible)', () => {
    expect(assemblePromptIa({ ...profilComplet, objectif: { type: 'perte' } }, null)).toContain(
      'Objectif : perdre du poids.',
    );
    expect(assemblePromptIa({ ...profilComplet, objectif: { type: 'masse' } }, null)).toContain(
      'Objectif : prendre de la masse.',
    );
    expect(assemblePromptIa({ ...profilComplet, objectif: { type: 'maintien' } }, null)).toContain(
      'Objectif : maintenir le poids.',
    );
    const sansEcheance = assemblePromptIa({ ...profilComplet, objectif: { type: 'affiner' } }, null);
    expect(sansEcheance).toContain('Objectif : affiner la silhouette.');
    expect(sansEcheance).not.toContain("d'ici");
  });

  it('laisse les placeholders de chat intacts et remplit les placeholders app', () => {
    const texte = assemblePromptIa(profilComplet, pesee);
    expect(texte).toContain('{{SEMAINE_DEPART}}');
    expect(texte).toContain('{{MENUS_ORDRE}}');
    expect(texte).toContain('{{EVENEMENTS}}');
    expect(texte).not.toContain('{{OUVERTURE}}');
    expect(texte).not.toContain('{{CONTEXTE}}');
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/lib/promptIa.test.ts`
Expected: FAIL — « Cannot find module '../../src/lib/promptIa' » (ou erreur TS du `?raw` si `src/lib/promptIa.ts` absent).

- [ ] **Step 3: Implémenter `src/lib/promptIa.ts`**

```ts
import template from '../assets/prompt-cycle-template.md?raw';
import { ageDepuis, formatDayMonth } from './dates';
import { PRENOMS, type ObjectifType, type UserProfile } from './model';
import { formatEuro } from './prix';
import type { WeightEntry } from './storage';

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// Formulations orientées prompt (décidées hors libellés d'app).
const OBJECTIFS_PROMPT: Record<ObjectifType, string> = {
  perte: 'perdre du poids',
  affiner: 'affiner la silhouette',
  masse: 'prendre de la masse',
  maintien: 'maintenir le poids',
};

// 82.4 -> « 82,4 » (nombre à la française, sans unité).
const fmtKg = (kg: number): string => kg.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

// '2027-03-01' -> « mars 2027 » (split, jamais de new Date sur une date seule).
const formatMoisAnnee = (iso: string): string => {
  const [y, m] = iso.split('-');
  return `${MOIS[Number(m) - 1] ?? ''} ${y}`.trim();
};

const objectifPhrase = (p: UserProfile): string => {
  const cible = p.poidsObjectif != null ? ` vers ${fmtKg(p.poidsObjectif)} kg` : '';
  const echeance = p.objectif.echeance ? ` d'ici ${formatMoisAnnee(p.objectif.echeance)}` : '';
  return `${OBJECTIFS_PROMPT[p.objectif.type]}${cible}${echeance}`;
};

const ouverture = (p: UserProfile, dernierPoids: WeightEntry | null): string => {
  const perso = dernierPoids
    ? `${PRENOMS[p.id]} (${ageDepuis(p.dateNaissance)} ans, ${fmtKg(dernierPoids.kg)} kg — dernière pesée du ${formatDayMonth(dernierPoids.date)}, ${p.taille} cm)`
    : `${PRENOMS[p.id]} (${ageDepuis(p.dateNaissance)} ans, ${p.taille} cm)`;
  return `Tu es un nutritionniste. ${perso} te demande de lui réaliser une rotation de menus sur 4 semaines pour installer une routine durable. Objectif : ${objectifPhrase(p)}.`;
};

// Une ligne par donnée présente ; ligne omise si le champ ne l'est pas.
// Renvoie '' si aucune donnée maison (pas de titre orphelin dans le prompt).
const contexte = (p: UserProfile): string => {
  const lignes: string[] = [];
  if (p.regime !== 'aucun') lignes.push(`- Régime particulier : ${p.regime}`);
  if (p.complements.length > 0) lignes.push(`- Compléments : ${p.complements.join(', ')}`);
  if (p.magasin && p.budgetMax != null) {
    lignes.push(`- Courses : ${p.magasin}, budget ${formatEuro(p.budgetMax)}/semaine`);
  } else if (p.magasin) {
    lignes.push(`- Courses : ${p.magasin}`);
  } else if (p.budgetMax != null) {
    lignes.push(`- Budget : ${formatEuro(p.budgetMax)}/semaine`);
  }
  if (p.personnes != null || p.repasJour != null) {
    const parties: string[] = [];
    if (p.personnes != null) parties.push(`${p.personnes}`);
    if (p.repasJour != null) parties.push(`${p.repasJour} repas/jour`);
    lignes.push(`- Personnes à table : ${parties.join(' · ')}`);
  }
  if (p.preferences && p.preferences.length > 0) {
    lignes.push(`- Préférences : ${p.preferences.map((x) => x.toLowerCase()).join(', ')}`);
  }
  if (lignes.length === 0) return '';
  return `Son contexte :\n${lignes.join('\n')}`;
};

// Assemble le prompt maître : ouverture + contexte perso remplis ; les 3
// placeholders de chat (semaine de départ, menus, événements) restent à éditer.
export const assemblePromptIa = (profil: UserProfile, dernierPoids: WeightEntry | null): string =>
  template.replace('{{OUVERTURE}}', ouverture(profil, dernierPoids)).replace('{{CONTEXTE}}', contexte(profil));
```

Notes pour l'exécutant :
- `import ... from '...?raw'` : déjà couvert par les types Vite (`App.tsx` importe la semaine-exemple ainsi). Vite inlining : la mise à jour du prompt = modifier l'asset.
- `WeightEntry` vit dans `storage.ts` (PAS model.ts) — import type uniquement (le module n'est pas exécuté par le composant testé ici).
- `PRENOMS` est exporté de `model.ts` (marc → Marc, melanie → Mélanie).

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/lib/promptIa.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/lib/promptIa.test.ts src/lib/promptIa.ts
git commit -m "feat: assemblePromptIa — contexte perso + contrat inline"
```

---

### Task 3: UI Profil — bouton « Copier le prompt IA » (TDD)

**Files:**
- Modify: `tests/profil-screen.test.tsx:418-493` (describe « Génération IA »)
- Modify: `src/components/ProfilScreen.tsx:29-48` (retrait `paramsIaTexte`), `:192-206` (handler), `:562-579` (section JSX)

- [ ] **Step 1: Réécrire le describe « Génération IA » des tests (rouge)**

Dans `tests/profil-screen.test.tsx` :
- ligne 3, remplacer `import type { Mock } from 'vitest';` par `import { vi, type Mock } from 'vitest';`
- remplacer TOUT le describe `ProfilScreen — Génération IA` (lignes 418-493) par :

```tsx
describe('ProfilScreen — Génération IA', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.useRealTimers();
  });

  it('est toujours visible (le contexte perso existe pour tout profil)', () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={() => {}} onChangeProfile={() => {}} onImported={() => {}} />,
    );

    expect(screen.getByRole('button', { name: /Copier le prompt IA/ })).toBeInTheDocument();
  });

  it('copie le prompt complet avec confirmation', async () => {
    vi.setSystemTime(new Date('2026-09-17T10:00:00'));
    const user = userEvent.setup();
    // user-event réinstalle le clipboard natif au setup() : le mock se pose APRÈS.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    addWeight('marc', '2026-09-14', 82.4);
    render(
      <ProfilScreen
        profile={{ ...profileMarc, magasin: 'Lidl', budgetMax: 40, regime: 'keto', complements: ['Créatine'] }}
        onBack={() => {}}
        onChangeProfile={() => {}}
        onImported={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Copier le prompt IA/ }));
    const texte = writeText.mock.calls[0][0] as string;
    expect(texte).toContain('Tu es un nutritionniste. Marc (');
    // formatEuro insère une espace insécable (U+00A0) avant € — cf. lib/prix.test.ts.
    expect(texte).toContain('- Courses : Lidl, budget 40,00\u00a0€/semaine');
    expect(texte).toContain('{{SEMAINE_DEPART}}');
    expect(texte).toContain('## Règles dures');
    expect(screen.getByText(/Prompt copié/)).toBeInTheDocument();
  });

  it('efface la confirmation dès qu un champ maison change (prompt périmé)', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <ProfilScreen
        profile={{ ...profileMarc, magasin: 'Lidl', budgetMax: 40 }}
        onBack={() => {}}
        onChangeProfile={() => {}}
        onImported={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Copier le prompt IA/ }));
    expect(screen.getByText(/Prompt copié/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Magasin habituel'));
    await user.type(screen.getByLabelText('Magasin habituel'), 'Intermarché');

    expect(screen.queryByText(/Prompt copié/)).not.toBeInTheDocument();
  });
});
```

(`addWeight` et `userEvent` sont déjà importés en tête du fichier.)

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/profil-screen.test.ts`
Expected: FAIL — « Copier le prompt IA » introuvable (l'UI affiche encore l'ancien bouton conditionnel).

- [ ] **Step 3: Modifier `src/components/ProfilScreen.tsx`**

3a. Supprimer le bloc `paramsIaTexte` (lignes 29-48 : commentaire + const).

3b. Ligne 4 : retirer `formatEuro` de l'import (garder `parseEuro`, utilisé par l'enregistrement maison) :

```ts
import { parseEuro } from '../lib/prix';
```

3c. Ligne 6 : importer `getWeights` en plus, et ajouter l'import de promptIa :

```ts
import { getWeights, saveProfile } from '../lib/storage';
import { assemblePromptIa } from '../lib/promptIa';
```

3d. Remplacer le handler `copierParametres` (lignes 192-206) par :

```ts
const copierPrompt = async () => {
  const texte = assemblePromptIa(profile, getWeights(profile.id).at(-1) ?? null);
  try {
    await navigator.clipboard.writeText(texte);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texte;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  setCopie(true);
};
```

(Le stockage des pesées est trié par date ascendante — `at(-1)` est la dernière pesée.)

3e. Remplacer la section JSX « Génération IA » (lignes 562-579) par :

```tsx
      <section className="profile-section">
        <h3>Génération IA</h3>
        <p className="onb-hint">
          Copie ce prompt dans un chat IA (Claude, ChatGPT…), attache tes fichiers HTML
          du carnet, complète les 3 champs {'{{...}}'} et envoie : tu récupères 4 fichiers
          .md prêts à importer.
        </p>
        <button type="button" className="profil-ghost" onClick={copierPrompt}>
          Copier le prompt IA
        </button>
        {copie && (
          <p className="muted" role="status">
            Prompt copié — colle-le dans le chat.
          </p>
        )}
      </section>
```

(Le bouton devient **toujours visible** ; les `setCopie(false)` des handlers d'enregistrement restent inchangés — ils effacent la confirmation quand un champ change.)

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/profil-screen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/profil-screen.test.tsx src/components/ProfilScreen.tsx
git commit -m "feat: le Profil copie le prompt IA complet (contexte + contrat)"
```

---

### Task 4: Docs + gates

**Files:**
- Modify: `docs/templates/prompt-semaine-ia.md` (pointeur), `README.md:126-128`, `AGENTS.md:10`, `ai/context/design-system.md:96`, `ai/context/ui-guideline.md:34`, `CHANGELOG.md` ([Non publié])

- [ ] **Step 1: `docs/templates/prompt-semaine-ia.md` → pointeur**

Remplacer TOUT le fichier par :

```markdown
# Prompt IA — Générer un cycle de semaines .md (Rituel)

> Ce prompt a déménagé : le maître est `src/assets/prompt-cycle-template.md`,
> assemblé par l'app avec le contexte du profil actif —
> **Profil → « Copier le prompt IA »** (`src/lib/promptIa.ts`).
>
> Ce fichier n'est plus maintenu. `template-semaine.md` reste la référence
> humaine du format .md.
```

- [ ] **Step 2: README — étape 1 de « Générer un cycle de semaines »**

Remplacer les lignes 126-128 :

```markdown
1. Ouvrir `docs/templates/prompt-semaine-ia.md`, remplir les paramètres
   (semaine de départ, menus, événements) et le coller dans un chat IA avec
   les 4 documents du dossier `diet/` en pièces jointes
```

par :

```markdown
1. Dans l'app : Profil → « Copier le prompt IA » — le prompt embarque ton
   contexte (objectif, régime, compléments, courses/budget…) et le format
   complet ; le coller dans un chat IA avec les 4 documents du dossier
   `diet/` en pièces jointes, compléter les 3 champs {{...}} (semaine de
   départ, menus, événements) et envoyer
```

- [ ] **Step 3: AGENTS.md ligne 10**

Remplacer `« Copier les paramètres IA »` par `« Copier le prompt IA »`.

- [ ] **Step 4: `ai/context/design-system.md` ligne 96**

Remplacer dans la table `.profil-ghost` : `bouton secondaire du Profil (« Copier les paramètres IA »)` → `bouton secondaire du Profil (« Copier le prompt IA »)`.

- [ ] **Step 5: `ai/context/ui-guideline.md` ligne 34**

Remplacer la puce **Génération IA** par :

```markdown
- **Génération IA** : bouton `.profil-ghost` « Copier le prompt IA » (clipboard + fallback execCommand, confirmation « Prompt copié — colle-le dans le chat. ») — **toujours visible** : le prompt maître (`src/assets/prompt-cycle-template.md`) est assemblé depuis le profil par `src/lib/promptIa.ts` (contexte perso + contrat de format inline) ; toute édition maison efface la confirmation (prompt périmé)
```

- [ ] **Step 6: CHANGELOG.md — sous `[Non publié]` › `### Ajouté`, ajouter :**

```markdown
- « Copier le prompt IA » au Profil : un geste copie le prompt complet de génération de cycle — contexte personnel (prénom, âge, dernière pesée, taille, objectif, régime, compléments, courses/budget) + squelette du format .md et règles dures inline. Remplace le bloc « Paramètres » à recoller à la main.
```

- [ ] **Step 7: Gates**

Run: `rg -n "Paramètres IA" src/ tests/ README.md AGENTS.md ai/`
Expected: aucune occurrence (hors `docs/superpowers/` et `docs/ameliorations.md`, historiques).

Run: `npm test`
Expected: PASS (tous les fichiers, y compris les 8 nouveaux tests promptIa).

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS (typecheck couvre aussi `dist` — aucune référence morte à `paramsIaTexte`).

Run: `npm run e2e`
Expected: PASS — changement UI limité au Profil ; zéro débordement sur 320/375.

- [ ] **Step 8: Commit**

```bash
git add docs/templates/prompt-semaine-ia.md README.md AGENTS.md ai/context/design-system.md ai/context/ui-guideline.md CHANGELOG.md
git commit -m "docs: le prompt IA de cycle vit dans l'app (Profil → Copier le prompt IA)"
```

---

## Self-review (fait à l'écriture du plan)

- **Spec couverte** : décisions 1-4 (Task 2/3), template inline (Task 1), pièces jointes rappelées (asset), variantes d'ouverture (tests Task 2), contexte conditionnel (tests Task 2), UI toujours visible + renommage + confirmation (Task 3), pointeur + README + AGENTS + ai/context + CHANGELOG (Task 4), tests listés dans la spec → 8 tests Task 2 + 3 tests Task 3.
- **Écarts assumés** documentés en tête (signature sans `maintenant`, titre « Son contexte » embarqué/disparaissant).
- **Types cohérents** : `WeightEntry` importé de `storage.ts` (vérifié : exporté ligne 23) ; `PRENOMS`/`ObjectifType` de `model.ts` (vérifiés : lignes 153/157) ; `ageDepuis`/`formatDayMonth` de `dates.ts` (vérifiés : lignes 22/14) ; `formatEuro` de `prix.ts` (vérifié : ligne 4) ; signature unique `assemblePromptIa(profil, dernierPoids)` dans Tasks 2 et 3.
- **Pièges déjà levés** : tri ascendant des pesées (`at(-1)`, pas `[0]`) ; U+00A0 de `formatEuro` dans les assertions ; clipboard mock APRÈS `userEvent.setup()` ; import `?raw` requis avant le typecheck (ordre Tasks 1→2).
