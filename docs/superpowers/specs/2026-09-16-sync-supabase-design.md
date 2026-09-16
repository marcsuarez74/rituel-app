# Spec — Backend de sync Supabase (chantier 1)

## Contexte

Rituel est une PWA 100 % front : toutes les données vivent dans le localStorage du
téléphone, et `docs/ameliorations.md` liste « Zéro backend » comme contrainte non
négociable. Le brainstorming du 2026-09-16 révise cette contrainte : le besoin réel
derrière « zéro backend » était « zéro maintenance, zéro fuite de données, app
toujours utilisable hors ligne » — pas l'interdiction d'un serveur. Quatre usages
étaient visés (sync entre les 2 téléphones, backup, génération IA, push) : **seul
la sync est retenue** dans ce chantier ; l'IA et le push sont reportés (phases 2-3).

Décisions validées en brainstorming (2026-09-16) :

| Sujet | Décision |
|---|---|
| Motivation | **Les 4 usages**, mais phasés : **sync d'abord** (elle donne le backup gratuitement), IA et push en chantiers séparés ultérieurs |
| Hébergement | **Supabase** (tier gratuit, Postgres + realtime + edge functions, région EU, zéro maintenance, dashboard admin) — retenu face à Cloudflare Workers+D1, VPS+PocketBase, Firebase |
| Auth | **Code de foyer partagé** : un seul code saisi une fois par téléphone (zéro friction, zéro email) ; pas d'inscription publique |
| Posture | **Offline-first inchangé** : localStorage = source de vérité locale, Supabase = miroir optionnel ; sans backend configuré (ou hors ligne), l'app se comporte exactement comme aujourd'hui |
| Conflits | **Dernier écrivain gagne** par enregistrement (upsert) — suffisant pour 2 utilisateurs ; « premier appareil connecté pousse tout » à la première connexion |
| « Profil actif » | **Non synchronisé** (état device-local) — on sync le *contenu* des profils, pas lequel est actif |
| Dépendance | **`@supabase/supabase-js`** acceptée (discussion brainstorming) — realtime à la main serait disproportionné ; chargée en **dynamic import** pour ne pas alourdir le bundle initial |
| e2e | **Sync désactivée en tests** (env absente) — zéro réseau en CI, specs e2e inchangées |
| RGPD | **Usage domestique → non applicable** (considérant 15, foyer de 2 personnes sans inscription publique). Mesures d'hygiène retenues quand même : **droit à l'effacement** (bouton « Supprimer les données du foyer » : purge serveur + clés sync locales) et **transparence** (note vie privée README + Profil). Conformité formelle (consentement, registre, politique) reportée à une éventuelle ouverture à d'autres foyers |

## 1. Principes

1. **Additif et réversible** : la sync est une couche au-dessus de `storage.ts`, jamais un remplacement. Si elle casse, l'app continue de fonctionner offline comme avant (rollback trivial).
2. **Outbox locale** : chaque mutation passe d'abord par localStorage (comportement actuel), puis est empilée dans une outbox. La flush vers Supabase est opportuniste (ouverture d'app, mutation, retour online, realtime) et ne bloque jamais l'UI.
3. **Miroir, pas référence** : le serveur reflète l'état ; aucune lecture critique de l'app n'en dépend. Sans sync, aucune requête réseau n'est émise.
4. **Règle de merge KISS** : ce qui est en attente dans l'outbox locale **prime** sur le remote (il sera flushé) ; sinon le remote s'applique. Pas d'horodatages dans le localStorage — le dernier flush décide, acceptable pour 2 utilisateurs.

## 2. Hébergement & authentification

- Projet Supabase créé manuellement par Marc (région **EU**, doc de setup : `docs/backend.md`).
- **Connexion foyer** : edge function `connexion-foyer` (Deno, `supabase/functions/`) reçoit le code, le vérifie contre `households.code_hash` (PBKDF2 via WebCrypto, salt par foyer), renvoie un **JWT signé HS256** (secret dans les envs Supabase, jamais dans le repo) portant la claim `household_id`. Validité 1 an — ré-expiré = re-saisie du code.
- **RLS Postgres** sur les 5 tables : politiques `household_id = auth.jwt()->>'household_id'`. La clé `anon` (publique par design, dans les vars d'env Vite) ne permet que d'atteindre les tables *via* un JWT foyer valide.
- Le code de foyer est généré une fois (doc de setup), stocké **haché** ; jamais dans le repo ni dans les logs.
- Le JWT foyer est stocké dans `localStorage` (`sportapp:sync:token`) ; déconnexion = suppression du token + des clés `sportapp:sync:*`.

## 3. Schéma de données (5 tables, miroir des 5 familles de clés)

```sql
create table households (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now()
);

create table weeks (        -- miroir de sportapp:weeks
  household_id uuid not null references households,
  semaine text not null,               -- ex. '2026-S37'
  payload jsonb not null,              -- ImportedWeek { raw, data, importedAt }
  updated_at timestamptz not null default now(),
  primary key (household_id, semaine)
);

create table checks (       -- miroir de sportapp:checks:{semaine}
  household_id uuid not null references households,
  semaine text not null,
  check_id text not null,              -- id stable du contrat .md
  done boolean not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, semaine, check_id)
);

create table weights (      -- miroir de sportapp:weights:{profil}
  household_id uuid not null references households,
  profil text not null,                -- 'marc' | 'melanie'
  date_ date not null,
  kg numeric not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, profil, date_)
);

create table depenses (     -- miroir de sportapp:depenses
  household_id uuid not null references households,
  date_ date not null,
  magasin_key text not null,           -- lower(magasin) — même règle de casse que saveDepense
  magasin text not null,               -- graphie d'affichage (première saisie gagne, comme aujourd'hui)
  total numeric not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, date_, magasin_key)
);

create table profiles (     -- contenu du profil actif de chaque téléphone (pas le « profil actif » lui-même)
  household_id uuid not null references households,
  profil text not null,                -- 'marc' | 'melanie'
  payload jsonb not null,              -- UserProfile v2.1
  updated_at timestamptz not null default now(),
  primary key (household_id, profil)
);
```

- Les payloads sont **JSONB au format de l'app** (`ImportedWeek`, `UserProfile`) : le serveur reste schéma-light, l'app évolue sans migration SQL.
- `updated_at` est réécrit à chaque upsert (côté serveur) — sert au realtime et au diagnostic, **pas** au merge (cf. règle outbox-prime, § 1.4).
- **Profils** : un téléphone ne stocke que son profil actif (`sportapp:profile`, pas de slot local pour l'autre). On sync donc **le profil actif seulement** : push à chaque `saveProfile`, pull appliqué au profil actif ; les entrées remote de l'autre profil sont **ignorées localement** (aucun slot) mais **conservées serveur** (rien ne se perd — un « changer de profil » sur un téléphone remplacera la valeur serveur au LWW).

## 4. Module `src/lib/sync/` (logique pure, zéro React)

```
src/lib/sync/
  config.ts      # lecture env VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, état activé/désactivé
  client.ts      # port étroit vers supabase-js (interface injectable) + dynamic import
  auth.ts        # connecterFoyer(code) → edge function → token ; déconnecterFoyer()
  outbox.ts      # outbox persistée : sportapp:sync:outbox ([] = vide)
  engine.ts      # flush (outbox → upserts), pull (remote → localStorage), merge outbox-prime
  realtime.ts    # subscribe postgres_changes filtré household_id → callback
```

- **Outbox** : `{ table, key, payload }[]` persistée ; entrée créée *après* chaque mutation locale réussie (weeks/checks/weights/depenses/profiles), retirée après flush confirmé.
- **Déclencheurs de sync** : ouverture d'app, retour `online`, mutation locale (flush différée ~2 s, debounce), événement realtime (pull ciblé).
- **Merge** (règle § 1.4) : à la réception d'un changement remote, l'appliquer au localStorage **sauf** si une entrée d'outbox pende sur la même clé ; à la flush, upsert écrase le remote.
- **Première connexion** : si le foyer serveur est **vide** → push complet de l'état local (le premier appareil connecté alimente le foyer) ; si le foyer contient **déjà des données** → pull d'abord (les entrées d'outbox locales flushent ensuite, la règle outbox-prime tranche). Ainsi un second appareil qui se connecte reçoit l'état existant sans l'écraser.
- **Notif App** : `subscribe(cb)` — App recharge ses états (weeks, checks…) quand un changement remote est appliqué (pattern props/useState existant, pas de contexte).
- **Effacement du foyer** : `purgerFoyer()` — suppression serveur des lignes du foyer dans les 5 tables, puis suppression des clés `sportapp:sync:*` (token, outbox) : l'app redevient 100 % locale, ses données d'app (semaines, coches, pesées…) restent sur le téléphone. Appelée par le bouton Profil (cf. § 5).
- **Bundles** : le module est importé dynamiquement depuis `App.tsx` ; env absente → aucun code réseau chargé, aucun comportement modifié.

## 5. UI (langage Herbes, discret)

- **Onboarding — étape 6 optionnelle** « Synchroniser les téléphones » : champ code de foyer + bouton « Plus tard » ; ignorée = app sans sync, aucun rappel insistant.
- **Écran Profil — bloc « Synchronisation »** : état (Sync ✓ / Hors ligne / Erreur / Désactivée), « Se connecter au foyer » (saisie code), « Déconnecter », **« Supprimer les données du foyer »** (destructif, double confirmation, purge serveur cf. § 4). Boutons sobres (`.bsoft`). Sous le bloc, une **note de transparence** : « Données synchronisées chez Supabase — région UE, accès limité au foyer. »
- **Indicateur bannière** : point de statut discret (tap = re-sync manuelle + toast résultat). Pas de spinner permanent — la sync doit être invisible.
- **Erreurs visibles mais non bloquantes** : échec de flush → point passe en erreur + outbox conservée (retry au prochain déclencheur) ; échec d'auth → message clair « Code de foyer refusé ».

## 6. Gestion d'erreurs & garde-fous

- **Jamais de crash** : toute réponse réseau passe par try/catch ; une erreur sync n'interrompt jamais le rendu (garde de forme sur les payloads remote, même philosophie que `safeParse`).
- **Payload remote invalide** → ignoré + warn (l'état local reste sain).
- **Boucle realtime** : l'application d'un changement remote ne re-empile rien dans l'outbox (distinction mutation locale / application remote).
- **Token expiré (401)** → statut « Se reconnecter », outbox conservée.
- **Purge** : échec serveur → erreur visible, **clés sync locales conservées** (la suppression locale n'a lieu qu'après confirmation serveur — jamais de données orphelines silencieuses).

## 7. Tests (TDD, miroir du src)

- `tests/sync/outbox.test.ts` — empilement, dédoublonnage par clé, persistance.
- `tests/sync/engine.test.ts` — flush, pull, règle **outbox-prime**, première connexion (push si foyer vide / pull sinon), payloads invalides ignorés, **purgerFoyer** (purge serveur avant nettoyage local ; échec réseau → clés locales conservées) — avec un **faux client** injecté (aucun réseau en vitest).
- `tests/sync/auth.test.ts` — connecterFoyer (succès / code refusé), déconnexion (nettoyage des clés).
- `tests/components.test.tsx` / `app.test.tsx` — compléments : bloc sync du Profil, étape 6 onboarding, indicateur bannière, app inchangée sans env sync.
- **e2e inchangés** (sync désactivée : env absente) — le workflow Deploy reste sans dépendance Supabase.

## 8. Déploiement & secrets

- **GitHub Pages inchangé** (front statique). Vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` ajoutées au build — publiques par design ; **aucun secret** (JWT HS256, hash du code, clé service_role) ne va dans le front ni dans le repo.
- Edge functions déployées via `supabase CLI` (commandes dans `docs/backend.md`) ; secrets Supabase gérés dans le dashboard.
- CI (`.github/workflows/ci.yml`) : rien à changer — sans env, la sync est off et les tests passent.

## 9. Docs à mettre à jour (livrées avec le chantier)

- `docs/ameliorations.md` : révision de la contrainte « Zéro backend » → « backend optionnel, données locales d'abord » + point sur les phases 2-3 (IA, push).
- `AGENTS.md` : section Storage (nouvelles clés `sportapp:sync:*`), structure (`src/lib/sync/`, `supabase/`), posture backend.
- `README.md` : section « Synchronisation entre téléphones » (usage) + « Backend » (setup) + note de transparence vie privée (Supabase UE, accès foyer, effacement).
- `CHANGELOG.md` : entrée `[Non publié]`.
- `docs/backend.md` (nouveau) : setup Supabase pas-à-pas (projet EU, SQL du schéma, code de foyer, CLI, envs).

## 10. Hors périmètre (phases suivantes) & estimation

- **Phase 2 — IA** : edge function qui proxifie une API IA (clé côté serveur), génération de cycles dans l'app.
- **Phase 3 — Push** : Web Push via edge function + VAPID ; contrainte iOS : PWA installée + iOS ≥ 16.4.
- **Estimation chantier 1** : ~3-5 sessions (infra Supabase + schéma → lib sync TDD → branchement UI → docs + e2e de non-régression).
