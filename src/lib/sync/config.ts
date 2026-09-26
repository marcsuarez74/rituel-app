/// <reference types="vite/client" />

// Sync optionnelle : sans VITE_SYNC_URL, l'app se comporte exactement comme
// avant (aucune requête réseau, aucune outbox).

interface ImportMetaEnv {
  readonly VITE_SYNC_URL?: string;
}

const env = import.meta.env as ImportMetaEnv;

export const SYNC_URL: string | undefined = env.VITE_SYNC_URL;

export const syncActif = (): boolean => !!SYNC_URL;
