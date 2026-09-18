// Module push — souscription, enregistrement serveur, config par device,
// envoi d'événements. Toutes les fonctions sont no-op silencieuses tant que
// pushActif() est faux (pas d'env, pas de foyer, pas de clé VAPID) : l'app
// locale reste strictement locale.

import { loadProfile } from '../storage';
import { lireSession } from '../sync/session';
import { SUPABASE_URL, VAPID_PUBLIC_KEY, pushActif } from './config';

export interface RappelPush {
  type: 'seance' | 'pesee' | 'rituel';
  jours: number[]; // 0 = dimanche … 6 = samedi
  heure: string; // 'HH:MM'
}

export interface PushConfig {
  evenements: { diner: boolean; pesee: boolean; courses: boolean };
  rappels: RappelPush[];
}

export type EvenementType = 'diner' | 'pesee' | 'courses';

const DEVICE_KEY = 'sportapp:push:device';

export const configDefaut = (): PushConfig => ({
  evenements: { diner: false, pesee: false, courses: false },
  rappels: [],
});

// uuid généré une fois par installation, persisté en localStorage.
export const deviceId = (): string => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
};

// base64url → bytes (clé VAPID d'applicationServerKey).
const b64urlVersBytes = (s: string): Uint8Array => {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
};

const postHeaders = (): Record<string, string> => {
  const session = lireSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.token ?? ''}`,
  };
};

const enregistrer = async (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  config: PushConfig,
): Promise<boolean> => {
  if (!SUPABASE_URL) return false;
  const profil = loadProfile();
  if (!profil || (profil.id !== 'marc' && profil.id !== 'melanie')) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/push-register`, {
      method: 'POST',
      headers: postHeaders(),
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        profil: profil.id,
        device_id: deviceId(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        config,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

const registrationActive = async (): Promise<PushManagerJS> => {
  const reg = await navigator.serviceWorker.ready;
  return reg as unknown as PushManagerJS;
};

interface PushManagerJS {
  pushManager: {
    subscribe(o: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<{
      endpoint: string;
      keys: { p256dh: string; auth: string };
      toJSON(): { endpoint: string; keys: { p256dh: string; auth: string } };
    }>;
    getSubscription(): Promise<
      | null
      | {
          endpoint: string;
          keys: { p256dh: string; auth: string };
          toJSON(): { endpoint: string; keys: { p256dh: string; auth: string } };
          unsubscribe(): Promise<boolean>;
        }
    >;
  };
}

// Permission sur geste utilisateur → souscription → POST push-register.
export const souscrireEtEnregistrer = async (config: PushConfig): Promise<boolean> => {
  if (!pushActif() || !VAPID_PUBLIC_KEY) return false;
  try {
    if ((await Notification.requestPermission()) !== 'granted') return false;
    const reg = await registrationActive();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlVersBytes(VAPID_PUBLIC_KEY),
    });
    return await enregistrer(sub, config);
  } catch {
    return false;
  }
};

// Re-POST de la config sur la souscription existante ; sans souscription,
// bascule sur la souscription complète (idempotent).
export const majConfig = async (config: PushConfig): Promise<boolean> => {
  if (!pushActif()) return false;
  try {
    const reg = await registrationActive();
    const existante = await reg.pushManager.getSubscription();
    if (existante) return await enregistrer(existante, config);
    return await souscrireEtEnregistrer(config);
  } catch {
    return false;
  }
};

// Désactivation : unsubscribe local + DELETE serveur (le device sort de la liste).
export const desabonner = async (): Promise<void> => {
  if (!SUPABASE_URL) return;
  try {
    const reg = await registrationActive();
    const existante = await reg.pushManager.getSubscription();
    if (!existante) return;
    await existante.unsubscribe();
    await fetch(`${SUPABASE_URL}/functions/v1/push-register`, {
      method: 'DELETE',
      headers: postHeaders(),
      body: JSON.stringify({ device_id: deviceId() }),
    });
  } catch {
    /* no-op : la purge 404/410 du serveur fait le ménage au pire */
  }
};

// Événement foyer (après flush confirmée uniquement) — le serveur filtre les
// destinataires (toggles + exclusion du device appelant).
export const envoyerEvenement = async (type: EvenementType, label: string): Promise<void> => {
  if (!pushActif() || !SUPABASE_URL) return;
  const profil = loadProfile();
  if (!profil || (profil.id !== 'marc' && profil.id !== 'melanie')) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/push-notifier`, {
      method: 'POST',
      headers: postHeaders(),
      body: JSON.stringify({ type, auteur: profil.id, device_id: deviceId(), label }),
    });
  } catch {
    /* no-op : un push perdu ne justifie pas d'état d'erreur */
  }
};
