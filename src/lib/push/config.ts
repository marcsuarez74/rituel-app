/// <reference types="vite/client" />

// Push optionnel : même posture que la sync — sans VITE_VAPID_PUBLIC_KEY,
// sans env Supabase ou sans foyer connecté, tout est no-op silencieux.

import { lireSession } from '../sync/session';
import { syncActif } from '../sync/config';

interface ImportMetaEnv {
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

const env = import.meta.env as ImportMetaEnv;

export const VAPID_PUBLIC_KEY: string | undefined = env.VITE_VAPID_PUBLIC_KEY;

export { SUPABASE_URL } from '../sync/config';

export const pushActif = (): boolean =>
  !!VAPID_PUBLIC_KEY && syncActif() && !!lireSession();
