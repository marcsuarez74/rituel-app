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

const hkdf = async (
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  longueur: number,
): Promise<Uint8Array> => {
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
