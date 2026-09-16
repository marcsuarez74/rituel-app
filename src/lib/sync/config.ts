/// <reference types="vite/client" />

// Sync optionnelle : sans VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, l'app se
// comporte exactement comme avant (aucun code réseau chargé, aucune outbox).

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

const env = import.meta.env as ImportMetaEnv;

export const SUPABASE_URL: string | undefined = env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY: string | undefined = env.VITE_SUPABASE_ANON_KEY;

export const syncActif = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
