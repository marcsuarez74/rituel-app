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
