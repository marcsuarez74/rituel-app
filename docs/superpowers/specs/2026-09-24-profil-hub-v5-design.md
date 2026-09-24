# Profil hub v5 — refonte ProfilScreen (cards)

- **Date** : 24 septembre 2026
- **Statut** : spécification validée par Marc (cadrage 24/09, blocs 1-2 validés)
- **Références** : spec UX v1.4 §2 « Profil en hub » + §6 (détails transversaux) ; maquette de référence `docs/superpowers/mockups/v14/profil-prototype-v5.html` (variante « Tuiles » retenue, accordéons abandonnés)

## Vision

Aujourd'hui `ProfilScreen` empile 11 sections (835 lignes, 19 `useState`, scroll interminable). La cible : un **hub « canvas crème unifié »** — une vue générale courte, le détail au clic, les formulaires qui respirent, jamais de scroll long.

Décisions tranchées en cadrage :

1. **Périmètre** : hub + pages détail (Objectif / Mes infos / Maison & courses / Notifications) + **page Foyer**. Le tuto intro/« À propos » (v1.4 §3.1) reste un autre chantier.
2. **Régime + compléments** vivent dans la **page Objectif** (« ton cap » : type, poids objectif, échéance, régime, compléments) — cohérent avec le héro du suivi qui les affiche ensemble.
3. **Import .md gardé dans le hub** (action directe « Importer un cycle (.md) ») — le process de cycle (prompt IA → 4 fichiers .md à importer) en dépend ; la phrase v1.4 « retiré du hub » est abandonnée et **AGENTS.md est ajusté** (convention « template » toujours prévue plus tard).

## Structure

```
src/components/ProfilScreen.tsx   ← hub mince : en-tête compte + tuiles + actions + useState<Vue>
src/components/profil/            ← miroir de cuisine/
  ProfilObjectif.tsx   ProfilInfos.tsx   ProfilMaison.tsx   ProfilNotifs.tsx   ProfilFoyer.tsx
```

- **Navigation interne** : `useState<Vue>` ('hub' | 'objectif' | 'infos' | 'maison' | 'notifs' | 'foyer') dans ProfilScreen. Tuile/action → page ; « ‹ Profil » remonte au hub. Anim fade latérale comme le swipe, respecte `prefers-reduced-motion`. Pas de routeur, pas d'URL.
- **Câblage existant conservé** : `profile`, `syncEtat`, `onProfileSaved`, `onChangeProfile`, `onImported`, `onBack` ; **nouvelle prop `cycle`** = `numeroCycle(affichee.data.meta.semaine)` calculée dans App.
- **Chaque page détail** : états internes `useState(() => from profile)` + **render-phase reset** `syncedProfile` (pattern en place — cf. ProfileView/Checklist/ShoppingList, ne pas inventer un 4e pattern). Save → `saveProfile` + `onProfileSaved`. Le code métier actuel (validations, pattern delete + re-set, copier prompt, sync engine, push module) est **déplacé, pas réécrit**.

## Hub

```
┌────────────────────────────┐
│ [M]  Marc                  │
│      ● Duo connecté · Cycle 2 │   ← en-tête compte (canvas crème, sans démarcation)
├────────────────────────────┤
│ [🎯 Objectif]  [ℹ️ Mes infos] │   ← 4 tuiles blanches, ombre basilic douce, grid 2 col
│ [🏠 Courses]   [🔔 Notifs]    │      détail au clic (page dédiée, retour ‹)
├────────────────────────────┤
│ 🔄 Changer de profil         │   ← actions directes (rows blancs bordés)
│ 📋 Copier le prompt IA       │
│ ● Duo connecté — voir le foyer│
│ Déconnecter le foyer (danger) │
│ Importer un cycle (.md)       │
└────────────────────────────┘
```

- **En-tête compte** : avatar rond basilic avec l'initiale, prénom (`prenomProfil`), sous-ligne :
  - `● Duo connecté · Cycle 2` (point basilic) — sync `sync`
  - `● Duo ⟳ · Cycle 2` — sync `attente`/`erreur` (point danger)
  - `● Local · Cycle 2` (gris) — session posée mais foyer déconnecté (`hors-foyer`)
  - chip masquée si sync `off` → sous-ligne `Cycle 2` seul
- **Tuiles** : fond blanc (`--surface`), ombre basilic douce, titre + **résumé d'état sous le titre** :
  - **Objectif** → `Perte · -4,2 kg restants` (sens auto-détecté des données : cible vs départ/pesées ; `à prendre` si prise de masse) ; fallback `Perte` seul si le calcul n'est pas possible
  - **Mes infos** → `42 ans · 180 cm` (seuls les champs remplis, séparés par « · ») ; fallback `—` (champs optionnels silencieux)
  - **Maison & courses** → `Carrefour · 80 € · 2 pers.` (seuls les champs remplis) ; fallback `—`
  - **Notifications** → `2 évts · 1 rappel` (événements activés + nombre de rappels) ; fallback `—`
  - Cibles tactiles ≥ 48 px, contraste ≥ 4,5:1 (muted sur crème : mix comme ligne 309 de index.css), transitions sur interactifs seulement
- **Pages silencieuses** : la tuile **Notifications disparaît** si push indisponible (`pushActif()` faux) — même règle produit que le bloc actuel ; le hub passe à 3 tuiles.
- **Actions** : Changer de profil (confirm actuel) · Copier le prompt IA (feedback « Prompt copié » actuel) · ● Duo — voir le foyer (ouvre la page Foyer ; visible si session) · Déconnecter le foyer (danger, confirm actuel — raccourci du hub, **même handler/confirm que la page Foyer**) · Importer un cycle (.md) (ImportButton tel quel)
- **Footer** inchangé (« Rituel vX — vos données restent sur votre téléphone »)

## Pages détail

Toutes : retour « ‹ Profil », h2, formulaires aérés (classes onboarding-field existantes), CTA « Enregistrer ✓ », pattern `fil`/`alerte` par section conservé.

- **Objectif** : radiogroup type (OBJECTIF_TYPES) + poids objectif + échéance + **régime** (REGIMES, radiogroup) + **compléments** (chips + addrow) — les 5 save existants déplacés tels quels
- **Mes infos** : prénom + date de naissance + taille — validations actuelles conservées (paires date/taille, bornes)
- **Maison & courses** : magasin (datalist MAGASINS_PRESETS) + budget max + personnes + repas/jour + préférences chips — validations actuelles conservées
- **Notifications** (seulement si pushVisible) : toggle activation + chips événements + rappels (type/jour/heure) + ajout/suppression — code push actuel reconditionné, erreurs brutes portées
- **Foyer** : 
  - session posée : état sync (ETAT_SYNC) + « Déconnecter le foyer » + **« Supprimer les données du foyer » (double confirmation actuelle, disabled pendant la flush)** — décision : cette action vit dans la page Foyer (spec v1.4 §2)
  - session absente (sync prêt) : champ « Code de foyer » (password) + « Se connecter au foyer » + message d'échec
  - bloc entier masqué si sync `off` (sans env, tout est no-op)

## Détails transversaux (v1.4 §6)

- Pas d'émoji dans l'UI : 5 nouveaux SVG dans `Icon.tsx` — `info`, `home`, `bell`, `copy`, `refresh` (les émojis de la maquette sont remplacés ; règle AGENTS.md gagne)
- Le citron reste sémantiquement « rituel » : aucun citron dans la page Profil (la pesée-card color-mix existante est hors hub, inchangée)

## Impact technique

### Storage
- **Aucune migration** : le shape v2.2 couvre déjà tous les champs (poidsObjectif, complements, regime, magasin, budgetMax, preferences, personnes, repasJour). localStorage inchangé.

### Sync / Push
- **Rien** : ids techniques inchangés, shapes inchangés. Les composants déplacent du JSX, pas du câblage.

### Points de fragilité
- **Ids de coches** : aucun changement (aucun coche dans le profil).
- **Swipe** : ProfilScreen reste hors `main` (early return App) — pas de geste, inchangé.
- **Tests existants** : la hiérarchie change (« Mes infos » devient une page) — les tests ProfilScreen adaptent leur navigation (ouvrir la page avant les assertions) ; aucun test métier ne casse s'il suit le comportement visible.

## Tests (TDD)

- `components.test.tsx` — hub : tuiles (titres + résumés), navigation tuile→page→retour, actions (copier, confirm danger), pages silencieuses (notifs masquées sans SW) ; chaque page : save visible (texte/storage)
- `app.test.tsx` — en-tête « Cycle 2 » du ProfilScreen via la prop cycle
- e2e `onboarding-mobile.spec.ts` « Écran Profil — mobile » adapté (tuiles avant champs) + zéro débordement sur les 2 onglets, 320/375

## Ce qui ne change pas

- Le contenu des formulaires et validations, ImportButton, la sync Supabase, la notifications push, WeightChart, le panneau dépenses réelles
- Le thème clair unique, les tokens existants (un seul ajouté : `--creme`), la nav TabBar 2 onglets + swipe
- L'onboarding (v2.2 livré) — ses cartes/profil ne bougent pas
