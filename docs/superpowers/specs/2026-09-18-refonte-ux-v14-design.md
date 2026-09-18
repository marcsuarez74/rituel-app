# Refonte UX v1.4 — « Rituel » (Herbes)

- **Date** : 18 septembre 2026
- **Statut** : spécification validée par Marc (décisions tranchées en brainstorming, maquettes interactives validées)
- **Livrables maquette** : session visuelle du 18/09 (bannière, hub profil, suivi, mes box, budget, liste courses — 3 traitements, « pot citron » retenu)

## Vision

Rituel part de 2 utilisateurs (Marc & Mélanie) mais doit accueillir d'autres foyers sans leur imposer notre vocabulaire ni nos données personnelles. Trois mouvements :

1. **Recentrer** : le cœur de l'app = le rituel repas (cycle 4 semaines, courses, batch). Pesées, sport, budget deviennent opt-in, pas des obstacles d'entrée.
2. **Aérer** : les écrans gagnent en hauteur (bannière −50 %, profil en hub, budget déplacé en fin de flow) et en lisibilité (liste courses resserrée, icônes alignées).
3. **Signer** : une identité visuelle Herbes assumée — le **citron devient la couleur du rituel**, l'anneau de progression « bourgeon » devient l'élément mémorable du suivi.

## Résumé des 14 demandes → décisions

| # | Demande de Marc | Décision validée |
|---|---|---|
| 1 | Profil trop long, tout s'enchâîne | Hub profil : en-tête compte + 4 tuiles blanches sur canvas crème + actions directes (détail au clic) |
| 2 | Trop d'infos perso obligatoires | Onboarding **tout sautable** ; pesées/sport/budget deviennent optionnels |
| 3 | Créer un profil (pas seulement Marc/Mélanie) | Profils libres 1–2 max (prénom éditable, ids techniques stables en v1.4, généralisation complète en vague 3) |
| 4 | Tuto « pourquoi cette app » | Intro swipeable (2-3 écrans) avant onboarding + section « À propos » dans le hub Profil |
| 5 | Bannière trop grande, doublons, sync invisible | Bannière une ligne (~56 px) : chevrons toujours visibles + « Semaine 37 / 1→7 sept. · Cycle 2 » + chip « ● Duo » + avatar |
| 6 | Budget trop de place, mieux en fin de flow | Carte budget supprimée du haut ; saisie du total après la **dernière coche** (bottom sheet) ; mini-carte récap en bas de liste (cliquable) |
| 7 | Icônes mal alignées (« ← retour ») | Audit + correctif : patterns d'alignement flex uniques (basel align, icône 18 px, gap 6 px) |
| 8 | « Déjeuner » → « Mes box », toujours visible | Renommage + pill **épinglée à droite** de la rangée scrollable des jours (trait vertical séparateur) |
| 9 | Batch → « Mon Rituel », recettes plus détaillées | Renommage + **références recette** dans les tâches : le mode guidé affiche la fiche complète (étapes, temps, four) à chaque étape |
| 10 | Micro-batch pas clair | Contenu enrichi : durée, quantité, référence recette sur chaque tâche (contrat .md étendu) |
| 11 | La Réserve à développer | **Joker interactif** : un soir sans dîner planifié → suggestion « Sors la réserve : Chili ×2 », coche = consommé |
| 12 | Liste courses trop grossière | Items resserrés (titre 14 px, rows ~40 px), cibles tactiles conservées |
| 13 | Suivi pas clair, « Cible » à améliorer | Carte héro unique fusionnée : anneau ProgressRing (SVG, caps arrondis, bourgeon citron) + badge delta 7 j + échéance |
| 14 | Les 2 premiers blocs à améliorer | ObjectifBloc + StatCards fusionnent dans le héro ci-dessus |

---

## 1. Bannière et foyer

**État actuel** : `WeekBanner` ≈ 120-140 px, la période affichée deux fois (id + dates), pastille sync = point muet sans label, chevrons masqués tant qu'une seule semaine existe (d'où l'impression qu'ils « ne marchent pas »).

**Décision** — une ligne (~56 px), layout exact :

```
[←]  Semaine 37          [→]  [● Duo] [avatar]
      1 → 7 sept. · [Cycle 2]
```

- Chevrons **toujours visibles**, grisés quand pas de semaine avant/après — tap = semaine adjacente
- Gap chevron↔titre : **12 px** (validé sur maquette v7)
- Tap sur le titre = **changeur de semaine** (liste, semaine courante en tête) — prépare les 4 semaines du cycle
- Pastille **Cycle 2** : pill basilic à côté des dates, tap = onglet Menu
- Chip **● Duo** : tappable → hub Foyer. États : « ● Duo » (connecté, basilic), « ● Duo ⟳ » (sync en cours), « ● Local » (gris, hors foyer). La connexion foyer devient un citoyen de première classe
- Avatar → Profil (inchangé)
- L'icône profil inline actuelle (`WeekBanner.tsx:80-84`) passe par `Icon.tsx`

## 2. Profil en hub

**État actuel** : `ProfilScreen` = 806 lignes, 11 sections empilées, 19 `useState`, scroll interminable.

**Décision** — hub « canvas crème unifié » (le fond crème du header s'étend à toute la page) :

```
┌────────────────────────────┐
│ [M]  Marc                  │
│      ● Duo connecté · Cycle 2 │   ← en-tête compte (crème, sans démarcation)
├────────────────────────────┤
│ [🎯 Objectif]  [ℹ️ Mes infos] │   ← 4 tuiles blanches, ombre douce basilic,
│ [🏠 Courses]   [🔔 Notifs]    │      détail au clic (page dédiée, retour ‹)
├────────────────────────────┤
│ 🔄 Changer de profil         │   ← actions directes (rows)
│ 📋 Copier le prompt IA       │
│ ● Duo connecté — voir le foyer│
│ Déconnecter le foyer (danger) │
└────────────────────────────┘
```

- Tuiles : fond **blanc** (`--surface`), ombre basilic douce, résumé d'état sous le titre (« Perte · -4,2 kg », « Carrefour · 80 € · 2 pers. », « 2 évts · 1 rappel »)
- Chaque tuile ouvre une **page détail** dédiée (pas d'accordéon) — les formulaires respirent, jamais de scroll long
- « Supprimer les données du foyer » vit dans la page Foyer, avec la double confirmation actuelle
- L'import .md (encore branché dans la section Semaine) est **retiré du hub** — AGENTS.md le demande déjà, il reviendra avec la future convention « template » ; le parser reste la référence du format
- Le footer « Rituel vX — vos données restent sur votre téléphone » reste

## 3. Profils, onboarding, tuto

### 3.1 Tuto (nouveau)
- **Intro swipeable** AVANT l'onboarding : 2-3 écrans. Contenu proposé : (1) l'histoire — « Créée par Marc pour Mélanie, cuisiner à deux sans y penser » ; (2) le quotidien — cycle 4 semaines, courses du dimanche, rituel batch ; (3) « Créer mon profil ». Re-consultable : entrée « À propos » dans le hub Profil
- Ton : personnel, sobre, aucun jargon produit

### 3.2 Onboarding tout sautable
- Les 5 étapes restent (identité, infos, objectif, personnalisation, maison & courses, sync), mais **chaque étape porte un CTA discret « Passer »** — seule l'étape 1 (prénom/combien on est) est obligatoire
- Correction au passage : l'étape 4 réaffiche aujourd'hui le radiogroup objectif et le poids objectif déjà saisis à l'étape 3 (et 3 fois en migration) — à supprimer
- Champs optionnels non remplis = sections silencieuses dans l'app (pas de bloc « Renseigne ton poids » culpabilisant)

### 3.3 Profils (par paliers)
- **Vague 2 — renommage** : les ids techniques restent `marc`/`melanie`, mais le **prénom s'édite** à l'étape 1 (« C'est ton prénom ? ») et dans Mes infos. Les libellés UI (titres, salutations, portions, tags) utilisent le prénom. Les 3 sources actuelles de vérité (`PROFILS` onboarding, `TITLES` ProfileView, `PRENOMS` model.ts) fusionnent en une
- **Vague 3 — profils libres** (voir « Impact technique ») : 1 ou 2 profils actifs, prénom choisi, et le contrat .md se généralise

## 4. Onglet Cuisine

### 4.1 Menu — « Mes box » épinglé
- Renommage : « 🍱 Déjeuners » → **« 🍱 Mes box »** (emoji gardé)
- La pill est **épinglée à droite** de la rangée scrollable des jours, séparée par un trait vertical — toujours à l'écran quel que soit le scroll
- Les days pills scrollent derrière ; « Mes box » garde son état actif/`.fait`

### 4.2 « Mon Rituel » (ex-Batch)
- Renommage onglet : **Batch → Mon Rituel**
- **Références recette** dans le contrat .md : `- [ ] Egg muffins ×10 → egg-muffins` (extension rétrocompatible : sans ref, comportement actuel)
- Le **mode guidé** devient recette-aware : chaque étape avec ref affiche la fiche (ingrédients de production, étapes, temps, four) dépliable inline — plus de « egg muffin × 10 » sans mode d'emploi
- La timeline, la durée cumulée, `- production:` / `- termine:` restent

### 4.3 Micro-batch
- Même mécanique de refs + contenu concret obligatoire à l'affichage : **durée** (`15 min`), **quantité**, **ref recette** si utile
- Contrat : `- mardi: précuire brocolis | 10 min | 2 boîtes → brocolis-vapeur` (extension rétrocompatible : `| détail` reste accepté)
- La bannière « Ce soir » reste (elle fonctionne)

### 4.4 La Réserve — joker interactif
- Les plats de réserve (jour ou `mel` → en vague 3, tout prénom) affichent leur **conservation** et un état (disponible / consommé)
- **Suggestion auto** : un soir sans dîner planifié → encart « Sors la réserve : Chili ×2 (congélateur) » sur la fiche du jour ; cocher = réserve consommée, le jour passe en « déjà géré »
- Section Mon Rituel : la Réserve gagne une explication d'une ligne (« Les plats d'avance qui attendent leur soir »)

### 4.5 Courses — liste resserrée + rituel citron + budget en fin de flow
- **Densité** : titre item 14 px, rows ≈ 40 px (padding 10/12), la lisibilité d'ensemble prime — cibles tactiles ≥ 48 px conservées via la marge de frappe
- **Le rituel passe en tête** (traitement « pot citron » validé) : zone « Le rituel de dimanche » au-dessus des rayons — vignette citron, items au **pot citron** + bordure `#e3c94f` + sous-ligne « pour egg muffins ×12 », coche citron à la validation. C'est la **seule** utilisation du citron dans la page : l'œil isole le batch instantanément
- Les items rituel vivent **uniquement dans la zone rituel** (une seule occurrence, pas de double coche, pas de doublon rayon)
- **Budget déplacé en fin de flow** :
  - Plus de carte budget en haut de l'onglet
  - À la **dernière item cochée** → bottom sheet « 🎉 Courses terminées ! / Saisis le total payé, le budget suit tout seul » (champ + Valider / « Plus tard »)
  - Une fois payé : **mini-carte récap en bas de liste** — « Payé cette semaine / 72,40 € », barre fine, « Budget 80 € · 7,60 € restants / Voir mes dépenses › » (cliquable → panneau dépenses réelles, qui reste inchangé)
  - Avant paiement : rien en bas (pas de culpabilité)

## 5. Mon suivi — la carte héro

**État actuel** : ObjectifBloc (pills + échéance + barre + ligne « Départ X · X → Y → cible Z » où le départ apparaît deux fois) PUIS StatCards (1 carte « Poids » + delta 7 j). Beaucoup de place, peu de tension.

**Décision** — **une carte héro unique** :

```
┌──────────────────────────────────┐
│  ╭───╮   OBJECTIF · PERTE        │
│  │ ⊙ │   76 kg                   │   ⊙ = anneau SVG : piste #e7eae0,
│  ╰───╯   [▼ -0,6 kg / 7 j]        │       arc basilic caps arrondis,
│  Échéance 15 déc. · dans 88 j     │       BOURGEON CITRON en bout d'arc
│  [Keto le soir] [2 compléments]   │
└──────────────────────────────────┘
```

- Composant **`ProgressRing`** (SVG maison, comme `WeightChart`) : `stroke-linecap="round"`, centre = « -4,2 / kg restants » (ou à prendre), le bourgeon **voyage** le long de l'arc à chaque pesée, boucle fermée à 100 % — animé (une transition d'arc, respecte `prefers-reduced-motion`)
- Badge delta 7 j coloré selon le sens vs objectif (existant)
- Échéance + régime + compléments : lignes/chips dessous
- La ligne doublée « Départ X · X → Y → cible Z » est corrigée (départ une seule fois)
- Les pesées (formulaire, graphe, historique) restent inchangées en dessous
- Le fallback « Cible » (texte brut du .md) reste dans ProfileView

## 6. Détails transversaux

- **Alignement des icônes** : audit de tous les patterns icône+texte (`← Retour`, tuiles, actions, tabs). Standard : `display:flex; align-items:center; gap:6px`, icônes 18 px dans un boîte de 24 px, texte `line-height` aligné. Correctif ciblé sur `.profil-back` et les `.action` du hub
- **Tokens nouveaux** : `--citron-surface` (`#fdf6d8`) et `--citron-line` (`#e3c94f`) — les couleurs du traitement « pot citron » (items rituel des courses). (Le `--accent-surface` initialement envisagé pour les tuiles est abandonné : les tuiles validées sont blanches.)
- **Citron = rituel** : le citron (`--accent-2`) devient sémantiquement « ce qui nourrit le rituel » (zone rituel courses, bourgeon anneau, coche du bloc). La carte budget (qui l'utilisait) disparaît de la page — pas de conflit
- Les émojis restent confinés aux salutations/onboarding (règle AGENTS.md) ; l'UI passe par `Icon.tsx` — les vignettes rayon et pots utilisent les miniatures existantes ou de nouvelles icônes SVG

## Impact technique

### Contrat .md (extensions rétrocompatibles, v1 toujours acceptée)
1. Refs recette sur tâches batch : `- [ ] X → slug` et micro-batch `- jour: quoi | durée | quantité → slug | détail`
2. Vague 3 — profils libres : sections `## <Prénom>` (déjà génériques pour les séances), clés repas `dejeuner-{prénom}` / `diner-{prénom}` dérivées des sections présentes (validation dynamique), `portions {prénom}:`, réserve `- {prénom}:`
3. Le parser valide contre l'ensemble des sections trouvées, plus contre la liste fixe ; `diner-famille` inchangé

### Storage
- Vague 2 : `sportapp:profile` gagne un champ `prenom` (shape v2.2, migration douce — v2.1 lu puis re-sauvé)
- Vague 3 : `sportapp:profiles` (1-2 profils) + pointeur actif ; migration des poids (`sportapp:weights:{id}` inchangés tant que les ids techniques restent en v2)

### Sync / Push
- Vague 2 : rien (ids techniques inchangés)
- Vague 3 : `engine.ts` (filtre profil), `push/module.ts` + `push-register` (validation d'id) passent sur les ids réels ; les shapes de mutation gagnent l'id de profil dynamique

### Points de fragilité connus
- Les **ids de coches** (`seances:{nom}:…`, `menu:{jour}:{clé}`) sont un contrat stable — le renommage vague 2 ne touche que les libellés, jamais les ids. En vague 3, les clés repas changent d'écriture dans le .md : les .md existants continuent de parser (ancienne forme acceptée), les nouveaux utilisent la nouvelle
- La zone rituel des Courses recalcule la liste des items rituel depuis les tâches batch + refs recette : si aucun ref, fallback = marquage actuel (notes de tâche)

## Vagues d'implémentation

- **Vague 1 — Rafales** (pas de migration) : bannière compacte + chevrons visibles + chip Duo ; icônes alignées ; liste courses resserrée + zone pot citron ; bottom sheet paiement + récap fin de liste ; Mes box épinglé + renommage ; Batch → Mon Rituel (libellés) ; Suivi : ProgressRing + héro fusionné ; Profil hub tuiles ; tuto intro + À propos
- **Vague 2 — Personnalisation** : onboarding tout sautable (+ suppression du doublon objectif étape 4), prénoms éditables (fusion des 3 sources de libellés), micro-batch enrichi, refs recette batch + mode guidé recette-aware, Réserve joker, token `--accent-surface`
- **Vague 3 — Profils libres** : contrat .md généralisé, storage multi-profils, sync/push dégraissés, onboarding création 1-2 profils

## Ce qui ne change pas

- Le parser et le format .md existants (aucune casse avant la vague 3, extensions rétrocompatibles)
- Le mode magasin, les fiches recettes (contenu), le panneau dépenses réelles, WeightChart, la sync Supabase et les notifications push
- Le thème clair unique, les tokens existants, la nav TabBar 2 onglets + swipe
