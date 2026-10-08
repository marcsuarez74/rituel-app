# Onboarding ouvert, foyer à rejoindre, page Objectif — spec

Date : 2026-10-07 · statut : validé, livré en 5 PR (#43, #44, #45, #46, PR 5)

## 0. Petits correctifs (inclus dans le lot)

- Semaine type (étape « Ta semaine ») : « Pour que **Rituel** cale les menus… ».
- Profil › Foyer : « Déconnecter le foyer » n'apparaît que si le téléphone est
  vraiment dans un foyer. Bug réel : un jeton dont le foyer n'existe pas (401
  `token-invalide`) laissait la session en place → état « erreur » + bouton.
  Désormais un 401 (pull ou flush) efface la session → « Local », formulaire
  créer/rejoindre.
- Mon cycle : date de début modifiable (déjà validé) ; fiche recette :
  interrupteur « Garder l'écran allumé » (déjà validé).
- `deploy/installer.sh` : la copie de sécurité prend `rituel.db` **et** son
  `-wal`/`-shm` ensemble, dans un dossier daté.

## 1. Identité : n'importe qui

Aujourd'hui `ProfileKey = 'marc' | 'melanie'` (profil, pesées, sync, foyer par
défaut, cartes d'onboarding, cycle d'exemple).

- `ProfileKey` devient une **chaîne** : `prénom-slug + '-' + 4 hex`
  (`camille-3f9a`), générée une fois, jamais affichée. Garde de forme :
  `/^[a-z0-9][a-z0-9-]{0,40}$/`. Les profils `marc` / `melanie` existants
  restent valides tels quels (aucune migration de données).
- Les homonymes ne gênent pas : chaque foyer est isolé côté serveur ; dans un
  même foyer, deux « Marc » ont deux ids distincts.
- `PROFILS_META` (Marc 💪 / Mélanie 🌿) disparaît ; `prenomProfil(p)` = prénom
  saisi. Les noms legacy ne servent plus qu'au préremplissage de la migration
  v1 (`loadProfilLegacy`).
- `Membre` gagne `telephone?: true` : ce membre a un profil sur un téléphone.
  Au démarrage, l'app s'assure que **mon** membre existe dans le foyer et est
  marqué (`assurerMoi`) — couvre aussi Marc & Mélanie aujourd'hui.
- `foyerParDefaut(profil)` : moi seul (plus de Marc + Mélanie codés en dur) — sauf
  compatibilité : un profil historique `marc`/`melanie` sans foyer enregistré garde ses
  deux adultes (sinon le prompt oublierait l'autre).
- Cycle d'exemple : `alex` → moi, `sam` → 1er autre adulte (sinon « Sam »),
  `lou`/`noa` → enfants du foyer (sinon « Lou »/« Noa »). Plus aucun prénom de
  la famille dans le code.
- Sync : le filtre pesées `marc|melanie` devient la garde de forme d'id.

## 1 bis. Suivi optionnel (décision 2026-10-07)

Rituel doit pouvoir n'être qu'une app de routine (menus, courses, rituel).

- Étape 1 : « Et toi, tu veux aussi… » (•) **Juste la routine** (défaut) /
  ( ) Suivre mon poids et un objectif. Réversible dans Profil.
- `UserProfile.suivi: boolean` (absent = `true` : les profils existants gardent
  leur suivi). Le membre du foyer porte le même drapeau (`Membre.suivi`).
- Sans suivi : pas d'étapes corps / objectif, **pas d'onglet Suivi** (barre à
  4 onglets), pas de macros exigées pour ce membre (le contrat les exige déjà
  seulement pour les membres suivis), portions adulte standard dans le prompt.
  Le **régime** (keto, végé…) reste demandé : il change les plats.
- Le/la partenaire saisi·e à l'étape 1 est non suivi·e tant qu'il/elle n'a pas
  rejoint avec son téléphone et choisi le suivi.

## 1 ter. Prompt IA : tout le foyer, rien d'inutile

Constat (2026-10-07) : le prompt ne détaille que le profil **du téléphone qui
le copie** ; le profil synchronisé du/de la partenaire est ignoré (la sync ne
garde que son propre profil) → Claude invente ses cibles.

- La sync garde en lecture seule les profils des autres membres
  (`sportapp:profils:foyer`, nouvelle clé) ; le prompt détaille chaque membre
  suivi (objectif, âge, dernier poids synchronisé, taille, compléments).
- `personnes` et `repasJour` (étape « Maison & courses ») ne servent à rien :
  le foyer donne déjà qui est à table, la semaine type donne les repas → retirés
  de l'onboarding (les valeurs stockées restent lisibles, ignorées).
- Test garde-fou : chaque réponse d'onboarding qui doit influencer les menus
  apparaît dans le prompt assemblé.

## 2. Onboarding (5 étapes, seule la 1re obligatoire)

```
Étape 1 — obligatoire              Étapes 2-5 — inchangées
Bienvenue sur Rituel 👋             (infos, objectif, perso, maison)
Comment tu t'appelles ?
[ Jean                      ]
Tu cuisines pour…
( ) Juste moi
(•) À deux   → Prénom de ton/ta partenaire (optionnel) [ Thérèse ]
( ) En famille → + partenaire (optionnel) + enfants [Léo] [+]
             [ Continuer › ]
● ○ ○ ○ ○
```

Le foyer local est créé dès l'étape 1 : moi (adulte, suivi, `telephone`),
le/la partenaire (adulte, suivi, sans téléphone), les enfants. L'étape
« Ta semaine » (rythme) suit comme aujourd'hui.

## 3. Fin d'onboarding : créer ou rejoindre un foyer

Remplace l'étape « Synchroniser les téléphones ».

```
Partager avec ton foyer                 ① Créer                         ② Rejoindre
Optionnel — menus, courses, coches      Votre code de foyer             Code de foyer
et pesées sur tous vos téléphones.      ┌──────────────────────┐        [ ••••••••••••       ]
                                        │ basilic-citron-3f9a… │        [ Rejoindre ]
[ Créer mon foyer ]                     └──────────────────────┘
[ Rejoindre un foyer ]                  [ Copier ] [ Partager ]          Es-tu Thérèse ?   (si besoin)
            Plus tard ›                 Donne-le à Thérèse : elle        (•) Oui, c'est moi
                                        choisira « Rejoindre un foyer » ( ) Non, ajoute-moi
                                        à la fin de son inscription.     [ Valider ]
                                        Retrouvable dans Profil › Foyer
                                        tant que ce téléphone le garde.
                                        [ C'est noté › ]
```

- **Créer** : le foyer local (étape 1 + semaine) part sur le serveur ; le
  code s'affiche et reste consultable dans Profil › Foyer **sur ce téléphone**
  (stocké en local, jamais en clair côté serveur) — fin du « code perdu ».
- **Rejoindre** : c'est le foyer du serveur qui gagne (réglages, cycle,
  coches) ; le foyer provisoire du nouveau téléphone n'est **pas** poussé (il
  écraserait celui de Jean). Seuls son profil et ses pesées partent.
- **Rattachement** (fonction pure `rattacher(foyer, profil)`) :
  1. un adulte sans téléphone porte le même prénom (casse/accents ignorés) →
     c'est moi, sans question ;
  2. sinon, s'il reste des adultes sans téléphone → « Es-tu X ? » (liste +
     « Non, ajoute-moi ») ;
  3. sinon → ajouté comme nouvel adulte suivi.
  Être X = le profil de ce téléphone prend l'id de X (repas, macros, pesées).
- Même parcours depuis Profil › Foyer pour un téléphone déjà inscrit.
- Ma semaine type › Le foyer : un adulte **sans téléphone** peut être retiré
  (doublon), jamais soi-même.

## 4. Page Objectif

Une page, un bouton « Enregistrer » collé en bas (remplace les 3).

```
‹ Profil
Objectif
┌──────────────────────────────┐   résumé : dernière pesée → poids visé,
│ 82,4 kg  →  75 kg            │   écart, « ≈ 0,6 kg / semaine » si échéance ;
│ −7,4 kg · d'ici le 31 déc.   │   sans pesée : « Pèse-toi dans Suivi pour
│ ≈ 0,6 kg / semaine           │   voir l'écart »
└──────────────────────────────┘
Ton cap            cartes radio : icône + nom + description (OBJECTIF_TYPES)
Poids visé [75] kg · Échéance [31/12/2026]
Régime             chips radio
Compléments        chips à cocher : presets + ajoutés ; « + Autre… »
[        Enregistrer         ]
```

Rythme > 1 kg/semaine → alerte douce « Rythme ambitieux », non bloquante.

## 5. Hors périmètre

Pas de changement serveur. Pas de comptes / e-mail. Pas d'import des données
de l'ancienne adresse github.io.

## 6. Plan (PRs)

1. Correctifs §0 (texte, 401 → hors foyer, date du cycle, écran allumé, installer).
2. Page Objectif (§4).
3. Identité ouverte (§1) + suivi optionnel (§1 bis) : `ProfileKey` chaîne,
   `telephone`, `assurerMoi`, `suivi`, foyer par défaut, cycle d'exemple, sync,
   onglet Suivi conditionnel.
4. Onboarding étape 1 + créer/rejoindre + rattachement (§2-3).
5. Prompt IA de tout le foyer (§1 ter).

Chaque PR : tests d'abord, `npm test && typecheck && lint && build` + e2e 320/375.
