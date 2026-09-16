import { syncActif } from './config';
import { lireSession } from './session';

export type TableSync = 'weeks' | 'checks' | 'weights' | 'depenses' | 'profiles';

// Mutation locale en attente d'envoi. `key` identifie la ligne (clé primaire
// sans household_id), `payload` porte la valeur (absent pour un delete).
export interface MutationSync {
  op: 'upsert' | 'delete';
  table: TableSync;
  key: Record<string, string>;
  payload?: Record<string, unknown>;
}

const OUTBOX_KEY = 'sportapp:sync:outbox';

export const lireOutbox = (): MutationSync[] => {
  const raw = localStorage.getItem(OUTBOX_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MutationSync[]) : [];
  } catch {
    console.warn(`Outbox corrompue ignorée : ${OUTBOX_KEY}`);
    localStorage.removeItem(OUTBOX_KEY);
    return [];
  }
};

const ecrireOutbox = (m: MutationSync[]): void => localStorage.setItem(OUTBOX_KEY, JSON.stringify(m));

const memeCle = (a: MutationSync, b: MutationSync): boolean =>
  a.op === b.op && a.table === b.table && JSON.stringify(a.key) === JSON.stringify(b.key);

const identique = (a: MutationSync, b: MutationSync): boolean =>
  memeCle(a, b) && JSON.stringify(a.payload ?? null) === JSON.stringify(b.payload ?? null);

// Dédoublonnage : une nouvelle mutation sur la même clé remplace l'ancienne —
// la flush enverra la valeur finale locale, pas l'historique.
export const empiler = (m: MutationSync): void => {
  ecrireOutbox([...lireOutbox().filter((x) => !memeCle(x, m)), m]);
};

// Ne retire que l'entrée strictement identique : une re-mutation arrivée
// pendant la flush (même clé, payload différent) survit.
export const retirer = (m: MutationSync): void => {
  ecrireOutbox(lireOutbox().filter((x) => !identique(x, m)));
};

export const viderOutbox = (): void => localStorage.removeItem(OUTBOX_KEY);

let auMoinsUneEmpile: (() => void) | null = null;

// Registré par engine.initSync : une mutation locale déclenche une flush différée.
export const surEmpile = (cb: (() => void) | null): void => {
  auMoinsUneEmpile = cb;
};

// Point d'entrée unique pour storage.ts : no-op tant que la sync n'est pas
// configurée (env absente) ou connectée (pas de token). L'app sans backend
// n'écrit JAMAIS d'outbox — zéro impact sur le comportement actuel.
export const empilerMutation = (m: MutationSync): void => {
  if (!syncActif() || !lireSession()) return;
  empiler(m);
  auMoinsUneEmpile?.();
};
