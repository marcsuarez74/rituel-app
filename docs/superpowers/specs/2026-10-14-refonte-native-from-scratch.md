# Refonte from scratch : application native (APK)

Date : 2026-10-14
Statut : **maquettes validées** (2026-10-15), reste à trancher la génération des menus avant le
plan d'implémentation.

## 1. Intention

Repartir de zéro. L'app actuelle (PWA React) est devenue trop complexe par rapport à la demande
initiale. La nouvelle version est une **app native Android (APK)**, avec un design neuf et une
ergonomie repensée.

Idée centrale : **t'aider à te faciliter la vie au quotidien** dans la préparation des repas de la
semaine, grâce au **batch cooking**.

Deux piliers :

1. **Batch cooking au cœur de l'app** : le **Rituel** est la session de cuisine en lot, et les
   **menus** sont les repas de la semaine.
2. **Une routine construite sur mesure** : un guide pas à pas découvre les habitudes de vie du
   foyer (ou d'une personne seule), puis propose le bon compromis.

Tout le reste est mis de côté pour l'instant.

## 2. Périmètre v1

### 2.1 Inclus

- **Menus** : les repas de la semaine, planifiés sur une base de **4 semaines**. Un seul parcours
  clair pour les générer, les consulter et les suivre.
- **Rituel** : la session de batch cooking, avec étapes pas à pas pensées pour une main.
- **Guide de routine** : questionnaire court et guidé pour cerner les habitudes du foyer (emploi du
  temps, contraintes, envies), puis proposition d'un compromis. Il doit être **intuitif, très clair
  et jamais fastidieux**.
- **Liste de courses avec budget** : le budget est **saisi par l'utilisateur** et doit être
  **respecté au plus près**. C'est un point central, dans le contexte actuel d'inflation et de coût
  de la vie. Le budget reste visible au moment de faire la liste, pas dans un écran à part.
- **Foyer et synchronisation** : un **code court et unique** identifie le foyer. Il permet à
  chaque membre de rejoindre le même foyer sur son appareil. Le principe actuel est conservé.

### 2.2 Données existantes

- **On ne supprime rien** : les données déjà présentes sur les téléphones restent en place.
- **La nouvelle app ne les utilise pas** : pas d'import, pas de lecture, pas de migration pour
  l'instant.

### 2.3 Hors périmètre (v1)

- Refonte « Marché coloré » : abandonnée.
- Suivi sport, diététique détaillée, poids, etc. : retirés de la v1.
- Assistant IA, import/export de JSON externe, sauf décision explicite ultérieure.
- Version iOS.

## 3. Principes

- **Simple avant complet** : chaque écran répond à une seule question.
- **Pas fastidieux** : le guide de routine et la saisie du budget demandent le minimum d'effort.
- **Le Rituel reste le fil rouge** : menus, courses, routine et budget servent tous ce parcours.
- **Une seule source de vérité par donnée**, avec synchronisation au niveau du foyer.
- **Mobile d'abord, en usage une main**, pendant la cuisine comme pendant les courses.

## 4. Vocabulaire

- **Rituel** : la session de batch cooking (cuisine en lot).
- **Menus** : les repas de la semaine, sur 4 semaines.
- Le mot « cycle » n'apparaît jamais dans un texte visible. Les identifiants de code peuvent
  rester en anglais.

## 5. Stack (proposition à valider)

- **Expo / React Native** : vraie app native Android, produit un APK. Permet de réutiliser la
  logique TypeScript existante (règles de menus, calcul de courses) sans reprendre l'UI.
- **Stockage local** : SQLite (expo-sqlite), base locale pour fonctionner hors ligne.
- **Synchronisation du foyer** : code court unique. Le backend (API du dépôt `server/`, Hono +
  SQLite) est à confirmer.
- **Tests** : logique métier en TDD (Vitest ou Jest). Parcours critiques sur émulateur.

Alternative écartée : Capacitor (encapsuler la web app actuelle), car l'objectif est une app native.

## 6. Ergonomie (à concevoir)

Maquettes validées par Marc : `docs/superpowers/mockups/2026-10-14-app-native/` (canevas Claude
Design, un fichier `.dc.html` par écran). Tout nouvel écran passe encore par une maquette validée
avant le code.

Écrans maquettés :

1. **Guide de routine** : étapes courtes, une question par écran, possibilité de revenir en arrière.
   C'est l'écran le plus sensible à la fluidité.
2. Résultat de la routine : le compromis proposé, expliqué simplement, modifiable.
3. Accueil : la semaine en cours et le prochain Rituel.
4. Menus de 4 semaines : vue d'ensemble, puis détail d'une semaine.
5. Rituel : étapes pas à pas.
6. Liste de courses avec budget : reste du budget en temps réel.
7. Foyer : code du foyer, membres, rappels, CGU et confidentialité.

Ajouts nés des maquettes : écran d'attente avant le premier Rituel (« Attente »), accès à la
liste de courses dès cet écran, choix de ne pas commencer tout de suite.

## 7. Décisions tranchées

- **Guide de routine** : **6 étapes** clés sur la vie du foyer. Chaque étape peut être **passée**.
- **Budget** : saisissable **au mois, à la semaine ou sur 15 jours**. **Aucun blocage, aucune
  alerte** : pas de prix par article (on ne sait pas où l'utilisateur fait ses courses), une
  **estimation en fourchette** avant les courses, puis le **montant du ticket** saisi après, qui
  compte pour le budget. Pas d'anxiété, pas de culpabilité.
- **Code du foyer** : **6 caractères**, **réinitialisable**.
- **Backend** : version **plus légère** que l'API actuelle (voir section 8).
- **Conservation des plats** : **règle de code**, jamais confiée au générateur de menus. Plafond
  J+3 au frigo après le Rituel (arrêté du 21 décembre 2009, annexe IV), plus court pour les
  aliments sensibles ; au-delà, congélation au Rituel ou repas frais. Table, règles et sources :
  [`docs/conservation.md`](../../conservation.md).
- **Rappels** : notifications locales indispensables (mise au frigo pendant le Rituel, sortie du
  congélateur la veille, dernier jour d'un plat). Détail dans `docs/conservation.md` §5. Activés
  par défaut ; les désactiver demande une **confirmation explicite** : l'utilisateur prend alors
  le relais.
- **CGU** : résumé dans Foyer › À propos, texte complet dans [`docs/cgu.md`](../../cgu.md)
  (brouillon, relecture juridique à prévoir). On ne peut pas s'exonérer de toute responsabilité
  (code de la consommation, art. R. 212-1, 6°) : on informe clairement et on trace les choix.

## 8. Backend (proposition)

L'API actuelle (Hono + SQLite, avec bugs, routes de cycle, etc.) fait plus que le besoin. Pour la
nouvelle app, il suffit de :

- créer un foyer et obtenir son code (6 caractères) ;
- rejoindre un foyer avec son code ;
- lire et écrire l'état partagé du foyer (menus, courses, budget, routine) ;
- réinitialiser le code.

Je propose donc un **backend minimal** (Hono + SQLite, repris à zéro dans `server/` ou dans un
nouveau dossier) avec ces quelques routes, plutôt qu'un service tiers. Cela garde le contrôle des
données et évite une dépendance supplémentaire.

## 9. Prochaines étapes

1. Trancher la **génération des menus** : catalogue + algorithme, ou IA côté serveur. Dans les
   deux cas, la conservation reste une règle de code (`docs/conservation.md`).
2. Maquetter l'écran d'acceptation des CGU à la création du foyer.
3. Rédiger le plan d'implémentation dans `docs/superpowers/plans/`.
4. Exécuter le plan en TDD, par étapes (une étape = un écran fonctionnel).
5. Avant la sortie : relecture juridique de `docs/cgu.md`, politique de confidentialité, relecture
   de `docs/conservation.md` par un professionnel.
