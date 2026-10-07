# Refonte v2 — navigation par moment, cycle JSON généré par IA — design

**Date :** 2026-10-07 · **Statut :** validé en brainstorming + maquettes (canevas « Rituel — Refonte v2 », 11 écrans) · **Version cible :** 2.0.0 (majeure : contrat et stockage cassants)

Annexe : [`2026-10-07-refonte-v2-prompt.md`](2026-10-07-refonte-v2-prompt.md) — brouillon du prompt maître.

## 1. Contexte et objectif

Retours d'usage sur la v1.x :

- **Trop de taps** : 3 barres de navigation empilées (bannière, segmented Cuisine/Suivi, sous-onglets Courses/Menu/Rituel), navigation en haut, hors du pouce ; aucun écran « maintenant ».
- **Pas assez de détail** dans les recettes et le batch.
- **Génération du cycle laborieuse** : 4 fichiers `.md` à faire produire puis importer, contrat texte fragile.
- **Rigidité** : rien n'est prévu quand un repas ne se fait pas.

Objectifs : organiser l'app par **moment d'usage**, des fiches recette et un rituel **complets**, un cycle de 4 menus **généré par Claude** au format JSON (contrat validable), et de la **flexibilité** (reporter un repas, mettre le cycle en pause) — sans casser la routine : un seul cycle de 4 semaines (menus A → D) à la fois.

Inchangé : PWA offline-first, données d'abord sur le téléphone, sync VPS optionnelle, thème clair Herbes, pas de nouvelle dépendance.

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Navigation | **Barre du bas, 5 onglets** : Aujourd'hui · Menu · Courses · Rituel · Suivi. Profil via l'avatar en haut à droite. Swipe supprimé. |
| Écran d'accueil | **Aujourd'hui** : repas du jour, une carte « prochaine action », progression de la semaine, mon jour. |
| Fiche recette | **Écran plein** (poussé), ouverte sur le profil actif, bascule Marc/Mélanie. |
| Contrat du cycle | **JSON** (remplace le `.md`), schéma §5, validé à l'import. |
| Génération | **Option A — abonnement Claude** : l'app copie le prompt → claude.ai → fichier(s) `.json` → import. 0 € d'API. Option B (bouton + API via le VPS) reportée, réutilisera prompt et schéma. |
| Données existantes | **On repart de zéro** pour la cuisine : semaines `.md` et leurs coches supprimées (§7). Profils, pesées, dépenses et sync conservés. |
| Champs recette | Ingrédients (quantité + unité) et portions par personne · difficulté · conservation et réchauffage · version par membre (keto de Mél) · macros par portion et par profil suivi. Pas de matériel, pas d'astuces, pas de substitutions, pas d'image. |
| Rituel | **Un seul rituel batch pour tout le cycle** : les 4 semaines refont le même geste du dimanche (mêmes étapes, même production, même « avant de commencer »). C'est lui qu'on apprend à maîtriser ; ce sont les **dîners** qui changent d'un menu à l'autre et qui s'appuient sur ce que le batch produit. Seuls de petits rappels propres au menu (« sortir le colin du congélateur ») varient. |
| Cycle | **Un seul à la fois**, verrouillé jusqu'à sa **date de fin**. À la fin : **relancer le même cycle** (recommandé) ou nouveau cycle. **Pause** d'une semaine possible. |
| Rythme | La semaine du cycle démarre le **jour des courses** (réglage foyer, samedi par défaut) ; le rituel suit (dimanche par défaut). |
| Report | 3 niveaux : reporter un repas (demain / semaine prochaine / abandon), « reporté de la semaine dernière », pause du cycle. Déjeuners **et** dîners reportables. Ingrédients d'un plat reporté : **barrés « déjà au frigo ? »** dans la liste suivante, confirmés d'un tap. |
| Foyer | Membres : Marc, Mélanie (adultes suivis) + Maëlle, Maxine (enfants, **sans âge**, pas de suivi, portions seulement). |
| Semaine type | Réglage foyer : jour par jour, déjeuner box/maison par adulte, filles dehors/maison, type de dîner, qui dîne plus tard, journée sportive de Marc, note ; exceptions récurrentes (1er et 3e vendredis : resto). |
| Budget | Plafond hebdo **pour tout le foyer** (extras keto et éléments fixes compris). C'est une **cible, pas une contrainte dure** : les prix restent réalistes (essai réel : ~100-125 €/sem chez Lidl pour 4 personnes) et l'app **alerte** quand l'estimé dépasse le plafond (§6.2, §9). Prix estimé par ingrédient dans le JSON ; carte Estimé / Payé / Max. |
| Suivi | Contenu actuel conservé (poids, séances, cibles, rappels) ; tour de taille, notes énergie/sommeil, tests : **reportés**. |
| Données personnelles | Aucun document personnel (plans diet/keto, planning) dans le dépôt : tout passe par le profil stocké sur le téléphone et assemblé dans le prompt. |

## 3. Navigation et écrans

Référence visuelle : canevas « Rituel — Refonte v2 » (artboards numérotés ci-dessous).

```
┌───────────────────────────┐
│ Titre de l'écran    (M)●  │  en-tête fin : avatar 48 px + point de sync
├───────────────────────────┤
│ ‹ Sem. 3 · Menu C ›       │  ligne semaine (Menu, Courses, Rituel uniquement)
│         contenu           │
├───────────────────────────┤
│ Auj. Menu Courses Rituel Suivi │  barre du bas 56 px, safe-area
└───────────────────────────┘
```

| # | Écran | Contenu |
|---|---|---|
| 1 | **Aujourd'hui** | Salut + date ; carte semaine (repas x/14, courses, séances) ; carte **prochaine action** (rituel le jour du rituel, courses le jour des courses, « reporté » s'il y en a, pesée un jour de pesée) ; repas du jour cochables (1 tap) ; « mon jour » (type de journée, kcal cible, ce qui attend dans la réserve). |
| 2 | **Menu** | Bande 7 jours (ordre = à partir du jour des courses, point de progression) ; pour le jour : déjeuner(s) du profil actif, dîner famille + ligne « Mél : … », « ce soir j'anticipe » (micro-batch) ; bloc « reporté » en tête si besoin. |
| 3 | **Recette** (poussé) | Retour ‹ ; zone photo neutre (pas d'image) ; titre, moment, difficulté, temps ; macros par portion (profil actif) ; **Ma portion** (bascule membres suivis) + version du membre ; ingrédients **pour le foyer** cochables (mise en place) ; étapes numérotées cochables + **minuteur** si durée ; conservation & réchauffage ; carte « lié au rituel » ; pied : Mode cuisine · C'est fait. |
| 4 | **Courses** | Carte Estimé / Payé / Max + détail (extras keto, fixes) + progression ; **mode magasin** (masque le coché) ; « J'ai payé… » (saisie ticket inline) ; rayons ; badge « rituel » ; encadré keto en dernier ; lignes « déjà au frigo ? » (§9). |
| 5 | **Rituel** | 3 onglets internes : **Dimanche** (résumé production + lancer, « avant de commencer » replié, déroulé 1 ligne/étape dépliable) · **En semaine** (micro-batch) · **Réserve** (au frigo / mangée). |
| 6 | **Mode guidé** | Plein écran, écran maintenu allumé (Wake Lock si dispo) ; 1 étape/écran, sous-étapes cochables (étapes de la recette liée), minuteur, « en parallèle », fiche liée ; écran de fin. |
| 7 | **Suivi** | Inchangé fonctionnellement, mis au gabarit (poids + courbe + saisie, séances, cibles, rappels). |
| 8 | **Mon cycle** | En cours (A–D + état, cadenas « prochain cycle le … », pause 1 semaine) ; terminé (relancer / nouveau) ; génération en 3 étapes ; aperçu + alertes + date de début ; confirmation. |
| 9 | **Report** | Bouton « Pas ce soir : reporter » sous un repas → feuille (demain / semaine prochaine / on ne le fera pas) + toast Annuler. |
| 10 | **Semaine type** | Foyer, rythme (courses, rituel), 7 jours dépliables, exceptions récurrentes. |
| 11 | **Profil** | Carte compte (sync) ; *Le foyer* : Mon cycle, Ma semaine type, Courses & budget ; *Moi* : Objectif & régime, Mes infos ; Changer de profil. |

Onboarding : les 5 étapes actuelles restent (seule l'étape 1 obligatoire) ; ajout d'une étape optionnelle **« Ta semaine »** (rythme + semaine type, préremplie par défaut, « Passer »). Sans cycle, l'app charge le **cycle d'exemple** (fallback en mémoire, comme la semaine d'exemple aujourd'hui).

Règles UI inchangées : cibles ≥ 48 px, contraste ≥ 4,5:1, zéro scroll horizontal à 320/375 px, citron jamais en texte, icônes SVG.

## 4. Modèle de données — foyer et profil

### 4.1 Réglages du foyer (partagés entre les téléphones)

```ts
type MembreId = string; // slug stable : 'marc', 'melanie', 'maelle', 'maxine'
interface Membre {
  id: MembreId;
  prenom: string;
  type: 'adulte' | 'enfant';
  suivi: boolean;          // a un profil (poids, séances, macros)
  regime?: Regime;         // ex. 'keto' — pilote les variantes
}
type Jour = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';
interface JourType {
  dejeuner: Record<MembreId, 'box' | 'maison' | 'dehors'>; // adultes : box|maison ; enfants : dehors|maison
  diner: 'famille' | 'rapide' | 'leger';
  plusTard: MembreId[];    // dînent décalé (portion réchauffée)
  journee?: Record<MembreId, 'standard' | 'sortie' | 'repos' | 'alternee'>; // membres sportifs
  note?: string;
}
interface Exception { regle: string; effet: string; actif: boolean } // ex. « 1er et 3e vendredis » / « resto à deux : dîner simple filles »
interface ReglagesFoyer {
  version: 3;
  membres: Membre[];
  jourCourses: Jour;       // défaut 'samedi'
  jourRituel: Jour;        // défaut lendemain des courses
  semaine: Record<Jour, JourType>;
  exceptions: Exception[];
  magasin?: string;
  budgetMax?: number;      // € / semaine, foyer entier
}
```

`magasin` et `budgetMax` remontent du profil vers le foyer (une seule liste de courses). Valeurs par défaut quand rien n'est saisi : 2 adultes, tous les déjeuners « maison », dîner « famille », courses samedi, rituel dimanche.

### 4.2 Profil (v3, par personne suivie)

Le profil v2.2 est conservé tel quel (prénom, date de naissance, taille, poids objectif, objectif, compléments, régime, préférences) **moins** `magasin`, `budgetMax`, `personnes`, `repasJour` (remontés ou remplacés par le foyer). Migration v2.2 → v3 silencieuse à la lecture : les champs déplacés alimentent `ReglagesFoyer` s'il n'existe pas encore.

## 5. Contrat du cycle (JSON, version 2)

Principe : le JSON décrit **4 menus sans dates**. Les dates sont calculées par l'app à partir du début du cycle et du jour des courses — c'est ce qui rend la **relance** gratuite et la **pause** triviale.

```ts
interface CycleFichier {
  format: 'rituel-cycle';
  version: 2;
  titre: string;                       // « Automne — poulet, poisson, soupes »
  menus: MenuSemaine[];                // 1 à 4 (import multi-fichiers, §6)
  recettes: Recette[];                 // toutes celles référencées par les menus
  rituel: Rituel;                      // UN rituel commun aux 4 menus (dans menu-A.json)
  fixes?: ArticleFixe[];               // ce qui revient chaque semaine
  remarques?: string[];                // signalements de Claude (« budget réaliste ≈ 100 € > plafond 80 € »), affichés dans l'aperçu
}

interface MenuSemaine {
  lettre: 'A' | 'B' | 'C' | 'D';
  titre: string;
  jours: JourMenu[];                   // 7 entrées, une par Jour
  rappelsRituel?: string[];            // petits ajouts du menu au rituel commun (« colin congélateur → frigo »), affichés en tête du mode guidé
  microBatch: MicroBatch[];
  reserve: Reserve[];
}

interface JourMenu {
  jour: Jour;
  repas: Repas[];
}
interface Repas {
  id: string;                          // stable dans le menu : '{jour}-{moment}-{pour}', ex. 'mardi-dejeuner-melanie'
  moment: 'dejeuner' | 'diner' | 'collation';
  pour: MembreId[] | 'famille';
  recette?: string;                    // id de Recette
  texte?: string;                      // si pas de recette (« Restes du dîner », « Resto à deux »)
  boite?: { produitePar: string; frigoJours: number }; // id d'étape rituel, id de micro-batch ou id de recette
  exception?: { quand: string; pour: MembreId[]; texte: string }; // alternative conditionnelle (« 1er et 3e vendredis » → repas des enfants) : affichée en option sous le repas, hors compteurs, non reportable
}

interface Recette {
  id: string;                          // slug, ex. 'r7-roti-dinde-gratin'
  nom: string;
  difficulte: 'facile' | 'moyen' | 'exigeant';
  tempsMin: number;                    // total
  tempsActifMin?: number;
  ingredients: Ingredient[];           // pour TOUT le foyer présent à ce repas
  portions: Record<MembreId, string>;  // mesures maison (« 1 paume de dinde + 1 poignée de quinoa »)
  variantes?: Record<MembreId, string>; // ex. melanie : « sans quinoa, + beurre sur les courgettes »
  macros: Record<MembreId, Macros>;    // membres suivis uniquement, par portion
  etapes: Etape[];
  conservation: { frigoJours: number; congelable: boolean; rechauffage: string };
  notes?: string[];                    // conseils libres (« la 2e portion fait la box de jeudi ») — jamais dans variantes
}
interface Ingredient {
  nom: string;                         // « Courgettes »
  quantite: number;
  unite: 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'cs' | 'cc' | 'boite' | 'sachet' | 'botte';
  rayon: Rayon;
  prixEstime: number;                  // € pour cette quantité, magasin du foyer
  placard?: boolean;                   // huile, épices, sel, moutarde… : liste « à vérifier au placard », hors estimé
  fraisJours?: number;                 // durée de vie après achat (produit frais)
}
type Rayon = 'proteines' | 'laitiers' | 'feculents' | 'legumes' | 'fruits' | 'epicerie' | 'surgeles' | 'keto';
interface Etape { texte: string; minuteurMin?: number }
interface Macros { kcal: number; proteines: number; glucides: number; lipides: number }

interface Rituel {
  dureeMin: number;
  production: string[];               // « 2 boîtes frigo », « 1 boîte congélateur », …
  avantDeCommencer: { nom: string; quantite: string }[];
  etapes: { id: string; creneau: string; label: string; detail: string; recette?: string; sousEtapes?: string[]; enParallele?: string; minuteurMin?: number }[];
  termine: string;
}
interface MicroBatch { id: string; jour: Jour; quoi: string; dureeMin: number; quantite?: string; recette?: string; detail?: string }
interface Reserve { pour: Jour | MembreId; plat: string; conservation: string; produitPar?: string }
interface ArticleFixe { nom: string; quantite: number; unite: Ingredient['unite']; rayon: Rayon; prixEstime: number; pour: MembreId[] | 'famille'; frequence: 'hebdo' | 'mensuel' }
```

Notes :

- **Ids de coches stables** (contrat) : `repas:{lettre}:{repas.id}`, `courses:{lettre}:{rayon}:{slug(nom)}`, `rituel:{lettre}:{etape.id}`, `micro:{lettre}:{jour}`, `reserve:{lettre}:{slug(plat)}`, `etape:{recette.id}:{n}`, `mise:{recette.id}:{n}`. Les coches sont stockées **par semaine du cycle** (§7) : relancer le cycle repart de coches vides.
- Liste de courses **calculée** (§9) — le JSON ne contient pas de liste, d'où la cohérence garantie avec le menu.
- `variantes` = uniquement ce que le membre mange **à la place**, et seulement pour une recette partagée ; les conseils vont dans `notes` (constat de l'essai réel : `variantes.marc` détourné en notes, « Recette keto » sur des recettes mangées par Mél seule).
- `fixes` couvre les éléments récurrents (skyr, whey mensuelle, extras keto de Mél…) : ils vont dans les courses et le budget sans être régénérés.

## 6. Génération (option A) et import

### 6.1 Parcours (écran Mon cycle)

1. **Copier le prompt** — `src/lib/promptIa.ts` assemble le prompt maître (annexe) : profils suivis, foyer, semaine type, exceptions, rythme, budget, magasin, préférences, recettes du cycle précédent (à éviter), schéma JSON inline, règles dures, auto-contrôle.
2. **Ouvrir Claude** (lien `https://claude.ai/new`) — l'utilisateur colle, Claude produit **un fichier par menu** (`menu-A.json` … `menu-D.json`). Découpage voulu : une réponse de 4 menus détaillés risque d'être tronquée dans un chat ; 4 fichiers moyens passent.
3. **Importer** — sélection d'un ou plusieurs fichiers (`<input type="file" multiple accept="application/json,.json">`) ; les fichiers sont fusionnés (menus par lettre, recettes dédupliquées par id — un même id doit être identique, sinon erreur).

### 6.2 Validation (`src/lib/cycle/valider.ts`, pure, testée)

Erreurs **bloquantes** (l'aperçu n'autorise pas « Démarrer ») :

- `rituel` absent après fusion, ou présent dans plusieurs fichiers avec un contenu différent ;

- JSON illisible, `format`/`version` absents ou inconnus, champ requis manquant, type invalide, unité ou rayon hors liste ;
- menus manquants ou en double (il faut A, B, C, D) ; un menu sans ses 7 jours ;
- référence cassée (repas → recette, boîte → producteur, étape rituel → recette) ;
- membre inconnu dans `pour`, `portions`, `variantes`, `macros` ;
- un dîner « famille » sans `variantes[m]` pour un membre au régime spécifique ;
- un membre suivi sans `macros`.

Alertes **non bloquantes** (affichées dans l'aperçu, citron) :

- budget estimé d'un menu (ingrédients + fixes hebdo) > `budgetMax` — l'alerte propose 3 actions : *Garder* · *Ajuster mon budget à {estimé arrondi}* (1 tap) · *Demander une version éco à Claude* (copie un prompt de correction) ;
- `remarques` de Claude, affichées telles quelles ;
- **variété** : un menu qui a moins de 5 dîners propres déclenche l'alerte « Menu D : seulement 4 dîners propres » (essai réel : le menu D n'avait aucun dîner propre) — reprendre un dîner dans 2 menus reste permis ;
- glucides estimés d'un jour > seuil du régime keto (somme des macros de Mél sur la journée) ;
- recette reprise du cycle précédent ;
- repas incohérent avec la semaine type (box prévue un jour « maison », dîner manquant un jour « famille »).

Bouton **« Copier les erreurs pour Claude »** : texte prêt à recoller dans la même conversation pour corriger.

### 6.3 Option B (plus tard, hors périmètre)

Endpoint VPS qui appelle l'API Claude avec le **même prompt et le même schéma** (sortie structurée JSON) ; coût estimé ~1-1,5 $/cycle, facturé à part de l'abonnement. Aucune décision à prendre maintenant.

## 7. État du cycle, calendrier, stockage

```ts
interface CycleActif {
  id: string;                 // uuid généré à l'import
  numero: number;             // 1, 2, … (affiché « Cycle N »)
  debut: string;              // AAAA-MM-JJ = jour de courses de la semaine 1
  pauses: number[];           // index de semaine (0-3) APRÈS lesquels une semaine de pause est insérée
  fichier: CycleFichier;
  relanceDe?: string;         // id du cycle relancé
}
```

- **Semaine courante** = `floor((aujourd'hui − debut) / 7)` moins les semaines de pause écoulées ; pendant une pause, l'app affiche « Semaine de pause » (Menu/Courses vides, Aujourd'hui le dit).
- **Fin** = `debut + 28 j + 7 j × pauses.length`. Avant : génération et relance **verrouillées**. Après : « Relancer » (nouveau `CycleActif`, même `fichier`, `numero + 1`, début = prochain jour de courses) ou « Nouveau ».
- **Début** proposé : prochain jour de courses (ou aujourd'hui).
- **Lettre** de la semaine n = `A,B,C,D[n]`.

Clés `localStorage` (préfixe historique conservé) :

| Clé | Contenu |
|---|---|
| `sportapp:foyer` | `ReglagesFoyer` |
| `sportapp:profile` | profil v3 (§4.2) |
| `sportapp:cycle` | `CycleActif` |
| `sportapp:cycle:precedent` | titres/ids de recettes du cycle précédent (pour le prompt) |
| `sportapp:coches:{cycleId}:{n}` | coches de la semaine n du cycle |
| `sportapp:reports:{cycleId}` | reports (§8) |
| `sportapp:weights:*`, `sportapp:depenses`, `sportapp:sync:*` | inchangées |

**Remise à zéro (v2.0.0)** : au premier lancement de la 2.0, suppression de `sportapp:week`, `sportapp:weeks`, `sportapp:checks:*`, `sportapp:selection` (une fois, drapeau `sportapp:v2`). Profil, pesées, dépenses, sync intacts.

**Sync** : la table serveur `weeks` est abandonnée ; ajout d'une table générique `etat` (`foyer_id, cle, payload, updated_at`, PK `(foyer_id, cle)`, last-write-wins) pour `foyer`, `cycle`, `reports:{cycleId}` ; `checks` réutilisée avec `semaine = {cycleId}:{n}`. Les shapes passent par l'outbox existante (`empilerMutation`).

## 8. Report et pause

```ts
interface Report {
  repas: string;              // id de coche du repas d'origine (stable)
  vers: { semaine: number; jour: Jour } | 'abandon';
  cree: string;               // ISO
}
```

- **Reporter** (feuille sous un repas) : *Demain* (si le lendemain a déjà un plat du même moment, celui-ci passe en « reporté ») · *Semaine prochaine* · *On ne le fera pas*. Toast « Annuler » 5 s.
- **Fin de semaine** : tout repas non coché, non reporté, non abandonné devient « reporté de la semaine dernière » (encadré en tête de Menu/Aujourd'hui : *Ce soir* · *Un autre jour* · *On ne le fera pas*).
- **Avertissement fraîcheur** : un ingrédient avec `fraisJours` dont la date d'achat (jour des courses) + `fraisJours` est dépassée à la date cible → message (« Poulet frais : à congeler ce soir »).
- **Courses** : les ingrédients des plats reportés vers la semaine n apparaissent dans la liste de la semaine n **barrés « déjà au frigo ? »** ; un tap les remet dans la liste (si le produit n'est plus bon).
- **Pause** (écran Mon cycle) : insère une semaine vide après la semaine courante ; annulable tant qu'elle n'a pas commencé.
- Les ids de coche ne changent jamais : un report n'est qu'une redirection.

## 9. Courses et budget

- **Calcul** (`src/lib/cycle/courses.ts`, pur) : somme des `ingredients` des recettes **distinctes** de la semaine — référencées par un repas (non abandonné, hors `exception`), une étape du rituel ou un micro-batch (ex. les egg muffins ne sont portés que par le rituel) ; une recette servie plusieurs fois (restes, box) n'est comptée qu'**une** fois ; reports entrants inclus en « déjà au frigo ? » — + `fixes` hebdo (+ mensuels la 1re semaine), agrégés par `(slug(nom), unité)`, conversions g↔kg / ml↔l, groupés par rayon (keto en dernier), arrondis lisibles.
- **Estimé** = somme des `prixEstime` ; détail « dont extras keto (rayon keto + fixes de Mél) · fixes ».
- **Payé** = dépenses réelles de la semaine (`sportapp:depenses`, inchangé) ; **Max** = `budgetMax` du foyer. Estimé ou payé > max → valeur en alerte (`--danger`) + phrase « ≈ X € au-dessus de ton plafond ». Les fixes **mensuels** sont lissés sur 4 semaines dans l'estimé (pas de pic en semaine 1).
- Profil › Courses & budget : sous le champ plafond, rappel « Estimation réaliste de ton dernier cycle : ≈ X €/sem ».
- Badge « rituel » sur les ingrédients des recettes liées au rituel.

## 10. Lazy loading et performance

- `React.lazy` + `Suspense` par onglet hors Aujourd'hui (Menu, Courses, Rituel, Suivi), et pour les écrans poussés (Recette, Mode guidé, Mon cycle, Semaine type, Profil, Onboarding) ; le graphe de poids reste dans le chunk Suivi.
- Le cycle d'exemple (JSON) est chargé à la demande (`import()`), seulement sans cycle actif.
- Mesure du bundle avant/après dans la PR shell (budget : chunk initial ≤ celui de la 1.3).
- Wake Lock API dans le mode guidé (dégradation silencieuse si absente).

## 11. Hors périmètre

Génération par API (option B) ; matériel, astuces, substitutions, images de recettes ; tour de taille, énergie/sommeil, tests sportifs ; âge des enfants ; planification multi-cycles ; inventaire du frigo au-delà de « déjà au frigo ? ».

## 12. Plan de livraison

Le changement de contrat rend les étapes intermédiaires incohérentes pour l'utilisateur : on travaille sur une **branche d'intégration** (la branche de session `claude/confident-meitner-thvbh6`, qui porte déjà la spec), chaque PR ci-dessous cible cette branche (CI verte à chaque PR), puis **une PR finale branche d'intégration → `main`** déclenche la 2.0.0.

| PR | Contenu | Tests |
|---|---|---|
| 1 | `src/lib/cycle/` : types, `valider.ts`, fusion multi-fichiers, cycle d'exemple JSON | unitaires (cas valides, chaque erreur/alerte) |
| 2 | `src/lib/cycle/calendrier.ts` (semaine courante, fin, pauses, ordre des jours) + `courses.ts` (agrégation, budget) | unitaires (horloge mockée) |
| 3 | Storage v3 : foyer, profil v3 + migration, cycle, coches, reports, remise à zéro, table sync `etat` (client + serveur) | unitaires + `server/test` |
| 4 | Shell : barre du bas, en-tête, ligne semaine, Profil hub, lazy loading, suppression swipe | composants + e2e 320/375 |
| 5 | Aujourd'hui + Menu + Recette (écran plein, minuteurs, portions/variantes) | composants + e2e |
| 6 | Courses (calcul, carte budget, mode magasin, « déjà au frigo ? ») | composants + e2e |
| 7 | Rituel 3 onglets + mode guidé (sous-étapes, minuteur, Wake Lock) | composants + e2e |
| 8 | Mon cycle : verrou, relance, pause, import + aperçu + alertes + copier les erreurs ; prompt maître (`promptIa.ts` + template) | unitaires prompt + composants + e2e |
| 9 | Report de repas (feuille, toast, reporté de la semaine dernière, fraîcheur) | unitaires + composants |
| 10 | Semaine type + étape d'onboarding « Ta semaine » | composants + e2e |
| 11 | Nettoyage : retrait `parse.ts`/`.md`, `semaine-exemple.md`, `docs/templates/` ; AGENTS.md, README, `ai/context/*`, CHANGELOG 2.0.0 | suite complète |

Chaque PR : TDD, `npm test && npm run typecheck && npm run lint && npm run build`, `npm run e2e` dès qu'elle touche l'UI.

## 13. Points ouverts (ajustés au fil des PR)

1. ~~Budget~~ — tranché après l'essai réel : plafond foyer entier, cible souple + alertes (§2).
2. **Taille des fichiers** : essai réel (menu A) ≈ 50 Ko de JSON indenté, une réponse suffit — à reconfirmer sur B-D.
3. **Seuil keto** : 30 g de glucides nets/jour tiré du régime « keto » ; le rendre réglable dans Objectif & régime si besoin.
