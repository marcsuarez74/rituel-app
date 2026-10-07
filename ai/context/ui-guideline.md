# UI Guidelines — Rituel

Complète `design-system.md` (les tokens) avec les règles d'usage. Source de vérité : les composants existants dans `src/components/`.

## Règles non négociables

1. **Thème clair unique** — jamais de dark mode, jamais de `prefers-color-scheme`, jamais de media query sombre
2. **Ultra visible** — tout élément interactif ≥ 48 px, tout texte ≥ 4,5:1 de contraste, hiérarchie claire au premier coup d'œil
3. **Fluide** — transitions 0,2 s (interactifs uniquement), `scale(0.97)` à l'activation, jamais de mouvement gratuit
4. **Français** dans toute l'UI (accents corrects : `Mélanie`, `Déjeuner`, `Dîner`)

## Structure d'écran

- `App.tsx` choisit : `Onboarding` (pas de profil) → étape « Ta semaine » (foyer jamais enregistré) → shell, ou un écran poussé (Profil, Mon cycle, Ma semaine type, fiche recette, mode guidé). **Pas d'écran intermédiaire** : sans cycle importé, le cycle d'exemple se charge (chunk à la demande)
- Shell : en-tête fin (`.en-tete` : seul `h1` = titre de l'écran, avatar 48 px + point de sync) → ligne semaine (`.ligne-semaine`, Menu/Courses/Rituel seulement) → contenu → barre du bas fixe (`.barre-onglets`, 5 onglets, icône + libellé toujours visibles, actif = `aria-current="page"` + pastille)
- **Personnalisé** : repas, portions, macros et versions du membre actif ; les versions des autres membres en lignes secondaires
- Sections = `h2` dans des cartes (`section.profile-section`). États vides systématiques (`.muted`)
- Écran poussé : bouton retour en haut (`.profil-back`), pas de barre du bas ; actions principales dans un pied fixe (`.pied-recette`)
- Feuilles (report) : `role="dialog"` en bas d'écran sur voile ; actions annulables par **toast** « Annuler » 5 s

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
- **Génération IA** : dans Mon cycle (étape 1 « Copie le prompt ») — le prompt maître (`src/assets/prompt-cycle-template.md`) est assemblé par `src/lib/promptIa.ts` depuis le foyer, la semaine type et le profil, schéma recopié de `types.ts`
- **changer de profil** (bordure `--danger`, `window.confirm` obligatoire — efface le choix, garde les données)
- Après changement : retour à l'onboarding (le sous-arbre suivi est démonté, les données restent en storage)

## Écrans du cycle

- **Aujourd'hui** : jauges semaine (`.jauge`), action du jour (`.action-du-jour`, bordure basilic), repas du jour (`.carte-repas` : moment, titre, méta, coche 48 px `.coche`)
- **Menu** : bande des 7 jours (`.bande-jours`, `role="tablist"`, point = journée faite), repas du jour, « Pas ce soir : reporter », « Ce soir, j'anticipe » (`.anticipe`, pointillé)
- **Courses** : carte budget (`.budget-chiffres`, `.alerte` en `--danger`), chariot, mode magasin, rayons, extras keto en encadré citron en dernier, placard replié (`details.placard`)
- **Rituel** : segment 3 sections, déroulé en cartes dépliables ; mode guidé = une étape par écran, progression segmentée, minuteur (`.minuteur`)
- **Mon cycle / Semaine type** : écrans poussés, choix en segments (`.segment` radio), listes de lignes `.hub-ligne` côté Profil

## Composants — conventions

- **Présentatifs et minces** : props descendantes, la logique reste dans `src/lib/`
- **Classes sémantiques** (`.menu-card`, `.checklist`, `.done`) — pas de classes utilitaires, pas de style inline (exception : `style` dimensionnel sur les barres des StatCards)
- **Resynchronisation par prop** : pattern render-phase reset — voir `useCoches`, `useReports`, `Pesees.tsx`. Interdit : `useEffect` de sync. **Une exception documentée** : `key` dérivée d'un compteur de pesées sur `SuiviHero` (`ecrans/Suivi.tsx`), qui relit les pesées au remount
- **Rétrocompatibilité des props** : un composant existant ne change de signature qu'en ajoutant des props optionnelles

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
- ❌ Écran intermédiaire avant le contenu (pas de page « importer d'abord » — le cycle d'exemple suffit)
- ❌ Nouveau pattern de sync d'état (celui du repo suffit)
- ❌ Modal custom / lib de composants — `window.confirm` et les cartes suffisent
- ❌ Animations longues (> 0,25 s) ou décoratives
- ❌ Dark mode « parce qu'on peut » (le thème clair Herbes est le seul thème)
