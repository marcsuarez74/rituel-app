import type { RowSync, SyncClient } from './client';
import { TABLES, lireOutbox, retirer, type MutationSync } from './outbox';
import { lireSession } from './session';

export type SyncEtat = 'off' | 'attente' | 'sync' | 'erreur';

let client: SyncClient | null = null;
let etat: SyncEtat = 'off';
let onEtatCb: ((e: SyncEtat) => void) | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
// Single-flight : les déclencheurs (mutations, realtime, réseau) peuvent se
// rafaler — une seule flush à la fois.
let flushEnCours = false;

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
  flushEnCours = false;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
};

export const flush = async (): Promise<void> => {
  if (flushEnCours) return;
  flushEnCours = true;
  try {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const session = lireSession();
    if (!client || !session) return;
    const outbox = lireOutbox();
    if (outbox.length === 0) {
      definirEtat('sync');
      return;
    }
    const { foyerId } = session;
    for (const t of TABLES) {
      // Dernier op gagne par clé : un delete suivi d'une re-création hors
      // ligne ne doit pas finir supprimé côté serveur (et inversement).
      const derniereParCle = new Map<string, MutationSync>();
      for (const m of outbox) {
        if (m.table !== t) continue;
        derniereParCle.set(JSON.stringify(m.key), m);
      }
      const finales = [...derniereParCle.values()];
      const rows = finales
        .filter((m) => m.op === 'upsert' && m.payload)
        .map<RowSync>((m) => ({
          ...m.key,
          ...m.payload,
          household_id: foyerId,
          updated_at: new Date().toISOString(),
        }));
      if (rows.length > 0) await client.upsert(t, rows);
      const clefs = finales.filter((m) => m.op === 'delete').map((m) => m.key);
      if (clefs.length > 0) await client.supprimer(t, clefs);
    }
    for (const m of outbox) retirer(m);
    definirEtat('sync');
  } catch {
    definirEtat('erreur'); // outbox conservée — retry au prochain déclencheur
  } finally {
    flushEnCours = false;
  }
};

export const flushDiffere = (): void => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flush();
  }, 2000);
};
