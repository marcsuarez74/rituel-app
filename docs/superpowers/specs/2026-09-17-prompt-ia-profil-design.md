# Spec — Prompt IA de cycle assemblé depuis le profil

Date : 2026-09-17 · Statut : validée (design approuvé par Marc)

## Contexte

Le Profil affiche un bouton « Copier les paramètres IA » qui copie un bloc
« Paramètres » (magasin, budget, personnes à table, préférences, régime) à
coller à la main dans `docs/templates/prompt-semaine-ia.md`. Ce flow en deux
parts est fragile (deux copies, risque de divergence) et le prompt final ne
contient aucun contexte personnel (prénom, âge, poids, taille, objectif).

Objectif : un **seul** copier-coller depuis le Profil produit un prompt de
génération de cycle **prêt à l'emploi** — contexte personnel rempli par l'app,
template du format .md embarqué inline. Ce chantier prépare le retour de
l'import .md dans l'UI (chantier séparé).

## Décisions (approuvées)

1. **But du prompt** : générer 4 fichiers .md conformes au contrat, importables
   dans l'app (pas un simple plan lisible).
2. **Respect du format** : le template .md (squelette) + les règles dures +
   l'auto-contrôle sont **inline dans le prompt copié** — aucune dépendance à
   `template-semaine.md` en pièce jointe.
3. **Recettes** : elles viennent du **carnet HTML en pièce jointe** (les 4
   fichiers `diet/*.html` restent exigés, rappelés en tête du prompt).
4. **Interface** : un seul bouton (Approche A) — pas de second bouton, pas de
   partage en fichier (YAGNI).

## Architecture

```
src/lib/promptIa.ts                  # assemblePromptIa(...) — pur, testé
src/assets/prompt-cycle-template.md  # template maître (placeholders) — import ?raw
src/components/ProfilScreen.tsx      # bouton mince : copie le prompt assemblé
```

- `src/lib/promptIa.ts` : `assemblePromptIa(profil: UserProfile, dernierPoids:
  { date: string; kg: number } | null, maintenant: Date = new Date()): string`.
  La fonction lit le template (`import template from
  '../assets/prompt-cycle-template.md?raw'`) et remplit **deux** blocs :
  `{{OUVERTURE}}` (phrase d'ouverture avec personnel) et `{{CONTEXTE}}`
  (puces conditionnelles). Elle ne touche pas aux trois placeholders de chat.
- **Source unique** : le template maître vit dans `src/assets/`. Le fichier
  `docs/templates/prompt-semaine-ia.md` devient un pointeur vers lui.
- L'âge est calculé par la fonction **existante** `ageDepuis` (même source que
  le profil) — pas de nouvelle implémentation.
- Le composant lit `getWeights(profile.id).at(-1) ?? null` (le stockage est
  trié par date **ascendante** — `at(-1)` est la dernière pesée) et passe le
  résultat ; `promptIa.ts` ne touche jamais au storage.

## Contenu du prompt (trame validée)

```
{{OUVERTURE}}

Son contexte :
{{CONTEXTE}}

Pièces jointes attendues (à attacher dans ce chat) :
1. diet/carnet-recettes-batch-AAAA-MM-JJ.html — le carnet (24 recettes, 4 menus, rituel, micro-batches)
2. diet/listes-courses-AAAA-MM-JJ.html — les listes Lidl par menu + encadré keto
3. diet/plan-diet-AAAA-MM-JJ.html — le plan diet de Marc (cibles, séances, rappels)
4. diet/melanie/plan-keto-if-melanie-AAAA-MM-JJ.html — le plan keto+IF de Mélanie

À compléter avant d'envoyer :
- Semaine de départ : {{SEMAINE_DEPART}}
- Menus à générer, dans l'ordre du roulement : {{MENUS_ORDRE}}
- Événements de la période : {{EVENEMENTS}}

Ta mission · Process dans l'ordre (dates, courses, menu, batch, recettes,
bases, Marc/Melanie) · Règles dures (contrat : 0 warning à l'import) ·
Auto-contrôle · Sortie attendue — repris TEL QUEL du prompt détaillé actuel.
```

### `{{OUVERTURE}}`

Phrase d'ouverture assemblée, ex. avec pesée :

> Tu es un nutritionniste. Marc (41 ans, 82,4 kg — dernière pesée du 14/09,
> 180 cm) te demande de lui réaliser une rotation de menus sur 4 semaines pour
> installer une routine durable. Objectif : affiner la silhouette vers 72 kg
> d'ici mars 2027.

Variantes :
- **Aucune pesée** : « Marc (41 ans, 180 cm) » — la mention poids disparaît de
  la phrase (pas de « null kg »).
- **Pas de poids objectif** : l'objectif s'arrête au type (« affiner la
  silhouette »).
- **Pas d'échéance** : pas de « d'ici … ».
- **Format** : nombre décimal à la française (`82,4`), date de pesée `JJ/MM`,
  échéance en « mois année » français depuis l'ISO.

### `{{CONTEXTE}}`

Une puce par donnée **présente**, chaque ligne omise si non configurée :

- `- Régime particulier : {keto}` — omise si `regime === 'aucun'`
- `- Compléments : créatine, whey` — omise si la liste est vide
- `- Courses : Lidl, budget 40 €/semaine` — si magasin et/ou budget configurés
  (`40 €` via `formatEuro` ; sans magasin : « budget 40 €/semaine » seul)
- `- Personnes à table : 3 · 2 repas/jour` — si l'un des deux est configuré
- `- Préférences : batch dimanche, anti-gaspillage` — omise si vide

Bloc vide possible (aucun champ configuré) → `{{CONTEXTE}}` vide, la ligne
« Son contexte : » reste seule : acceptable, l'ouverture porte déjà
poids/taille/objectif.

## UI (Profil)

- Bloc « Génération IA », bouton renommé **« Copier le prompt IA »**.
- Texte d'aide : « Copie ce prompt dans un chat IA (Claude, ChatGPT…),
  attache tes fichiers HTML du carnet, complète les 3 champs {{...}} et
  envoie. »
- Retour visuel inchangé : « Prompt copié — colle-le dans le chat. »
- Le bouton reste toujours visible (poids/taille/objectif existent pour tout
  profil). « Copier les paramètres IA » disparaît (remplacé).

## Tests (TDD — `tests/lib/promptIa.test.ts` + composant)

1. Le template `?raw` est inclus dans la sortie (le squelette .md apparaît).
2. Chaque champ configuré apparaît ; chaque champ absent fait disparaître sa
   ligne (budget, régime `aucun`, préférences vides, compléments vides).
3. Âge calculé avec horloge mockée (`vi.setSystemTime` forme avec heure).
4. Poids = dernière pesée avec sa date (`JJ/MM`, virgule) ; `null` → variante
   sans poids, pas de crash.
5. Objectif : 4 combinaisons testées (± poids objectif, ± échéance).
6. Les 3 placeholders de chat restent intacts dans la sortie.
7. Composant : le bouton copie le prompt assemblé (clipboard stub) et affiche
   le retour.

## Docs

- `docs/templates/prompt-semaine-ia.md` → pointeur vers
  `src/assets/prompt-cycle-template.md`.
- README : une ligne sur le flow (« Profil → Copier le prompt IA »).
- CHANGELOG `[Non publié]` : « Prompt IA de cycle assemblé depuis le profil
  (contexte personnel + contrat de format inline) ».

## Hors périmètre

- Le retour de l'import .md dans l'UI (chantier séparé — ce spec ne fait que
  préparer les données).
- Génération IA dans l'app (edge function) et notifications push (phases
  reportées, cf. docs/ameliorations.md).
- Toute modification du contrat .md (`parse.ts`) — le prompt existant reste la
  référence du format.
