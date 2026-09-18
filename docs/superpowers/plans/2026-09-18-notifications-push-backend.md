# Notifications push — plan phase 2 (backend)

> **Verdict (2026-09-18) — phase 2 exécutée et validée :**
> - 17/17 étapes faites. Table + RLS posées par Marc (SQL Editor) ; 3 fonctions déployées ; cron `push-rappels` actif (pg_cron + pg_net activés via Dashboard).
> - Validations réelles : register 200/400/401 · notifier `envoyes:1` sur le Mac + auto-exclusion `0` + toggle OFF `0` · rappels `1` puis `0` (dédup jour/type) · purge 404 (row supprimée) · souscription corrompue → skip sans purge.
> - **Écart au plan** : `webpush.ts` n'est pas resté inchangé — une souscription avec clés illisibles faisait lever `envoyerPush` (400 côté appelant). Fix : `envoyerPush` ne lève jamais (statut 0), les 404/410 seuls purgent (commit `2660d47`).
> - Pièges : pg_cron s'active via Dashboard (pas SQL) ; `fr-CA` formate l'heure `08 h 03` → `heure` vient de `fr-FR` (fix avant commit) ; token foyer fabriqué via `connexion-foyer` (desktop sans sync).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend complet des notifications push : table `push_subscriptions` + 3 edge functions (`push-register`, `push-notifier`, `push-rappels`) + cron pg_cron, validées de bout en bout par curl (notification réelle sur la souscription desktop).

**Architecture:** l'app front envoie les événements à `push-notifier` (JWT foyer, exclusion du device appelant) ; pg_cron appelle `push-rappels` toutes les 5 min (secret `CRON_SECRET`) ; les deux envoient via `_shared/webpush.ts` (déjà validé au POC — **inchangé**). La table vit derrière la RLS foyer ; les fonctions lisent via `service_role` filtré par foyer.

**Tech stack:** Deno edge functions (patterns `connexion-foyer`), SQL Supabase (RLS par claim, pattern `0001`), pg_cron + pg_net, zéro dépendance npm.

**Spec:** `docs/superpowers/specs/2026-09-18-notifications-push-design.md`
**Prérequis:** PR #17 (POC) mergée sur main — la phase 2 part de là (worktree neuf). Secrets VAPID déjà posés. **Fichiers temporaires du POC (`push-poc`, `sw-poc.js`) restent en place** jusqu'à la fin de la phase 3 (utiles pour recevoir les pushes de test).

---

## Préambule : worktree (une fois)

- [ ] **Créer le worktree depuis main** (après merge de la PR #17)

```bash
git worktree add .worktrees/push-backend -b feat/push-backend main
cd .worktrees/push-backend && npm install
```

Note : `supabase/` est hors tsconfig — les edge functions ne passent ni par typecheck ni par vitest ; leur vérification = script de vecteurs (Task 2) + tests réels par curl (Tasks 3-5).

---

### Task 1: Migration SQL — table push_subscriptions

**Files:**
- Create: `supabase/migrations/0002_push_subscriptions.sql`

- [x] **Step 1: Écrire la migration** (pattern RLS calqué sur `0001_sync_init.sql`)

```sql
-- Rituel — souscriptions push (spec 2026-09-18). Exécutable dans l'éditeur SQL Supabase.
-- Une row par appareil (device_id = uuid par installation) ; ré-inscription = upsert.
-- derniers_creneaux : dédup cron, géré côté serveur — { type: 'YYYY-MM-DD' (tz locale) }.

create table if not exists push_subscriptions (
  household_id uuid not null references households on delete cascade,
  device_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  profil text not null check (profil in ('marc', 'melanie')),
  tz text not null,
  config jsonb not null default '{}'::jsonb,
  derniers_creneaux jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, device_id)
);

alter table push_subscriptions enable row level security;

drop policy if exists foyer_push_subscriptions on push_subscriptions;
create policy foyer_push_subscriptions on push_subscriptions for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
```

(Pas de publication realtime — la table ne sert qu'aux fonctions serveur.)

- [x] **Step 2: Commit + exécution réelle (avec Marc)**

```bash
git add supabase/migrations/0002_push_subscriptions.sql
git commit -m "feat: table push_subscriptions (RLS foyer)"
```

Puis Marc colle le contenu du fichier dans **SQL Editor** (Supabase Dashboard) → Run. Vérifier : table créée, RLS activée, 0 row.

---

### Task 2: Modules partagés — jwt.ts + rappels.ts (+ vecteurs)

**Files:**
- Create: `supabase/functions/_shared/jwt.ts`
- Create: `supabase/functions/_shared/rappels.ts`

- [x] **Step 1: `supabase/functions/_shared/jwt.ts`**

```ts
// Décodage du JWT foyer : la signature est déjà vérifiée par Supabase
// (déploiement SANS --no-verify-jwt pour ces fonctions) — on ne lit que les claims.
// Retourne le household_id, ou null si absent/illisible (→ 401 côté appelant).

const b64uDecode = (s: string): string =>
  atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

export const foyerDuJwt = (req: Request): string | null => {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const parties = token.split('.');
  if (parties.length !== 3) return null;
  try {
    const payload = JSON.parse(b64uDecode(parties[1]!)) as { household_id?: unknown };
    return typeof payload.household_id === 'string' && payload.household_id
      ? payload.household_id
      : null;
  } catch {
    return null;
  }
};
```

- [x] **Step 2: `supabase/functions/_shared/rappels.ts`** (logique pure — aucune API Deno)

```ts
// Logique pure des rappels : calcul "du" en fuseau local (Intl), messages, validation.
// Utilisée par push-rappels. Testée par vecteurs (script node, non commité).

export interface RappelConfig {
  type: 'seance' | 'pesee' | 'rituel';
  jours: number[]; // 0 = dimanche … 6 = samedi
  heure: string; // 'HH:MM'
}

const TYPES: RappelConfig['type'][] = ['seance', 'pesee', 'rituel'];

export const estRappel = (v: unknown): v is RappelConfig =>
  !!v &&
  typeof v === 'object' &&
  TYPES.includes((v as RappelConfig).type) &&
  Array.isArray((v as RappelConfig).jours) &&
  (v as RappelConfig).jours.every((j) => Number.isInteger(j) && j >= 0 && j <= 6) &&
  typeof (v as RappelConfig).heure === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test((v as RappelConfig).heure);

// Un push par rappel dû — titre seul (le corps est vide).
export const MESSAGE_RAPPEL: Record<RappelConfig['type'], string> = {
  seance: '💪 C’est l’heure de ta séance',
  pesee: '⚖️ C’est l’heure de ta pesée',
  rituel: '🧅 C’est l’heure du rituel du dimanche',
};

const JOURS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

export interface Locale {
  date: string; // YYYY-MM-DD (tz locale)
  heure: string; // HH:MM (tz locale)
  jour: number; // 0-6 (tz locale)
}

export const localeCourante = (tz: string, maintenant: Date): Locale => {
  const f = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
    new Intl.DateTimeFormat('fr-CA', { timeZone: tz, ...opts });
  return {
    date: f({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant),
    heure: new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(maintenant), // fr-CA : '08 h 03'
    jour: JOURS[f({ weekday: 'long' }).format(maintenant)] ?? 0,
  };
};

// Rappels dus : jour matche, heure atteinte, pas déjà envoyé aujourd'hui (dédup par type).
// tz invalide → aucun rappel (l'appareil est simplement ignoré).
export const rappelsDus = (
  rappels: RappelConfig[],
  tz: string,
  creneaux: Record<string, string>,
  maintenant: Date,
): RappelConfig[] => {
  let locale: Locale;
  try {
    locale = localeCourante(tz, maintenant);
  } catch {
    return [];
  }
  return rappels.filter(
    (r) => r.jours.includes(locale.jour) && locale.heure >= r.heure && creneaux[r.type] !== locale.date,
  );
};
```

- [x] **Step 3: Vecteurs (script node temporaire, non commité)** — `/tmp/verify-rappels.mjs` :

```js
// Reproduit _shared/rappels.ts (copie) et vérifie les cas limites.
const TYPES = ['seance', 'pesee', 'rituel'];
const JOURS = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const estRappel = (v) => !!v && typeof v === 'object' && TYPES.includes(v.type) &&
  Array.isArray(v.jours) && v.jours.every((j) => Number.isInteger(j) && j >= 0 && j <= 6) &&
  typeof v.heure === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.heure);
const localeCourante = (tz, maintenant) => {
  const f = (o) => new Intl.DateTimeFormat('fr-CA', { timeZone: tz, ...o }); // fr-CA : date ISO
  return {
    date: f({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant),
    heure: f({ hour: '2-digit', minute: '2-digit', hour12: false }).format(maintenant),
    jour: JOURS[f({ weekday: 'long' }).format(maintenant)] ?? 0,
  };
};
const rappelsDus = (rappels, tz, creneaux, maintenant) => {
  let locale;
  try { locale = localeCourante(tz, maintenant); } catch { return []; }
  return rappels.filter((r) => r.jours.includes(locale.jour) && locale.heure >= r.heure && creneaux[r.type] !== locale.date);
};

const r = { type: 'seance', jours: [1, 2, 3, 4, 5], heure: '08:00' }; // lun-ven 08:00
const ven0803 = new Date('2026-09-18T06:03:00Z'); // vendredi 08:03 Paris
const ven0759 = new Date('2026-09-18T05:59:00Z'); // vendredi 07:59 Paris
const sam0803 = new Date('2026-09-19T06:03:00Z'); // samedi 08:03 Paris
let ok = true;
const check = (nom, attendu, réel) => { const m = JSON.stringify(attendu) === JSON.stringify(réal); ok &&= m; console.log(m ? '✓' : `✗ ${nom} → ${JSON.stringify(réal)}`); };

check('vendredi 08:03 → due', 1, rappelsDus([r], 'Europe/Paris', {}, ven0803).length);
check('07:59 → pas encore', 0, rappelsDus([r], 'Europe/Paris', {}, ven0759).length);
check('samedi → pas due', 0, rappelsDus([r], 'Europe/Paris', {}, sam0803).length);
check('déjà envoyé aujourd’hui', 0, rappelsDus([r], 'Europe/Paris', { seance: '2026-09-18' }, ven0803).length);
check('tz invalide → ignorée', 0, rappelsDus([r], 'Mars/Olympus', {}, ven0803).length);
check('heure 24:00 invalide rejetée', false, estRappel({ type: 'seance', jours: [1], heure: '24:00' }));
check('rappel valide accepté', true, estRappel(r));
process.exit(ok ? 0 : 1);
```

- [x] **Step 4: Vérifier les vecteurs puis commit**

```bash
node /tmp/verify-rappels.mjs   # attendu : 7 × ✓, exit 0
git add supabase/functions/_shared/jwt.ts supabase/functions/_shared/rappels.ts
git commit -m "feat: modules partagés push (jwt + logique rappels)"
```

---

### Task 3: Edge function push-register

**Files:**
- Create: `supabase/functions/push-register/index.ts`

- [x] **Step 1: Écrire la fonction**

```ts
// Edge function — enregistrement d'une souscription push. JWT foyer requis
// (vérifié par la plateforme + claim household_id lue ici).
// POST { endpoint, p256dh, auth, profil, device_id, tz, config? } → 200.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { foyerDuJwt } from '../_shared/jwt.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
  try {
    const foyerId = foyerDuJwt(req);
    if (!foyerId) return new Response('unauthorized', { status: 401, headers: CORS });
    const { endpoint, p256dh, auth, profil, device_id, tz, config } = (await req.json()) as Record<string, unknown>;
    if (
      typeof endpoint !== 'string' || !endpoint ||
      typeof p256dh !== 'string' || !p256dh ||
      typeof auth !== 'string' || !auth ||
      typeof device_id !== 'string' || !device_id ||
      typeof tz !== 'string' || !tz ||
      (profil !== 'marc' && profil !== 'melanie')
    ) {
      return new Response('bad request', { status: 400, headers: CORS });
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { error } = await admin.from('push_subscriptions').upsert(
      {
        household_id: foyerId,
        device_id,
        endpoint,
        p256dh,
        auth,
        profil,
        tz,
        config: (config && typeof config === 'object' && !Array.isArray(config) ? config : {}) as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,device_id' },
    );
    if (error) return new Response('erreur serveur', { status: 500, headers: CORS });
    return new Response('ok', { headers: CORS });
  } catch {
    return new Response('bad request', { status: 400, headers: CORS });
  }
});
```

- [x] **Step 2: Deploy (verify_jwt ON — signature vérifiée par la plateforme)**

```bash
supabase functions deploy push-register --project-ref dkprqbfpjspvknbjwgcg
```

- [x] **Step 3: Test réel par curl (avec Marc)**

JWT foyer : console du navigateur sur l'app en prod → `localStorage.getItem('sportapp:sync:token')` (le token de session sync, JWT foyer). Puis :

```bash
TOKEN="<jwt foyer>"
curl -s -X POST "https://dkprqbfpjspvknbjwgcg.supabase.co/functions/v1/push-register" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"endpoint":"https://test.example/sub","p256dh":"x","auth":"y","profil":"marc","device_id":"test-bidon","tz":"Europe/Paris","config":{}}'
```

Attendu : `ok`. Vérifier dans SQL Editor : `select device_id, profil, tz from push_subscriptions;` → 1 row `test-bidon`. Puis le ménage :

```bash
# sans token → 401 ; avec mauvais profil → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://dkprqbfpjspvknbjwgcg.supabase.co/functions/v1/push-register" -H "Content-Type: application/json" -d '{}'
```

Attendu : `401`.

- [x] **Step 4: Commit**

```bash
git add supabase/functions/push-register/index.ts
git commit -m "feat: edge function push-register (JWT foyer, upsert par device)"
```

---

### Task 4: Edge function push-notifier

**Files:**
- Create: `supabase/functions/push-notifier/index.ts`

- [x] **Step 1: Écrire la fonction**

```ts
// Edge function — événements du foyer. JWT foyer requis.
// POST { type: 'diner'|'pesee'|'courses', auteur: 'marc'|'melanie', device_id, label }
// → push à toutes les souscriptions du foyer SAUF l'appelant, dont le toggle
// correspondant est actif (config.evenements[type] === true). 404/410 → purge.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { foyerDuJwt } from '../_shared/jwt.ts';
import { envoyerPush, type SubscriptionPush } from '../_shared/webpush.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRENOMS: Record<string, string> = { marc: 'Marc', melanie: 'Mélanie' };

const MESSAGES: Record<string, (auteur: string, label: string) => { titre: string; corps: string }> = {
  diner: (a, label) => ({ titre: "🍳 C'est prêt !", corps: `${a} a fait la recette "${label}"` }),
  pesee: (a, label) => ({ titre: '⚖️ Nouvelle pesée', corps: `${a} a ajouté une pesée : ${label}` }),
  courses: (a, label) => ({ titre: '🛒 Courses faites', corps: `${a} a fait les courses : ${label}` }),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
  try {
    const foyerId = foyerDuJwt(req);
    if (!foyerId) return new Response('unauthorized', { status: 401, headers: CORS });
    const { type, auteur, device_id, label } = (await req.json()) as Record<string, unknown>;
    if (
      (typeof type !== 'string' || !(type in MESSAGES)) ||
      (auteur !== 'marc' && auteur !== 'melanie') ||
      typeof device_id !== 'string' || !device_id ||
      typeof label !== 'string' || !label
    ) {
      return new Response('bad request', { status: 400, headers: CORS });
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('device_id, endpoint, p256dh, auth, tz, config')
      .eq('household_id', foyerId);
    if (error) return new Response('erreur serveur', { status: 500, headers: CORS });

    const vapid = {
      clePublique: Deno.env.get('VAPID_PUBLIC_KEY')!,
      clePrivee: Deno.env.get('VAPID_PRIVATE_KEY')!,
      sujet: Deno.env.get('VAPID_SUBJECT')!,
    };
    const msg = MESSAGES[type]!(PRENOMS[auteur]!, label);
    let envoyes = 0;
    for (const s of data ?? []) {
      if (s.device_id === device_id) continue; // l'auteur ne se notifie pas lui-même
      const evenements = (s.config as { evenements?: Record<string, unknown> } | null)?.evenements;
      if (evenements?.[type] !== true) continue; // toggle désactivé chez le destinataire
      const sub: SubscriptionPush = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      const res = await envoyerPush(sub, JSON.stringify({ title: msg.titre, body: msg.corps }), vapid);
      if (res.ok) envoyes++;
      else if (res.status === 404 || res.status === 410) {
        // subscription morte → purge silencieuse
        await admin.from('push_subscriptions').delete().eq('household_id', foyerId).eq('device_id', s.device_id);
      }
    }
    return new Response(JSON.stringify({ envoyes }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('bad request', { status: 400, headers: CORS });
  }
});
```

- [x] **Step 2: Deploy + test réel de bout en bout (avec Marc)**

```bash
supabase functions deploy push-notifier --project-ref dkprqbfpjspvknbjwgcg
```

1. Sur Chrome desktop (localhost, dev server actif) : ré-abonner si besoin (snippet du plan POC) → récupérer la subscription.
2. `push-register` avec **cette vraie subscription** (device_id `test-desktop`, config `{ "evenements": { "pesee": true } }`) → `ok`.
3. Déclencher un événement avec un device_id **différent** (simulateur d'auteur) :

```bash
curl -s -X POST "https://dkprqbfpjspvknbjwgcg.supabase.co/functions/v1/push-notifier" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"pesee","auteur":"melanie","device_id":"simulateur-melanie","label":"82,4 kg"}'
```

Attendu : `{"envoyes":1}` **ET la notification « ⚖️ Nouvelle pesée / Mélanie a ajouté une pesée : 82,4 kg » sur le Mac**. Re-test avec `"device_id":"test-desktop"` → `{"envoyes":0}` (auto-exclusion ✓) et avec toggle désactivé → `{"envoyes":0}`.

- [x] **Step 3: Commit**

```bash
git add supabase/functions/push-notifier/index.ts
git commit -m "feat: edge function push-notifier (événements foyer, exclusion appelant)"
```

---

### Task 5: Edge function push-rappels + cron

**Files:**
- Create: `supabase/functions/push-rappels/index.ts`

- [x] **Step 1: Écrire la fonction**

```ts
// Edge function — rappels planifiés, appelée par pg_cron (*/5 min).
// Auth : Bearer CRON_SECRET (déploiée --no-verify-jwt, le secret fait foi).
// Pour chaque souscription : rappels dus en tz locale → push + dédup du jour.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envoyerPush, type SubscriptionPush } from '../_shared/webpush.ts';
import { estRappel, localeCourante, MESSAGE_RAPPEL, rappelsDus } from '../_shared/rappels.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('unauthorized', { status: 401, headers: CORS });
  }
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.from('push_subscriptions').select('*');
    if (error) return new Response('erreur serveur', { status: 500, headers: CORS });

    const vapid = {
      clePublique: Deno.env.get('VAPID_PUBLIC_KEY')!,
      clePrivee: Deno.env.get('VAPID_PRIVATE_KEY')!,
      sujet: Deno.env.get('VAPID_SUBJECT')!,
    };
    const maintenant = new Date();
    let envoyes = 0;
    for (const s of data ?? []) {
      const rappels = (Array.isArray((s.config as { rappels?: unknown[] } | null)?.rappels)
        ? (s.config as { rappels: unknown[] }).rappels
        : []).filter(estRappel);
      if (rappels.length === 0) continue;
      const creneaux = (s.derniers_creneaux as Record<string, string> | null) ?? {};
      const dus = rappelsDus(rappels, s.tz, creneaux, maintenant);
      for (const r of dus) {
        const sub: SubscriptionPush = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
        const res = await envoyerPush(sub, JSON.stringify({ title: MESSAGE_RAPPEL[r.type] }), vapid);
        if (res.status === 404 || res.status === 410) {
          await admin.from('push_subscriptions').delete().eq('household_id', s.household_id).eq('device_id', s.device_id);
          continue;
        }
        if (res.ok) {
          envoyes++;
          creneaux[r.type] = localeCourante(s.tz, maintenant).date; // dédup : 1 envoi/jour/type
          await admin
            .from('push_subscriptions')
            .update({ derniers_creneaux: creneaux })
            .eq('household_id', s.household_id)
            .eq('device_id', s.device_id);
        }
      }
    }
    return new Response(JSON.stringify({ envoyes }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('erreur serveur', { status: 500, headers: CORS });
  }
});
```

- [x] **Step 2: Secret + deploy + job cron (avec Marc)**

```bash
supabase secrets set CRON_SECRET="$(openssl rand -hex 24)" --project-ref dkprqbfpjspvknbjwgcg
supabase functions deploy push-rappels --no-verify-jwt --project-ref dkprqbfpjspvknbjwgcg
```

Job cron — **SQL Editor** (one-off, le secret est celui généré ci-dessus) :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'push-rappels',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://dkprqbfpjspvknbjwgcg.supabase.co/functions/v1/push-rappels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
```

- [x] **Step 3: Test réel (avec Marc)**

1. Re-register la subscription desktop avec un rappel dû **dans 1-2 min** (config `{ "rappels": [{ "type": "rituel", "jours": [0,1,2,3,4,5,6], "heure": "HH:MM(dans 2 min)" }] }`).
2. Attendre le prochain tick cron (≤ 5 min) — ou déclencher manuellement : `curl -s -X POST ".../functions/v1/push-rappels" -H "Authorization: Bearer <CRON_SECRET>"` → `{"envoyes":1}` **ET notification « 🧅 C’est l’heure du rituel du dimanche »**.
3. Re-appel immédiat → `{"envoyes":0}` (dédup du jour ✓).
4. Sans secret → 401.

- [x] **Step 4: Commit**

```bash
git add supabase/functions/push-rappels/index.ts
git commit -m "feat: edge function push-rappels (cron 5 min, dédup par jour/type)"
```

---

## Après la phase 2

- Backend validé de bout en bout (register / notifier / rappels / purge 410 / dédup).
- **Phase 3 (front)** : `src/lib/push/` (device_id, souscrire, register, config), SW custom `injectManifest`, bloc Profil « Notifications », hooks d'événements post-flush, tests, PR — puis suppression de `push-poc` + `sw-poc.js`, docs (backend.md + CHANGELOG).
