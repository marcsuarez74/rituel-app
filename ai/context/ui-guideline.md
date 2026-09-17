# UI Guidelines — Rituel

Complète `design-system.md` (les tokens) avec les règles d'usage. Source de vérité : les composants existants dans `src/components/`.

## Règles non négociables

1. **Thème clair unique** — jamais de dark mode, jamais de `prefers-color-scheme`, jamais de media query sombre
2. **Ultra visible** — tout élément interactif ≥ 48 px, tout texte ≥ 4,5:1 de contraste, hiérarchie claire au premier coup d'œil
3. **Fluide** — transitions 0,2 s (interactifs uniquement), `scale(0.97)` à l'activation, jamais de mouvement gratuit
4. **Français** dans toute l'UI (accents corrects : `Mélanie`, `Déjeuner`, `Dîner`)

## Structure d'écran

- `App.tsx` choisit : `Onboarding` (pas de profil) → shell 2 onglets OU écran `ProfilScreen` poussé. **Pas d'écran intermédiaire** : sans semaine en storage, la semaine d'exemple se charge automatiquement (fallback en mémoire dans `App.tsx`)
- Shell : `WeekBanner` (seul `h1`, + icône « Mon profil » à droite) → nav **segmented** sous la bannière (🛒 Cuisine / 🎯 Mon suivi) → vue active
- **Mon suivi est personnalisé** : **bloc Objectif** (`.obj-bloc`) + carte Poids seule (`.stat-card-hero`) + `ProfileView` rendus avec le profil actif uniquement + accueil « Salut {prénom} 👋 » — jamais les données de l'autre
- Sections = `h3` dans des cartes (`section` + classe sémantique). États vides systématiques (`.muted`)
- Écran poussé (Profil) : bouton retour en haut, pas de nav segmented, sorties par retour ou action explicite

## Onboarding (premier lancement)

- 5 étapes obligatoires, lancées si `sportapp:profile` absent **ou en ancienne forme** (→ **migration préremplie**) ; style « grand écart fun » : dégradés saturés, émojis géants, **points de progression** en haut, boutons `.onb-back`/`.onb-next` à partir de l'étape 2
- Étape 1 : deux grandes cartes profil (💪 Marc basilic / 🌿 Mélanie citron, tagline « Diet & sport » / « Keto & sport »)
- Étape 2 (infos) : « Salut {prénom} 👋 » + **date de naissance** (l'âge s'affiche calculé) + poids/taille avec bornes (30–250 kg, âge calculé 10–100 ans, 120–230 cm), erreur inline `role="alert"` ; en migration, note `.onb-note` + `.mig-prof`, étape 2 directe, seule la date à compléter
- Étape 3 (objectif) : 4 cartes radio `.rcard` (Perte / Affiner / Masse / Maintien) + échéance (date optionnelle) + poids objectif — **pas de kcal/jour**
- Étape 4 (compléments & régime) : chips presets + ajout libre (`.chips`/`.addrow`), radios `.rl` régime ; bouton « Continuer »
- Étape 5 (maison & courses) : magasin habituel (datalist presets), budget max hebdo, foyer (`.onb-row2` personnes / repas par jour), préférences de plats (chips + libre) — **tout optionnel** ; CTA final « C'est parti ! 🚀 »
- Submit = `saveProfile` (shape v2.1) + première pesée datée du jour ; pas de bouton « passer » (l'app est inutilisable sans profil — c'est voulu)
- Accent unique Herbes partout : basilic = action/valeur principale, citron = surbrillance (jamais une couleur de texte)

## Écran Profil

- 5 sections éditables séparément : **Mes infos** (date de naissance/taille, âge calculé), **Objectif** (cartes radio + échéance + poids objectif), **Compléments** (chips presets + libre), **Régime** (radios), **Maison & courses** (magasin datalist, budget max, foyer `.onb-row2`, préférences — mêmes champs que l'onboarding, un champ vidé retire la donnée) — enregistrement **par section**, feedback « enregistrées ✓ » en `role="status"` ; une erreur est rendue **dans sa section**
- **Génération IA** : bouton `.profil-ghost` « Copier le prompt IA » (clipboard + fallback execCommand, confirmation « Prompt copié — colle-le dans le chat. ») — **toujours visible** : le prompt maître (`src/assets/prompt-cycle-template.md`) est assemblé depuis le profil par `src/lib/promptIa.ts` (contexte perso + contrat de format inline) ; toute édition maison efface la confirmation (prompt périmé)
- **changer de profil** (bordure `--danger`, `window.confirm` obligatoire — efface le choix, garde les données)
- Après changement : retour à l'onboarding (le sous-arbre suivi est démonté, les données restent en storage)

## Onglet Cuisine (Courses / Menu / Batch)

- **Pill du menu** : `.menu-pill` dans la bannière, à côté du `h1` — le menu courant reste visible sur les 3 sous-onglets (toujours un seul `h1`)
- **Menu v2 (réserve de recettes)** : 1 ligne repas = 1 occurrence cochable (`.menu-card`, coche « c'est fait »), aucun jour imposé — le .md reste la source, l'ordre du fichier est conseillé (batch/frigo d'abord, frais en dernier)
- **Fiches recettes dépliables** : état local par carte (plusieurs ouvertes possibles), `aria-expanded` sur le bouton ET sur les chips de bases
- **Tags de profil** : chaque repas porte un tag coloré (Marc / Mé / Famille / Batch) — jamais la couleur seule comme information
- **Courses** : compteurs d'items par rayon (`.rayon-cnt`) et encadré keto dédié en dernier — le rayon `Keto` n'est pas un rayon comme les autres
- **Budget courses** (`.bud`) : carte au-dessus de la liste — estimé menu vs payé réel de la semaine (`sportapp:depenses`, dates dans [du..au]) vs budget max ; barre + alerte de dépassement ; visible seulement si une donnée budget existe ; « Total payé » ouvre le panneau avec focus total
- **Panneau « Mes dépenses réelles »** : écran poussé de l'onglet Courses (pas de nav segmented) — saisie (upsert par (date, magasin), date non future, total > 0), résumé « Par magasin » (casse ignorée, première graphie conservée), historique trié date desc avec suppression directe ✕
- **Batch** : rituel = timeline cochable (lignes ≥ 48px, coche barrée comme les checklists), micro-batch = carrousel horizontal (`overflow-x: auto` interne, scrollbar masquée — scroll natif du navigateur, jamais de carrousel JS)

## Composants — conventions

- **Présentatifs et minces** : props descendantes, la logique reste dans `src/lib/`
- **Classes sémantiques** (`.menu-card`, `.checklist`, `.done`) — pas de classes utilitaires, pas de style inline (exception : `style` dimensionnel sur les barres des StatCards)
- **Resynchronisation par prop** : pattern render-phase reset (`syncedSemaine`/`syncedProfile`) — voir `Checklist.tsx`. Interdit : `useEffect` de sync, `key` imposé au consommateur. **Une exception documentée** : keys dérivées de `weightsBump` (`key={`obj-${weightsBump}`}` sur `ObjectifBloc`, `key={weightsBump}` sur `StatCards`) dans `App.tsx` (relisent les pesées au remount après une pesée ajoutée)
- **Rétrocompatibilité des props** : un composant existant ne change de signature qu'en ajoutant des props optionnelles (ex. `onChecksChange?` de Checklist)

## Formulaires

- Inputs avec `aria-label` explicite (pas de placeholder seul)
- Validation au submit (pas de nag à la frappe) ; erreur = `<p className="error" role="alert">`
- Après un submit valide : vider le champ valeur, conserver la date ; effacer l'erreur affichée

## Feedback utilisateur

- Coche = retour immédiat (état barré) + persistance instantanée en localStorage
- Images de rayons : `loading="lazy"`, `alt` = libellé du rayon (utile si la miniature ne charge pas), fallback `defaut.jpg` pour un rayon inconnu
- Confirmation avant toute action destructive (`window.confirm`)

## Interactions tactiles

- Zone de clic = toute la ligne du label (pas seulement la checkbox)
- Nav segmented : `aria-current="page"` sur l'actif, différenciation visuelle forte (pilule glissante `--surface` + ombre, actif encre vs inactif muted) ; animation = rebond élastique 0,32s (pilule), tuée par `prefers-reduced-motion`
- `:focus-visible` toujours visible (clavier = outline accent) ; `.sr-only` pour les inputs fonctionnellement cachés mais focusables

## À ne PAS faire

- ❌ Couleur hex en dur dans un composant (utiliser les tokens `var(--…)` ; sur basilic → texte blanc `#ffffff`, sur citron → texte encre `#26312b`)
- ❌ Montrer les données de l'autre profil dans Mon suivi
- ❌ Écran intermédiaire avant le contenu (pas de page « importer d'abord » — la semaine d'exemple suffit)
- ❌ Nouveau pattern de sync d'état (celui du repo suffit)
- ❌ Modal custom / lib de composants — `window.confirm` et les cartes suffisent
- ❌ Animations longues (> 0,25 s) ou décoratives
- ❌ Dark mode « parce qu'on peut » (le thème clair Herbes est le seul thème)
