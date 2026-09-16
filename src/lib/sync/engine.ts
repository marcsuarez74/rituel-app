import type { RowSync, SyncClient } from './client';
import { TABLES, lireOutbox, retirer } from './outbox';
import { lireSession } from './session';

export type SyncEtat = 'off' | 'attente' | 'sync' | 'erreur';

let client: SyncClient | null = null;
let etat: SyncEtat = 'off';
let onEtatCb: ((e: SyncEtat) => void) | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const definirEtat = (e: SyncEtat): void => {
  etat = e;
  onEtatCb?.(e);
};

export const etatSync = (): SyncEtat => etat;

// Tests : injection du faux client + remise à zéro de l'état module.
export const injecterClient = (c: SyncClient | null): void => {
  client = c;
};

export const reinitialiser = (): void => {
  client = null;
  etat = 'off';
  onEtatCb = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
};

export const flush = async (): Promise<void> => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!client || !lireSession()) return;
  const outbox = lireOutbox();
  if (outbox.length === 0) {
    definirEtat('sync');
    return;
  }
  const { foyerId } = lireSession()!;
  try {
    for (const t of TABLES) {
      const rows = outbox
        .filter((m) => m.table === t && m.op === 'upsert' && m.payload)
        .map<RowSync>((m) => ({
          ...m.key,
          ...m.payload,
          household_id: foyerId,
          updated_at: new Date().toISOString(),
        }));
      if (rows.length > 0) await client.upsert(t, rows);
      const clefs = outbox.filter((m) => m.table === t && m.op === 'delete').map((m) => m.key);
      if (clefs.length > 0) await client.supprimer(t, clefs);
    }
    for (const m of outbox) retirer(m);
    definirEtat('sync');
  } catch {
    definirEtat('erreur'); // outbox conservée — retry au prochain déclencheur
  }
};

export const flushDiffere = (): void => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flush();
  }, 2000);
};
