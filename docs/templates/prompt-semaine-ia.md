# Prompt IA — Générer un cycle de semaines .md (Rituel)

À coller dans un chat IA (Claude, ChatGPT…) avec en pièces jointes :

1. `diet/carnet-recettes-batch-AAAA-MM-JJ.html` — le carnet (24 recettes, 4 menus, rituel, micro-batches)
2. `diet/listes-courses-AAAA-MM-JJ.html` — les listes Lidl par menu + encadré keto
3. `diet/plan-diet-AAAA-MM-JJ.html` — le plan diet de Marc (cibles, séances, rappels)
4. `diet/melanie/plan-keto-if-melanie-AAAA-MM-JJ.html` — le plan keto+IF de Mélanie
5. `docs/templates/template-semaine.md` — le squelette à remplir

## Paramètres (remplir avant d'envoyer)

- **Semaine de départ** : {{AAAA-Sxx}}, lundi {{AAAA-MM-JJ}}
- **Menus à générer, dans l'ordre du roulement** : {{ex. B, C, D, A}}
- **Événements de la période** : {{ex. mercredi : soirée danse Maëlle 16h ; vendredi 15 : soirée à deux (babysitter) ; vacances scolaires du...}}

## Ta mission

Génère un fichier .md par semaine demandée, conformes au template et au format
« Rituel » (fichier hebdo de l'app). Nommage : `AAAA-Sxx-menu-{lettre}.md`.
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
   Mélanie). Ajoute `→ slug` quand le plat correspond à une recette du fichier.
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
7. **Marc / Melanie** : copie CONFORME des blocs du template (cibles, séances,
   rappels). Ne réinvente rien ; n'adapte que ce qu'un événement impose.

## Règles dures (contrat — toute violation casse l'app)

- Zéro ligne hors format : chaque fichier doit être importé avec **0 warning**.
- Frontmatter : `semaine`, `menu`, `du`, `au` requis (ISO AAAA-MM-JJ), pas de
  « # » dans les valeurs.
- Ne modifie JAMAIS le libellé d'une coche existante (courses, rituel, tâches
  batch, séances) : le slug dérive du libellé.
- Les refs `→ slug` doivent viser des recettes présentes dans le même fichier.
- Un item de courses = une ligne ; pas de sous-puces, pas de gras, pas de table.
- Pas de section en plus ni de section renommée (## exactement : Courses, Menu,
  Batch, Recettes, Bases, Marc, Melanie).

## Auto-contrôle (à faire AVANT de répondre)

- [ ] Les 4 frontmatters : lundi→dimanche consécutifs, code semaine ISO correct
- [ ] Chaque fichier : les 7 jours, 5 clés, aucune clé inconnue
- [ ] Chaque `→ slug` correspond à une recette du fichier (slug = slugify du
      titre, sans accents ni majuscules)
- [ ] Recettes partagées entre menus : valeurs identiques
- [ ] Aucune ligne hors format (pas de gras, pas de tables, pas de sous-listes)
- [ ] Les blocs Marc/Melanie sont identiques d'une semaine à l'autre
- [ ] `### Réserve` : clés = jours ou « mel », chaque ligne a plat ET conservation
- [ ] production/termine/détails/réserve cohérents avec le rituel et le menu

## Sortie attendue

4 blocs de code markdown, un par fichier, précédés chacun d'une ligne
`### Fichier : AAAA-Sxx-menu-x.md` — rien d'autre.
