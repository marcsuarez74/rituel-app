# Backend de synchronisation (Supabase)

La sync est **optionnelle** : sans configuration, l'app reste 100 % locale
(aucun code réseau chargé, aucune outbox). Elle sert à un seul cas : retrouver
semaines, coches, pesées, dépenses et profils sur les 2 téléphones du foyer.

Spec : `docs/superpowers/specs/2026-09-16-sync-supabase-design.md`.

## Posture

- Les données vivent d'abord dans le téléphone (localStorage) ; le serveur est
  un miroir qui peut être ignoré — l'app doit toujours être utilisable sans lui.
- **Transparence** : la note affichée dans l'app (bloc Profil → Synchronisation)
  résume la posture — « Données synchronisées chez Supabase — région UE, accès
  limité au foyer. »
- Aucun secret dans le front : la clé `anon` est publique par design, et la
  `SERVICE_ROLE_KEY` ne quitte jamais le terminal local.

## 1. Créer le projet

1. [supabase.com](https://supabase.com) → New project → **région UE**
   (ex. Paris) → sauvegarder le mot de passe DB.
2. Settings → API : noter `Project URL` (= `VITE_SUPABASE_URL`) et
   `anon public` (= `VITE_SUPABASE_ANON_KEY`).
3. Settings → API → JWT Secret (→ secret `JWT_SECRET` de l'edge function).

## 2. Créer le schéma

SQL Editor → coller `supabase/migrations/0001_sync_init.sql` → Run.

Vérifier : 6 tables créées (`households`, `weeks`, `checks`, `weights`,
`depenses`, `profiles`), RLS activée sur toutes (policies filtrées par la claim
`household_id` du JWT), publication realtime à jour.

## 3. Créer le foyer (code partagé)

```bash
node supabase/scripts/creer-foyer.mjs "$SUPABASE_URL" "$SERVICE_ROLE_KEY"
# ou avec code imposé :
node supabase/scripts/creer-foyer.mjs "$SUPABASE_URL" "$SERVICE_ROLE_KEY" "mon-code"
```

- Sans code imposé, le script génère une phrase de ~24 caractères
  (deux mots d'herbes + 8 hexadécimaux, ex. `romarin-basilic-3f9a2c7e`) ;
  plancher 12 caractères si code imposé. Le code n'est stocké que hashé
  (PBKDF2-SHA256, 100 000 itérations) — le noter à la création.
- Le script **refuse de créer un 2e foyer** : la connexion exige un foyer
  unique (l'edge function renvoie 401 sinon).
- La `SERVICE_ROLE_KEY` (Settings → API → `service_role`) ne quitte **jamais**
  le terminal local — elle n'est utilisée que par ce script.

## 4. Déployer l'edge function

```bash
npm i -g supabase            # CLI (ou brew install supabase/tap/supabase)
supabase login
supabase link --project-ref <ref>
supabase secrets set JWT_SECRET="<jwt secret du projet>"
supabase functions deploy connexion-foyer
```

L'edge function `connexion-foyer` vérifie le code contre `households.code_hash`
et renvoie `{ token, foyer }` : un JWT HS256 (exp. 365 jours) signé avec
`JWT_SECRET`, portant la claim `household_id` lue par les policies RLS.

## 5. Brancher l'app (build)

```bash
VITE_SUPABASE_URL="https://xxx.supabase.co" \
VITE_SUPABASE_ANON_KEY="eyJ..." \
npm run build
```

Les deux vars sont **publiques par design** (clé anon) — aucun secret dans le
front. Les téléphones se connectent ensuite :

- **Profil** → bloc **Synchronisation** (visible dès que la sync est compilée ;
  sur un appareil non appairé, aucun point n'est affiché dans la bannière)
  → saisir le code de foyer → « Se connecter au foyer » ;
- l'**onboarding** propose l'étape 6 optionnelle « Synchroniser les
  téléphones » aux nouveaux profils (« Plus tard » possible).

## 6. Vérifier

1. Téléphone A : connexion au code → la pastille de la bannière passe à
   « Synchronisé » (sans coche ni émoji — libellé au survol/lecteur d'écran ;
   un appui dessus force une re-sync, et recrée la connexion si elle a échoué
   au démarrage). Le bloc Profil → Synchronisation affiche « Synchronisé. »
2. Téléphone B : connexion au code → la fusion union lui apporte les données
   du foyer (et pousse les siennes).
3. Cocher un item de courses sur A → apparaît coché sur B (~1 s, realtime).
4. Mode avion sur B → l'app continue hors ligne (les mutations s'empilent dans
   l'outbox locale) ; au retour du réseau, la file est vidée.
5. Indisponibilité momentanée de Supabase à l'ouverture → le point passe en
   erreur ; un appui dessus (ou le retour du réseau) reconnecte sans
   recharger la page. Coupure du canal en plein usage → erreur puis
   reconnexion automatique en ~5 s, avec rattrapage des données manquées.

## Comment ça marche (résumé)

- **Outbox locale** (`sportapp:sync:outbox`) : toute mutation passe par
  `storage.ts` → `empilerMutation` (no-op sans env/token). Flush différée de
  ~300 ms après mutation, dédup « dernier op gagne » par clé.
- **Pull/merge** : le realtime (debounce 150 ms) déclenche un pull ; le merge
  applique le remote sauf sur les clés en attente dans l'outbox (l'outbox
  locale prime). Payload distant invalide → jamais persisté.
- **Connexion** : fusion union — l'état local part d'abord, puis le remote est
  fusionné, puis la flush pousse l'union (rien n'est écrasé ni perdu).
- **Purge** : « Supprimer les données du foyer » (Profil) vide le serveur
  **avant** le local — jamais de données orphelines.
- **Déconnexion** : efface session + outbox locales ; le serveur garde le
  foyer jusqu'à la purge.

## Rotation / révocation du code de foyer

Les JWT n'ont pas de liste de révocation : leur validité repose sur la row
`households`. **Supprimer la row `households` (SQL Editor ou l'équivalent)
déclenche la cascade** sur `weeks`/`checks`/`weights`/`depenses`/`profiles` —
tous les JWT existants deviennent inertes (leur `household_id` ne matche plus
aucune row) et les données du foyer sont effacées côté serveur.

Procédure de rotation du code :

1. SQL Editor : `delete from households;` (cascade — les JWT deviennent
   inertes, les téléphones connectés passent en erreur de sync).
2. Recréer le foyer avec le nouveau code (section 3) et redéployer si besoin.
3. Reconnecter chaque téléphone avec le nouveau code (la fusion union
   repartira des données locales de chaque téléphone).

## 7. Notifications push (optionnel, VAPID Web Push)

Le serveur envoie le texte final (`{ title, body }`) — le SW n'interprète
jamais le contenu. Sans `VITE_VAPID_PUBLIC_KEY`, la fonctionnalité est
inexistante (bloc caché, zéro appel réseau).

Composants :

- **Table `push_subscriptions`** — migration `0002` : une row par appareil
  (PK `household_id, device_id`), `config` JSONB (toggles événements +
  rappels), `derniers_creneaux` JSONB (dédup cron). RLS foyer.
- **Edge functions** — `push-register` (POST upsert / DELETE désabonnement,
  JWT foyer), `push-notifier` (événements : exclusion du device appelant +
  toggle par destinataire, purge 404/410), `push-rappels` (appelé par
  pg_cron toutes les 5 min, auth `Bearer CRON_SECRET`, tz locale, dédup
  1 envoi/jour/type), partagé `_shared/webpush.ts` (WebCrypto pur : VAPID
  ES256 + aes128gcm RFC 8291) + `_shared/jwt.ts` + `_shared/rappels.ts`.
- **Secrets** : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
  `CRON_SECRET` (`openssl rand -hex 24`) — côté front : `VITE_VAPID_PUBLIC_KEY`
  (secret GitHub `VITE_*` + `.env.local`).
- **Cron** — pg_cron **activé via le Dashboard** (Database → Extensions ;
  `create extension` en SQL échoue : « schema cron does not exist »), puis :

```sql
select cron.schedule('push-rappels', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://<REF>.supabase.co/functions/v1/push-rappels',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'),
    body := '{}'::jsonb);
$cron$);
```

Événements envoyés par l'app de l'auteur **après flush confirmée** (jamais
en optimiste) : dîner coché → « C'est prêt ! », pesée, dépenses réelles
(1 push par séance de courses, pas par produit). Le device appelant ne se
notifie jamais lui-même.

Pièges connus :

- `fr-CA` formate l'heure `08 h 03` (comparaisons faussées) → l'heure vient
  de `fr-FR` dans `_shared/rappels.ts` ; la date ISO vient de `fr-CA`.
- Une souscription aux clés illisibles ne doit pas faire lever l'envoi :
  `envoyerPush` renvoie statut 0 (skip) ; seuls 404/410 purgent la row.
- Chrome en dev local : Proxyman (proxy 127.0.0.1:9090) intercepte FCM et
  casse la souscription — le fermer pendant les tests.
