import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const b64url = (b: Buffer): string => b.toString('base64url');
const b64urlVersBuffer = (s: string): Buffer => Buffer.from(s, 'base64url');

const ITERATIONS = 100_000;

// Format identique à l'ancien script supabase/scripts/creer-foyer.mjs.
export const hashCode = (code: string): string => {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(code, salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2-sha256$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
};

export const verifierCode = (code: string, stocke: string): boolean => {
  const [algo, iterations, salt64, hash64] = stocke.split('$');
  if (algo !== 'pbkdf2-sha256' || !iterations || !salt64 || !hash64) return false;
  const calcule = pbkdf2Sync(code, b64urlVersBuffer(salt64), Number(iterations), 32, 'sha256');
  const attendu = b64urlVersBuffer(hash64);
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu);
};

const claimsB64url = (v: unknown): string => b64url(Buffer.from(JSON.stringify(v), 'utf8'));

export const signerToken = (foyerId: string, secret: string, dureeS = 365 * 24 * 3600): string => {
  const t = Math.floor(Date.now() / 1000);
  const entete = claimsB64url({ alg: 'HS256', typ: 'JWT' });
  const corps = claimsB64url({ foyerId, iat: t, exp: t + dureeS });
  const signature = b64url(createHmac('sha256', secret).update(`${entete}.${corps}`).digest());
  return `${entete}.${corps}.${signature}`;
};

export const verifierToken = (token: string, secret: string): string | null => {
  const parties = token.split('.');
  if (parties.length !== 3) return null;
  const [entete, corps, signature] = parties;
  const recue = b64urlVersBuffer(signature);
  const attendue = createHmac('sha256', secret).update(`${entete}.${corps}`).digest();
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return null;
  try {
    const claims = JSON.parse(b64urlVersBuffer(corps).toString('utf8')) as {
      foyerId?: string;
      exp?: number;
    };
    if (!claims.foyerId || typeof claims.exp !== 'number') return null;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims.foyerId;
  } catch {
    return null;
  }
};
