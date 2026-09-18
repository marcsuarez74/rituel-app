# Notifications push — plan POC (phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Receiving a real push notification (sent by a Supabase edge function, standard Web Push VAPID) before building the full backend/front.

**Architecture:** edge function `push-poc` (temporary, `--no-verify-jwt`) → shared module `_shared/webpush.ts` (pure WebCrypto: VAPID JWT ES256 + aes128gcm encryption, RFC 8291/8292) → Chrome notification (desktop for the POC, phone at the end of the project). Temporary `public/sw-poc.js` minimal SW to allow `PushManager.subscribe` from localhost.

**Tech stack:** Deno (edge functions, already in place in `supabase/functions/`), WebCrypto, zero new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-18-notifications-push-design.md` — this plan covers **phase 1 only** (de-risking). Backend (phase 2) and front (phase 3) will be planned after the POC, with its conclusions.

**If the POC fails** (Deno/WebCrypto issue not resolved quickly): STOP, report BLOCKED to the controller — fallback `npm:web-push` (npm lib under node-compat) to be discussed, do not improvise alone.

> **Verdict (2026-09-18) — POC validated.** Notification received on Chrome
> desktop (`201` from FCM) after 2 fixes: (1) ECDH public key imported with
> **empty usages** `[]` (`Invalid key usage` otherwise) ; (2) derivation
> RFC 8291 §3.4 rewritten — `HKDF(salt=auth_secret, IKM=ecdh_secret, key_info,
> 32)` → IKM, then HKDF(salt, IKM, cek/nonce) — and `payload || 0x02` padding,
> **proven against the RFC's Appendix A test vectors** (IKM/CEK/NONCE 3/3).
> The pure WebCrypto implementation of `_shared/webpush.ts` is kept as-is for
> phase 2. Side note: Proxyman (local proxy) intercepted the FCM subscription —
> to be disabled during tests. `push-poc` and `sw-poc.js` removed at the start
> of phase 2.

---

## Preamble: worktree (once)

- [x] **Create worktree from main**

```bash
git worktree add .worktrees/push-poc -b feat/push-poc main
cd .worktrees/push-poc && npm install
```

Note: `supabase/` is **outside tsconfig** (cf. AGENTS.md) — edge functions are not covered by typecheck/vitest; their verification = deployment (Task 2).

---

### Task 1: SW POC + WebCrypto module + function

**Files:**
- Create: `public/sw-poc.js`
- Create: `supabase/functions/_shared/webpush.ts`
- Create: `supabase/functions/push-poc/index.ts`

- [x] **Step 1: `public/sw-poc.js`** — temporary minimal SW (removed at the end of the project; the real SW will be `src/sw.ts` in phase 3):

```js
// SW minimal — POC notifications push (temporaire, remplacé par src/sw.ts en phase 3).
self.addEventListener('push', (event) => {
  let titre = 'Rituel';
  let corps = 'Notification';
  try {
    const data = event.data ? event.data.json() : {};
    titre = data.title ?? titre;
    corps = data.body ?? corps;
  } catch {
    corps = event.data ? event.data.text() : corps;
  }
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: corps,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/rituel-app/'));
});
```

- [x] **Step 2: `supabase/functions/_shared/webpush.ts`** — complete send module (will be reused as-is by `push-register` / `push-notifier` / `push-rappels` in phase 2):

```ts
// Envoi Web Push standard — VAPID (RFC 8292) + chiffrement aes128gcm (RFC 8291),
// WebCrypto pur — compatible Deno, zéro dépendance.
// Clés VAPID au format web-push (npx web-push generate-vapid-keys) :
// clePublique = base64url 65 octets (0x04 | X | Y), clePrivee = base64url 32 octets.

export interface SubscriptionPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidConfig {
  clePublique: string;
  clePrivee: string;
  sujet: string; // mailto: ou https:
}

export const b64urlVersBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
};

const bytesVersB64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const hkdf = async (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, longueur: number): Promise<Uint8Array> => {
  const cle = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    cle,
    longueur * 8,
  );
  return new Uint8Array(bits);
};

const enc = new TextEncoder();

// JWT VAPID ES256 : x,y sont dérivés de la clé publique (0x04|X|Y), d = clé privée.
const signerVapid = async (vapid: VapidConfig, aud: string): Promise<string> => {
  const pub = b64urlVersBytes(vapid.clePublique);
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesVersB64url(pub.slice(1, 33)),
    y: bytesVersB64url(pub.slice(33, 65)),
    d: vapid.clePrivee,
  };
  const cle = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = bytesVersB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corps = bytesVersB64url(enc.encode(JSON.stringify({ aud, exp: now + 12 * 3600, sub: vapid.sujet })));
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, enc.encode(`${head}.${corps}`)),
  ); // WebCrypto : signature brute r||s (64 octets) — format ES256
  return `${head}.${corps}.${bytesVersB64url(sig)}`;
};

export const envoyerPush = async (
  sub: SubscriptionPush,
  payload: string,
  vapid: VapidConfig,
): Promise<{ ok: boolean; status: number; body: string }> => {
  // 1. ECDH éphémère + secret partagé (coordonnée X, 32 octets)
  const eph = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const pubEphemere = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const cleDest = await crypto.subtle.importKey(
    'raw',
    b64urlVersBytes(sub.keys.p256dh) as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );
  const secretPartage = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: cleDest }, eph.privateKey, 256),
  );

  // 2. HKDF (RFC 8291 §3.3) : prk_key (32) puis cek (16) + nonce (12)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = concat(b64urlVersBytes(sub.keys.auth), secretPartage);
  const infoPrk = concat(
    enc.encode('WebPush: info'),
    new Uint8Array([0]),
    b64urlVersBytes(sub.keys.p256dh),
    pubEphemere,
  );
  const prk = await hkdf(ikm, salt, infoPrk, 32);
  const cek = await hkdf(prk, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(prk, salt, enc.encode('Content-Encoding: nonce\0'), 12);

  // 3. AES-128-GCM : padding (2 octets, longueur 0) | payload
  const clair = concat(new Uint8Array([0, 0]), enc.encode(payload));
  const cleAes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const chiffre = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 },
      cleAes,
      clair as BufferSource,
    ),
  );

  // 4. Corps aes128gcm : salt(16) | rs(4) | idlen(1) | clé éphémère (65) | ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const corpsChiffre = concat(salt, rs, new Uint8Array([pubEphemere.length]), pubEphemere, chiffre);

  // 5. Envoi — 201 = livré ; 404/410 = subscription morte (à purger en phase 2)
  const aud = new URL(sub.endpoint).origin;
  const jwt = await signerVapid(vapid, aud);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.clePublique}`,
      TTL: '86400',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
    },
    body: corpsChiffre as unknown as BodyInit,
  });
  return { ok: res.status === 201, status: res.status, body: await res.text() };
};
```

- [x] **Step 3: `supabase/functions/push-poc/index.ts`** — temporary test function:

```ts
// Edge function POC — envoi d'un push de test. POST { endpoint, p256dh, auth, titre?, corps? }.
// Temporaire (--no-verify-jwt, sans auth foyer) : supprimée quand push-notifier existe.
import { envoyerPush, type SubscriptionPush } from '../_shared/webpush.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
  try {
    const { endpoint, p256dh, auth, titre, corps } = (await req.json()) as Record<string, string>;
    if (!endpoint || !p256dh || !auth) {
      return new Response('bad request', { status: 400, headers: CORS });
    }
    const sub: SubscriptionPush = { endpoint, keys: { p256dh, auth } };
    const payload = JSON.stringify({ title: titre ?? 'Rituel', body: corps ?? 'Push de test' });
    const res = await envoyerPush(sub, payload, {
      clePublique: Deno.env.get('VAPID_PUBLIC_KEY')!,
      clePrivee: Deno.env.get('VAPID_PRIVATE_KEY')!,
      sujet: Deno.env.get('VAPID_SUBJECT')!,
    });
    return new Response(JSON.stringify(res), {
      status: res.ok ? 200 : 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(`erreur: ${String(e)}`, { status: 500, headers: CORS });
  }
});
```

- [x] **Step 4: Commit**

```bash
git add public/sw-poc.js supabase/functions/_shared/webpush.ts supabase/functions/push-poc/index.ts
git commit -m "feat: POC push — webpush WebCrypto partagé + fonction test + sw minimal"
```

---

### Task 2: POC end-to-end (collaborative — Marc needed)

**Files:** none (deployment + real test). The `supabase login`/`link`/`secrets` commands require Marc's session — to be run together.

- [x] **Step 1: Generate VAPID keys** (local terminal, once):

```bash
npx web-push@3.6.7 generate-vapid-keys
```

Expected output: a `Public Key` and a `Private Key` (base64url). Keep — they are final (frontend + secrets).

- [x] **Step 2: Link + secrets + deploy** (with Marc — project already linked to docs/backend.md):

```bash
supabase login
supabase link --project-ref <ref du projet>     # depuis Settings → General de Supabase
supabase secrets set VAPID_PUBLIC_KEY="<clé publique>" \
                   VAPID_PRIVATE_KEY="<clé privée>" \
                   VAPID_SUBJECT="mailto:<email de Marc>"
supabase functions deploy push-poc --no-verify-jwt
```

Expected: `Deployed Functions push-poc` — output OK.

- [x] **Step 3: Subscribe from Chrome desktop** — run `npm run dev` in the worktree, open http://localhost:5173/rituel-app/ , then **DevTools console**:

```js
const reg = await navigator.serviceWorker.register('/rituel-app/sw-poc.js');
const ready = await navigator.serviceWorker.ready;
const cle = '<clé publique VAPID base64url>';
const sub = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle });
console.log(JSON.stringify(sub.toJSON()));
```

Expected: permission prompt → allow → the JSON `{ endpoint: "https://fcm.googleapis.com/...", keys: { p256dh, auth } }` in the console.

- [x] **Step 4: Send the push**

```bash
curl -s -X POST "https://<ref>.supabase.co/functions/v1/push-poc" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"<endpoint>","p256dh":"<p256dh>","auth":"<auth>","titre":"🍳 C est prêt !","corps":"Push de test depuis Deno"}'
```

Expected: `{"ok":true,"status":201,...}` AND **the notification appears on the Mac (Chrome desktop)** — even without the site open (SW awake by push).

- [x] **Step 5: Verdict + POC cleanup**

- Notification received → POC **validated**: WebCrypto implementation retained for phase 2 (no code changes).
- `status` 400/401 (bad encryption / VAPID rejected) → debug against RFC 8291 (salt/info order), STOP after 2 attempts and report.
- `npm run dev` can be stopped. The `push-poc` function and `sw-poc.js` are removed at the start of phase 2 (cleanup task).

- [x] **Step 6: Commit — POC validation note**

```bash
# cocher les cases de ce plan + note de verdict, puis :
git add docs/superpowers/plans/2026-09-18-notifications-push-poc.md
git commit -m "docs: POC push validé (201, notification reçue)"
```

---

## After the POC

- New plan: **phase 2 (backend)** — migration SQL (table + RLS + pg_cron), `push-register` / `push-notifier` / `push-rappels`, cleanup of the POC.
- Then plan: **phase 3 (front)** — `src/lib/push/`, SW custom `injectManifest`, Profile block, event hooks, tests, PR.
