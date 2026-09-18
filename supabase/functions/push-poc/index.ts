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
