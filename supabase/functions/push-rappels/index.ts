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
