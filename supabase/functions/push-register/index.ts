// Edge function — enregistrement d'une souscription push. JWT foyer requis
// (vérifié par la plateforme + claim household_id lue ici).
// POST { endpoint, p256dh, auth, profil, device_id, tz, config? } → 200.
// DELETE { device_id } → désabonnement.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { foyerDuJwt } from '../_shared/jwt.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return new Response('method not allowed', { status: 405, headers: CORS });
  }
  try {
    const foyerId = foyerDuJwt(req);
    if (!foyerId) return new Response('unauthorized', { status: 401, headers: CORS });

    if (req.method === 'DELETE') {
      const { device_id } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      if (typeof device_id !== 'string' || !device_id) {
        return new Response('bad request', { status: 400, headers: CORS });
      }
      const { error } = await admin()
        .from('push_subscriptions')
        .delete()
        .eq('household_id', foyerId)
        .eq('device_id', device_id);
      if (error) return new Response('erreur serveur', { status: 500, headers: CORS });
      return new Response('ok', { headers: CORS });
    }

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
    const { error } = await admin().from('push_subscriptions').upsert(
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
