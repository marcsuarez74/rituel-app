# App native — plan (2026-10-16)

Spec : `docs/superpowers/specs/2026-10-14-refonte-native-from-scratch.md`. Maquettes :
`docs/superpowers/mockups/2026-10-14-app-native/`. Règles : `docs/conservation.md`, `docs/cgu.md`.
TDD à chaque étape ; une étape d'app = un écran fonctionnel, conforme à sa maquette.

## Décisions (2026-10-16)

- **Deux dépôts.** L'app vit dans un **nouveau dépôt** (nom proposé : `rituel-native`) ; la
  logique utile de ce dépôt y est **recopiée avec ses tests**, pas partagée. Le backend reste ici.
- **Backend : routes `/v2` dans `server/`**, même conteneur, même déploiement. Tables préfixées
  `v2_`, aucune jointure avec les tables de la PWA : la PWA en prod n'est pas touchée.
- **APK : EAS Build** (cloud Expo, profil `preview` → `.apk`), installé à la main. Play Store plus tard.
- **IA : Claude (Anthropic)**, une seule clé pour la génération et la vision. SDK
  `@anthropic-ai/sdk` ; modèle `claude-opus-5-5` par défaut, lu dans une variable
  d'environnement (`IA_MODELE`) pour pouvoir en changer sans code. Un modèle moins cher
  (`claude-sonnet-5-5`, `claude-haiku-5-5` pour la vision) ne s'adopte qu'après la batterie de
  profils (étape 9) et l'accord de Marc.
- **Contrat menu.** Source de vérité : `server/src/v2/contrat.ts` (types + schéma). L'app en garde
  une copie ; chaque réponse porte `contrat: <n>` et l'app refuse un numéro inconnu (« mets à
  jour l'app ») au lieu de mal lire.
- **Données de la PWA** : ni lues ni migrées (spec §2.2).

## A. Backend `/v2` (dans ce dépôt, `server/`)

1. [x] Squelette : `server/src/v2/` (routeur Hono monté sous `/v2`), tables `v2_*` dans `db.ts`,
   tests `server/test/v2-*.test.ts`. `/sante` inchangé.
2. [x] **Foyer à code de 6 caractères** : alphabet sans caractères ambigus (pas de `0/O`, `1/I/L`) ;
   code stocké en **HMAC-SHA256 avec un secret dérivé de `JWT_SECRET`** (colonne indexée, recherche directe — le
   schéma PBKDF2 actuel, qui parcourt tous les foyers et exige 12 caractères, ne convient pas).
   Routes : `POST /v2/foyers` (crée, rend le code), `POST /v2/foyers/rejoindre`,
   `POST /v2/foyers/code` (réinitialise : l'ancien code cesse de marcher, les appareils déjà
   connectés restent connectés), `DELETE /v2/foyers/moi` (le dernier appareil emporte le foyer).
   Jeton d'appareil (JWT existant, signé avec un secret v2 dérivé : un jeton de la PWA ne passe
   pas, ni l'inverse ; table `v2_appareils`). **Rate-limit fort** sur `rejoindre` (par IP et global) : 6 caractères se
   devinent si on laisse essayer. Tests : collision de code, code réinitialisé refusé, rate-limit.
3. [x] **État partagé** : une ligne par entité (`v2_entites` : foyer, type, id, version, données
   JSON, `modifie_le`, supprimé, `rev`). `POST /v2/sync` (pousse un lot, tout ou rien : 500 entités,
   512 Ko chacune, 8 Mo au total) et `GET /v2/sync?depuis=<rev>` (tire), « dernière écriture gagne »
   par entité (une écriture plus ancienne est ignorée et renvoyée dans `ignorees`). Pas de SSE en v1 (peu fiable en React Native) : l'app
   tire à l'ouverture, au retour au premier plan et en tirant l'écran vers le bas.
4. [x] **Acceptation des CGU** : `v2_acceptations` (appareil, version, date serveur) ; `GET /v2/cgu`
   (version en vigueur, `VERSION_CGU` dans `server/src/v2/cgu.ts`) et `POST /v2/cgu/acceptation`
   (409 si la version envoyée est périmée) ; enregistrée à la dernière étape du guide et à l'arrivée
   dans un foyer ; la génération la vérifiera (`cguAcceptees`, étape 7).
5. [x] **Table d'ingrédients** : `server/src/v2/ingredients.ts` + `donnees/ingredients.ts`
   (213 ingrédients) : id, nom, famille, allergènes (14 allergènes réglementaires), glucides,
   catégorie de conservation (`server/src/v2/conservation.ts`, reprise de `docs/conservation.md`),
   prix moyen estimé, unité, rayon. Régimes **déduits** de ces faits (`regimesCompatibles`) ;
   flexitarien et méditerranéen restent des préférences du prompt. Ids publiés figés
   (`donnees/ingredients-ids.ts`). Reste pour l'étape 6 : casher au niveau du plat (pas de viande
   avec du laitier). Tests de cohérence de la table.
6. [x] **Validateur de menus** (`server/src/v2/valider.ts`, TDD sur des sorties figées, cœur
   de la sécurité, spec §10.2.3). Contrat posé dans `contrat.ts` : une semaine commence le jour
   du Rituel (`jours[0]` = J0) ; 5 types de repas (`box`, `pret`, `frais`, `dehors`, `libre` —
   le « Rituel » de la maquette Menus n'est qu'un `pret` servi à J0) ; ingrédients par id, quantité
   pour un adulte (g, ml ou pièces), `cru` pour la conservation ; profil du foyer avec la trame du
   compromis, les 14 allergènes **en plus** des 7 « à éviter » du guide (décidé le 2026-10-16 ;
   l'ajout au guide passera par une maquette). Contrôles : ingrédient hors table, conservation
   (crudités J+2 non congelables, œufs/viande/poisson crus exclus du Rituel), régimes, casher au
   niveau du plat, allergènes, « à éviter », durée du Rituel avec cuissons en parallèle (fin de la
   dernière étape ou du dernier minuteur), temps du soir, budget (**coût estimé ≤ 85 % du budget
   ramené à la semaine**, enfant = 0,6 portion — décidé le 2026-10-16), quantités par famille,
   variété (id et titre normalisé uniques sur 4 semaines, recette fraîche servie une fois),
   structure (trame, origine des recettes, étapes du Rituel). Chaque erreur nomme le plat et le
   jour réel.
7. [x] **Génération** `POST /v2/menus/generer` (connexion requise, quota par foyer —
   `v2_generations`, plafond à fixer après mesure du coût) :
   - prompt : partie fixe (règles + table d'ingrédients) en tête avec `cache_control` (prompt
     caching, préfixe identique d'un appel à l'autre — rien de variable dedans) ; profil du foyer
     ensuite, champs libres bornés en longueur et passés **comme données** (bloc balisé) ;
   - **sortie structurée** : `client.messages.parse()` + `output_config.format` (schéma JSON, via
     `zodOutputFormat` — zod devient une dépendance de `server/`). Limites du schéma : tout objet
     en `additionalProperties: false`, pas de schéma récursif, pas de `minimum`/`maximum` ni
     `minLength`/`maxLength` (le SDK les retire et les vérifie côté client) — sans enjeu, le
     validateur (étape 6) reste le vrai verrou ;
   - appel en **streaming** (`finalMessage()`), `max_tokens` large (4 semaines = sortie longue) ;
     effort fixé explicitement (`output_config.effort`, défaut `medium` sur Opus 5.5 — à mesurer) ;
   - repli serveur en cas de refus du modèle (`fallbacks: "default"`, bêta
     `server-side-fallback-2026-07-01`) ; `stop_reason` `refusal` ou `max_tokens` = échec traité,
     jamais un menu partiel ;
   - **boucle de correction** : erreurs du validateur renvoyées (2 essais au plus), puis
     regénération du seul plat fautif, puis plat de la bibliothèque. Un menu non conforme n'est
     jamais renvoyé. Tests avec un client Claude simulé (sorties figées bonnes et fautives).
   - **Livré (2026-10-16)** : `v2/generer.ts` (boucle), `v2/prompt.ts`, `v2/schema.ts`,
     `v2/ia.ts` (seul fichier qui parle à l'API). Écarts au plan : pas de `.parse()` du SDK (il
     lève sur une sortie invalide avant qu'on lise `stop_reason`) — schéma JSON tiré de
     `betaZodOutputFormat`, lecture par `JSON.parse` + zod ; le helper ramène aussi les `enum`
     à des descriptions, l'id d'ingrédient inconnu reste attrapé par le validateur. Profil
     **sans aucun texte libre** (schéma zod strict). Quota : 3 générations / 24 h glissantes /
     foyer, échecs de l'IA compris mais pas les pannes de l'API (`IA_QUOTA_JOUR`, décidé avec
     Marc le 2026-10-16) ; une seule à la fois (409, périmée après 15 min).
     Env : `ANTHROPIC_API_KEY` (absente = 503), `IA_MODELE`, `IA_EFFORT`. Le plat de la
     bibliothèque en dernier recours arrive avec l'étape 8.
8. [x] **Bibliothèque partagée** (`v2_recettes`) : toute recette validée y entre ; la génération y
   pioche d'abord les plats compatibles, l'IA n'écrit que ce qui manque.
   `POST /v2/menus/remplacer` (« Remplacer ce plat », mêmes contrôles, même quota) ;
   `POST /v2/recettes/:id/signaler` (recette ratée).
   Décisions (Marc, 2026-10-17) :
   - **pioche** : le serveur choisit jusqu'à 60 plats de la bibliothèque compatibles avec le
     profil (mêmes contrôles plat par plat que le validateur, extraits en `controlerRecette`),
     tirés au hasard, titres dédoublonnés ; ils sont listés à l'IA (données, après le profil),
     qui peut en reprendre un par référence `{ id, bibliotheque }` au lieu de l'écrire. Le
     serveur déplie la référence ; une référence hors liste est une erreur corrigée par la boucle.
     Chaque recette d'un menu validé porte son id de bibliothèque (`Recette.bibliotheque`,
     optionnel) ; les nouvelles y entrent ;
   - **plat du Rituel remplacé** (regénération ou « Remplacer ce plat ») : l'IA réécrit aussi les
     étapes du Rituel de la semaine (les textes citent les plats) ; un plat frais est remplacé
     seul. Corrige la regénération livrée à l'étape 7, qui laissait des étapes périmées ;
   - **dernier recours** : un plat frais encore fautif est remplacé par un plat frais compatible
     de la bibliothèque, sans IA ; un plat du Rituel, non (il faudrait réécrire les étapes) ;
   - **remplacer** : `{ profil, menus, semaine, recette }`, mêmes contrôles et même quota que la
     génération ; accepté si le nouveau plat est conforme et que rien de la semaine n'empire
     (budget, durée du Rituel). Un menu devenu non conforme après un changement de profil peut
     donc être réparé plat par plat ;
   - **signaler** : la recette sort des menus futurs du foyer ; au 3e foyer, de la bibliothèque
     pour tous. Les menus en cours ne changent pas.
   - **Livré (2026-10-17)** : `v2/bibliotheque.ts` (`ajouterRecettes`, `piocher`, `signaler`),
     `remplacerPlat` dans `v2/generer.ts`, formats de sortie `plat-frais` / `plat-rituel`,
     `schemaMenus` (menus renvoyés par l'app, 1 Mo au plus). Erreurs : `corps-invalide` (400)
     pour des menus, une semaine ou un plat introuvables ; signaler un id inconnu = 404.
9. [ ] **Batterie de profils difficiles** (keto + sans gluten, végétarien, allergie à l'arachide,
   Rituel de 10 min, petit budget) : script `npm run batterie` dans `server/`, contre l'API réelle,
   **hors CI** (payant) ; obligatoire avant tout changement de prompt ou de modèle. Sortie : taux
   de conformité au premier essai, coût et durée par génération → fixe le quota de l'étape 7.
10. [ ] **Photos** (spec §10.4) : l'IA fournit une requête courte en anglais ; le serveur
    interroge Pexels, vérifie chaque candidate par **vision** (Claude, image en base64 +
    recette ; réponse en sortie structurée `conforme / raison`) ; la première conforme est copiée
    dans `data/photos/` avec le nom du photographe ; aucune conforme → image neutre de la famille
    du plat. `GET /v2/photos/:id` (cache long). Tests avec Pexels et Claude simulés.
11. [ ] Infra et docs : variables `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, `IA_MODELE`
    dans `docker-compose.yml` (valeurs dans le `.env` du VPS, jamais dans le
    dépôt) ; `docs/backend.md`, `server/README.md`. Une PR par étape ou groupe d'étapes, CI verte.

## B. App native (nouveau dépôt)

1. [ ] Création : Expo (SDK courant, vérifié avec `ctx7` le jour J), TypeScript strict,
   expo-router, Jest (`jest-expo`) + React Native Testing Library, ESLint. `AGENTS.md`/`CLAUDE.md`
   repris de ce dépôt (TDD, PR, conventional commits, vocabulaire). CI GitHub : lint, typecheck,
   tests. Release-please comme ici.
2. [ ] Thème « Marché coloré » en tokens (couleurs, typo, rayons) tirés des maquettes ; textes en
   français, aucun « cycle » visible (test qui le cherche dans les chaînes de l'app).
3. [ ] **Icône adaptative** : la Box simple (`Icone.dc.html`) en SVG → PNG (avant-plan 108 dp,
   fond crème, version monochrome) ; écran de démarrage assorti.
4. [ ] **EAS** : `eas.json`, profil `preview` (APK) ; premier APK installé sur le téléphone de Marc.
5. [ ] **Stockage local** : expo-sqlite, migrations versionnées et testées ; une donnée corrompue
   se répare, ne plante jamais (même principe que `safeParse`).
6. [ ] **Logique recopiée avec ses tests** depuis `src/lib/` : `dates`, `text`, `prix`,
   `minuteurs`, puis courses, budget, calendrier et Rituel adaptés au nouveau contrat (ingrédients
   par id, rayon issu de la table).
7. [ ] **Client de sync** : file d'envoi locale, `pousser`/`tirer` contre `/v2/sync`, « l'envoi
   local prime » ; tout fonctionne hors ligne, seule la génération exige la connexion.
8. [ ] Écran **Guide de routine** (`Main.dc.html`) : 6 étapes passables, réponses gardées.
9. [ ] Écran **Conditions** (`Cgu.dc.html`) : dernière étape du guide et arrivée dans un foyer ;
   case obligatoire ; version et date envoyées au serveur.
10. [ ] Écran **Ton compromis** (`Resultat.dc.html`) puis génération (attente, erreurs claires,
    quota atteint expliqué).
11. [ ] Écran **Accueil avant de commencer** (`Attente.dc.html`).
12. [ ] Écran **Accueil** (`Accueil.dc.html`).
13. [ ] Écran **Menus** (`Menus.dc.html`) : 4 semaines, photos en cache local (hors ligne),
    « Remplacer ce plat », signaler une recette ratée.
14. [ ] Écran **Rituel** (`Rituel.dc.html`) : pas à pas pensé pour une main, minuteurs.
15. [ ] Écran **Courses et budget** (`Courses.dc.html`) : budget au mois, à la semaine ou sur
    15 jours ; fourchette estimée avant, montant du ticket après ; aucune alerte ni blocage.
16. [ ] Écran **Foyer** (`Foyer.dc.html`) : code, rejoindre, réinitialiser, À propos (lien Pexels
    exigé par l'API, CGU).
17. [ ] **Rappels** (`expo-notifications`, locales, `docs/conservation.md` §5) : frigo 2 h après la
    cuisson, sortie du congélateur la veille, dernier jour d'un plat ; recalculés quand un repas
    bouge ; activés par défaut, les couper demande une confirmation. Calcul des dates en TDD.
18. [ ] Parcours critiques sur émulateur (Maestro) : guide → CGU → génération → menus ; rejoindre un
    foyer ; courses hors ligne.

## C. Actions manuelles (Marc)

1. [x] Créer le dépôt GitHub de l'app (`rituel-native`, privé) ; compte Expo et projet EAS créés.
2. [ ] Clé d'API Anthropic (plafond de dépense mensuel réglé dans la console) et clé Pexels → `.env`
   du VPS.
3. [ ] Relire pexels.com/license ; relecture juridique de `docs/cgu.md` et politique de
   confidentialité ; relecture de `docs/conservation.md` par un professionnel (HACCP).
4. [ ] Valider le coût mesuré par la batterie (A.9) et le quota par foyer qui en découle.
