# Notifications push — design

**Date** : 2026-09-18 · **Statut** : approuvé (design + granularité courses validés oralement)

## Objectif

Notifier le 2ᵉ téléphone du foyer : **rappels horaires** (séance, pesée, rituel
dimanche) et **événements du foyer** (dîner coché, pesée ajoutée, courses
faites), **configurables depuis l'app** (écran Profil). Posture sync : la
fonctionnalité est **optionnelle** — sans env Supabase ni session, tout est
no-op, l'app reste 100 % locale.

## Contraintes résolues

| Contrainte | Réponse |
|---|---|
| GitHub Pages = hébergement statique (aucun serveur d'envoi) | Edge Functions Supabase (canal existant, cf. `connexion-foyer`) |
| 2 téléphones **Android** | Web Push standard sans prérequis d'installation ; permission via geste utilisateur. Aucune contrainte iOS (hors périmètre v1) |
| Service worker actuel auto-généré (`vite-plugin-pwa`, generateSW) | Passage en `injectManifest` : SW custom qui conserve precache + runtime caching (miniatures rayons, Unsplash) et ajoute les handlers `push` / `notificationclick` |
| La row `checks` n'a pas d'auteur (pas de colonne profil) | **Les événements sont envoyés par l'app de l'auteur** (décision clé, ci-dessous) |

## Décision clé : l'app notifie (pas de trigger SQL)

Après une flush réussie, l'app qui a muté connaît : le **profil actif**
(`loadProfile().id` → auteur), le **libellé local** (titre de recette, kg,
total + magasin) et son `device_id`. Elle appelle l'edge function
`push-notifier` (fire-and-forget) avec un payload riche ; la fonction notifie
**toutes les subscriptions du foyer sauf celle de l'appelant** (exclu par
`device_id`) et formate le texte français.

Avantages : auteur exact (pas d'auto-notification), zéro trigger SQL, pas de
lookup serveur, libellés résolus depuis les données locales (le titre « Omelette
au champignons » vient du menu/`## Recettes`, pas du `check_id`).

## Déclencheurs

### Événements (app → `push-notifier` après flush)

| Événement local | Push reçu par l'autre téléphone |
|---|---|
| Coche dîner (`menu:%` passe à fait) | « 🍳 C'est prêt ! Mélanie a fait la recette "Omelette au champignons" » |
| Pesée ajoutée | « ⚖️ Marc a ajouté une pesée : 82,4 kg » |
| Dépense réelle ajoutée | « 🛒 Mélanie a fait les courses : 23,40 € chez Lidl » |

NB : les émojis des notifications sont rendus par l'OS — hors périmètre de la
règle « pas d'émoji dans l'UI » d'AGENTS.md (qui concerne le DOM de l'app).

- Les coches de courses produit par produit ne déclenchent **rien** (anti-spam
  en Mode magasin) — la dépense conclut la visite (granularité validée).
- Un push par événement (3 dîners cochés d'affilée = 3 pushes — toléré v1,
  débounce possible plus tard).
- Les événements ne partent que si le toggle correspondant est actif sur
  l'appareil destinataire (filtre serveur sur la `config` de la subscription).

### Rappels horaires (cron pg_cron `*/5 min` → `push-rappels`)

Chaque appareil configure une liste de rappels `{ type, jours: 0-6 (0=dim.),
heure: 'HH:MM' }` avec type parmi `seance` | `pesee` | `rituel`. Le cron
compare en **fuseau du téléphone** (`tz` IANA stockée avec la subscription,
comparaison via Intl). Un push selon le type — « 💪 C'est l'heure de ta
séance », « ⚖️ C'est l'heure de ta pesée », « 🧅 C'est l'heure du rituel du
dimanche » — un seul envoi par créneau (dédup par `dernier_envoye` sur la row).

## Backend Supabase

- **Table `push_subscriptions`** (RLS par `household_id`, pattern des 5 tables
  sync) : `endpoint` (PK), `p256dh`, `auth`, `profil` ('marc'|'melanie'),
  `device_id` (uuid par installation), `tz`, `config` (JSONB, ci-dessous),
  `dernier_envoye` (timestamptz, dédup cron).
- **`config` JSONB** : `{ evenements: { diner: bool, pesee: bool, courses: bool },
  rappels: [{ type, jours, heure }] }`.
- **Edge functions** :
  - `push-register` — JWT foyer (même auth que `connexion-foyer`) : upsert de
    la subscription + config, côté client après souscription et à chaque
    changement de config.
  - `push-notifier` — JWT foyer : payload `{ type, auteur, label }` → push aux
    autres subscriptions dont le toggle correspondant est actif.
  - `push-rappels` — appelé par pg_cron avec `CRON_SECRET` : due reminders → push.
- **Secrets** : `VITE_VAPID_PUBLIC_KEY` (front — publique par design, comme la
  clé anon), `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (serveur).
- **Web-push depuis Deno** : friction connue (lib `npm:web-push` pas garantie
  sous Deno). Deux chemins : lib npm sous node-compat, **ou** implémentation
  VAPID (JWT ES256) + chiffrement aes128gcm avec WebCrypto (~150 lignes).
  **Tranché par le POC** (phase 1) avant tout le reste.
- Churn : réponse 410 Gone d'un push service → suppression silencieuse de la
  subscription.

## Front

Le serveur envoie toujours le texte final : le payload push contient
`{ title, body }` prêts à afficher — le service worker n'interprète jamais le
contenu (l'edge function formate le français).

- **`src/lib/push/`** : `souscrire()` (permission sur geste utilisateur →
  `PushManager.subscribe(userVisibleOnly: true)`), `register()` (→ push-register),
  `majConfig()`, `desabonner()` (unsubscribe + delete côté serveur). No-op sans
  env/session — même gate que la sync (`syncActif()` + session). `device_id`
  généré une fois par installation (localStorage `sportapp:push:device`).
- **Service worker** : `injectManifest` dans `vite.config.ts` — SW custom
  (`src/sw.ts`) important le precache manifest, `push` → `showNotification`
  (titre/corps du payload), `notificationclick` → focus/ouverture de l'app.
  `registerType: 'autoUpdate'` conservé.
- **UI — Profil → bloc « Notifications »** (après le bloc Synchronisation,
  même style) :
  - Toggle maître « Activer les notifications » (permission + souscription +
    register ; désactivation = unsubscribe + delete)
  - Rappels : liste éditable — type (Séance / Pesée / Rituel dimanche), jours
    (lun-dim), heure ; ajouter / modifier / supprimer
  - Événements : toggles « Dîner coché », « Pesée ajoutée », « Courses faites »
  - Chaque changement → `majConfig()` ; bloc affiché seulement si sync active
- Les hooks d'événement vivent côté storage/engine (après flush confirmée des
  mutations `menu:%`, `weights`, `depenses`) — jamais en optimiste.

## Tests

- Unitaires : matching heures/fuseau du cron (lib pure), module push avec
  client mocké (rouge→vert), UI du bloc Notifications (toggles → appels),
  hooks d'événement (une dépense flushée → un appel notifier avec payload
  exact ; courses produits cochés → aucun appel).
- e2e : UI + permission uniquement (pas de push réel en Playwright/WebKit) ;
  push réel = checklist post-merge sur téléphone.
- Gates inchangées + `npm run e2e` zéro débordement.

## Phases d'implémentation

1. **POC dérisquage** : edge function `push-register` minimale + envoi Web Push
   depuis Deno → **un push réel reçu sur le téléphone de Marc**. Tranche la
   question lib (npm:web-push vs WebCrypto maison). Si le POC échoue, on
   s'arrête et on rediscute.
2. **Backend complet** : migration SQL (table + RLS + cron), 3 edge functions,
   secrets VAPID.
3. **Front complet** : SW custom, module push, bloc Profil, hooks d'événement,
   tests → PR.

## Hors périmètre v1

iOS (A2HS + iOS ≥ 16.4), badges, actions riches (boutons dans la
notification), notifications courses produit par produit, débounce
anti-spam, notification de changement de semaine/contenu.
