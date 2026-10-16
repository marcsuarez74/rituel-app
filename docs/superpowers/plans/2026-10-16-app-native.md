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
2. [ ] **Foyer à code de 6 caractères** : alphabet sans caractères ambigus (pas de `0/O`, `1/I/L`) ;
   code stocké en **HMAC-SHA256 avec un secret serveur** (colonne indexée, recherche directe — le
   schéma PBKDF2 actuel, qui parcourt tous les foyers et exige 12 caractères, ne convient pas).
   Routes : `POST /v2/foyers` (crée, rend le code), `POST /v2/foyers/rejoindre`,
   `POST /v2/foyers/code` (réinitialise : l'ancien code cesse de marcher, les appareils déjà
   connectés restent connectés), `DELETE /v2/foyers/moi`. Jeton d'appareil (JWT existant,
   audience `v2`). **Rate-limit fort** sur `rejoindre` (par IP et global) : 6 caractères se
   devinent si on laisse essayer. Tests : collision de code, code réinitialisé refusé, rate-limit.
3. [ ] **État partagé** : une ligne par entité (`v2_entites` : foyer, type, id, version, données
   JSON, `modifie_le`, supprimé). `POST /v2/sync` (pousse) et `GET /v2/sync?depuis=` (tire),
   « dernière écriture gagne » par entité. Pas de SSE en v1 (peu fiable en React Native) : l'app
   tire à l'ouverture, au retour au premier plan et en tirant l'écran vers le bas.
4. [ ] **Acceptation des CGU** : `v2_acceptations` (appareil, version, date) ; enregistrée à la
   dernière étape du guide et à l'arrivée dans un foyer ; la génération la vérifie.
5. [ ] **Table d'ingrédients** : `server/src/v2/ingredients.ts` (+ données versionnées) : id,
   noms, allergènes (14 allergènes réglementaires), régimes compatibles, catégorie de
   conservation (`docs/conservation.md`), prix moyen, unité, rayon. Tests de cohérence de la table.
6. [ ] **Validateur de menus** (TDD sur des sorties figées, cœur de la sécurité, spec §10.2.3) :
   ingrédient hors table, conservation (frigo J+3 / congélation / erreur bloquante), régime et
   allergènes **déduits des ingrédients**, temps du Rituel, budget estimé dans la cible du foyer,
   quantités par personne plausibles, variété sur 4 semaines, structure (Box aux midis prévus,
   jours « dehors » et « libre »). Chaque erreur nomme le plat fautif.
7. [ ] **Génération** `POST /v2/menus/generer` (connexion requise, quota par foyer —
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
8. [ ] **Bibliothèque partagée** (`v2_recettes`) : toute recette validée y entre ; la génération y
   pioche d'abord les plats compatibles, l'IA n'écrit que ce qui manque.
   `POST /v2/menus/remplacer` (« Remplacer ce plat », mêmes contrôles, même quota) ;
   `POST /v2/recettes/:id/signaler` (recette ratée).
9. [ ] **Batterie de profils difficiles** (keto + sans gluten, végétarien, allergie à l'arachide,
   Rituel de 10 min, petit budget) : script `npm run batterie` dans `server/`, contre l'API réelle,
   **hors CI** (payant) ; obligatoire avant tout changement de prompt ou de modèle. Sortie : taux
   de conformité au premier essai, coût et durée par génération → fixe le quota de l'étape 7.
10. [ ] **Photos** (spec §10.4) : l'IA fournit une requête courte en anglais ; le serveur
    interroge Pexels, vérifie chaque candidate par **vision** (Claude, image en base64 +
    recette ; réponse en sortie structurée `conforme / raison`) ; la première conforme est copiée
    dans `data/photos/` avec le nom du photographe ; aucune conforme → image neutre de la famille
    du plat. `GET /v2/photos/:id` (cache long). Tests avec Pexels et Claude simulés.
11. [ ] Infra et docs : variables `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, `IA_MODELE`,
    `CODE_FOYER_SECRET` dans `docker-compose.yml` (valeurs dans le `.env` du VPS, jamais dans le
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

1. [ ] Créer le dépôt GitHub de l'app ; compte Expo + `eas login`.
2. [ ] Clé d'API Anthropic (plafond de dépense mensuel réglé dans la console) et clé Pexels → `.env`
   du VPS, avec `CODE_FOYER_SECRET`.
3. [ ] Relire pexels.com/license ; relecture juridique de `docs/cgu.md` et politique de
   confidentialité ; relecture de `docs/conservation.md` par un professionnel (HACCP).
4. [ ] Valider le coût mesuré par la batterie (A.9) et le quota par foyer qui en découle.
