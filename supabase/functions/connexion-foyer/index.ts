// Edge function — connexion foyer. POST { code } → { token, foyer } | 401.
// Le code est vérifié contre households.code_hash (PBKDF2-SHA256, 100k iter).
// Le JWT HS256 est signé avec le JWT_SECRET du projet → les RLS Postgres
// lisent la claim household_id via auth.jwt().
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const enc = new TextEncoder();

const derive = async (code: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
};

const verifierHash = async (code: string, stocke: string): Promise<boolean> => {
  // format : pbkdf2-sha256$100000$<salt b64url>$<hash b64url>
  const [algo, iterStr, saltB64, hashB64] = stocke.split('$');
  if (algo !== 'pbkdf2-sha256') return false;
  const salt = Uint8Array.from(atob(saltB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const attendu = Uint8Array.from(atob(hashB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const calcule = await derive(code, salt, Number(iterStr));
  if (calcule.length !== attendu.length) return false;
  let diff = 0; // comparaison en temps constant
  for (let i = 0; i < attendu.length; i++) diff |= attendu[i]! ^ calcule[i]!;
  return diff === 0;
};

const signerJwt = async (foyerId: string, secret: string): Promise<string> => {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  // role 'anon' : PostgREST fait SET ROLE sur la claim role — un rôle custom
  // inexistant casserait chaque requête REST. Le rôle par défaut 'anon' ne
  // change rien : les policies RLS « for all » (PUBLIC) filtrent via
  // auth.jwt()->>'household_id'.
  const corps = b64url(enc.encode(JSON.stringify({ household_id: foyerId, role: 'anon', iat: now, exp: now + 365 * 24 * 3600 })));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${corps}`)));
  return `${head}.${corps}.${b64url(sig)}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
  try {
    const { code } = (await req.json()) as { code?: string };
    // garde < 6 : format minimum — le script creer-foyer impose ≥ 12,
    // la politique de force vit côté création.
    if (!code || code.length < 6) return new Response('unauthorized', { status: 401, headers: CORS });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.from('households').select('id, code_hash');
    if (error || !data || data.length !== 1) {
      // observabilité : aide au debug d'une misconfig (0 ou plusieurs foyers)
      console.error(`foyers trouvés: ${data?.length ?? 0} (attendu 1)`);
      return new Response('unauthorized', { status: 401, headers: CORS });
    }
    const foyer = data[0] as { id: string; code_hash: string };
    if (!(await verifierHash(code.trim(), foyer.code_hash))) {
      return new Response('unauthorized', { status: 401, headers: CORS });
    }
    const secret = Deno.env.get('JWT_SECRET');
    if (!secret) return new Response('server misconfigured', { status: 500, headers: CORS });
    const token = await signerJwt(foyer.id, secret);
    return new Response(JSON.stringify({ token, foyer: foyer.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('bad request', { status: 400, headers: CORS });
  }
});
