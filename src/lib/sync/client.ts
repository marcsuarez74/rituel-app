import { SYNC_URL } from './config';
import type { TableSync } from './outbox';
import { abonnerSse } from './sse';
import { lireSession } from './session';

export type RowSync = Record<string, unknown>;

export interface SyncClient {
  upsert: (table: TableSync, rows: RowSync[]) => Promise<void>;
  supprimer: (table: TableSync, clefs: Record<string, string>[]) => Promise<void>;
  toutLire: (table: TableSync) => Promise<RowSync[]>;
  purger: () => Promise<void>;
  abonner: (onEvenement: () => void, onStatut?: (ouvert: boolean) => void) => () => void;
}

// Port étroit sur l'API du VPS — fetch natif, zéro dépendance. L'app sans
// VITE_SYNC_URL n'appelle jamais creerClient (gate syncActif de l'engine) :
// aucun réseau.
export const creerClient = async (): Promise<SyncClient> => {
  const session = lireSession()!;
  const entetes = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${lireSession()?.token ?? session.token}`,
  });
  const verifier = async (res: Response): Promise<void> => {
    if (!res.ok) throw new Error(`sync-${res.status}`);
  };

  return {
    upsert: async (table, rows) => {
      const res = await fetch(`${SYNC_URL}/sync/${table}`, {
        method: 'POST',
        headers: entetes(),
        body: JSON.stringify({ rows }),
      });
      await verifier(res);
    },
    supprimer: async (table, clefs) => {
      const res = await fetch(`${SYNC_URL}/sync/${table}`, {
        method: 'DELETE',
        headers: entetes(),
        body: JSON.stringify({ clefs }),
      });
      await verifier(res);
    },
    toutLire: async (table) => {
      const res = await fetch(`${SYNC_URL}/sync/${table}`, { headers: entetes() });
      await verifier(res);
      const { rows } = (await res.json()) as { rows?: RowSync[] };
      return rows ?? [];
    },
    purger: async () => {
      const res = await fetch(`${SYNC_URL}/sync`, { method: 'DELETE', headers: entetes() });
      await verifier(res);
    },
    abonner: (onEvenement, onStatut) =>
      abonnerSse(`${SYNC_URL}/evenements`, session.token, onEvenement, (ouvert) =>
        onStatut?.(ouvert),
      ),
  };
};
