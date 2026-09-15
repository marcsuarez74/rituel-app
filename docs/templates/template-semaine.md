<!--
TEMPLATE SEMAINE — Rituel
Squelette d'UNE semaine. Remplacer tous les {{placeholders}} ; supprimer les
commentaires HTML. Le format fait foi : README.md (section « Le format .md »)
et src/lib/parse.ts. Règles absolues :
- Zéro ligne hors format : l'app doit importer ce fichier avec 0 warning.
- Pas de « # » dans les valeurs du frontmatter (YAML le lirait comme un commentaire).
- Les jours du menu s'écrivent Lundi → Dimanche (l'app réordonne d'elle-même).
- Titre de recette = EXACTEMENT celui du carnet (le slug du titre = l'id : il
  doit rester identique d'une semaine à l'autre, surtout pour les recettes
  partagées entre menus comme les tacos R5).
- Ne JAMAIS modifier le libellé d'une coche (courses, rituel, tâches batch,
  séances) d'une semaine déjà cochée sur un téléphone : le slug dérive du
  libellé, le renommer perd l'état.
- Refs recette : « → slug » = slugify du titre exact (ex. « R8 · Chili con
  carne + riz » → r8-chili-con-carne-riz).
- Le rayon « ### Keto » (extras de Mélanie) est toujours le DERNIER rayon.
- Le placard permanent (réassort mensuel) ne va JAMAIS dans un fichier hebdo.
-->

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
- dejeuner-marc: {{boîte ou repas}} → {{slug-recette si ref}}
- dejeuner-melanie: {{assiette keto}}
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
