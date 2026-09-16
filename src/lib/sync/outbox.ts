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

export const TABLES: readonly TableSync[] = ['weeks', 'checks', 'weights', 'depenses', 'profiles'];

const estObjet = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const estMutation = (v: unknown): v is MutationSync =>
  estObjet(v) &&
  (v.op === 'upsert' || v.op === 'delete') &&
  TABLES.includes(v.table as TableSync) &&
  estObjet(v.key) &&
  Object.values(v.key).every((x) => typeof x === 'string') &&
  (v.payload === undefined || estObjet(v.payload));

export const lireOutbox = (): MutationSync[] => {
  const raw = localStorage.getItem(OUTBOX_KEY);
  if (raw === null) return [];
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`Outbox corrompue ignorée : ${OUTBOX_KEY}`);
    localStorage.removeItem(OUTBOX_KEY);
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn(`Outbox corrompue ignorée : ${OUTBOX_KEY}`);
    localStorage.removeItem(OUTBOX_KEY);
    return [];
  }
  const outbox: MutationSync[] = [];
  for (const v of parsed) {
    if (estMutation(v)) outbox.push(v);
    else console.warn(`Mutation illégale ignorée dans l'outbox : ${JSON.stringify(v)}`);
  }
  if (outbox.length !== parsed.length) {
    if (outbox.length === 0) localStorage.removeItem(OUTBOX_KEY);
    else ecrireOutbox(outbox);
  }
  return outbox;
};

const ecrireOutbox = (m: MutationSync[]): void => localStorage.setItem(OUTBOX_KEY, JSON.stringify(m));

const memeCle = (a: MutationSync, b: MutationSync): boolean =>
  a.op === b.op && a.table === b.table && JSON.stringify(a.key) === JSON.stringify(b.key);

const identique = (a: MutationSync, b: MutationSync): boolean =>
  memeCle(a, b) && JSON.stringify(a.payload ?? null) === JSON.stringify(b.payload ?? null);

// Dédoublonnage : une nouvelle mutation remplace l'ancienne à (op, table, key)
// égal — la flush enverra la valeur finale locale. Upsert puis delete
// coexistent : ils convergent dans l'ordre.
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
