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
