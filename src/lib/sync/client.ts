import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { TableSync } from './outbox';
import { lireSession } from './session';

export type RowSync = Record<string, unknown>;

export interface SyncClient {
  upsert: (table: TableSync, rows: RowSync[]) => Promise<void>;
  supprimer: (table: TableSync, clefs: Record<string, string>[]) => Promise<void>;
  toutLire: (table: TableSync) => Promise<RowSync[]>;
  purger: () => Promise<void>;
  abonner: (onEvenement: () => void) => () => void;
}

const TABLES: TableSync[] = ['weeks', 'checks', 'weights', 'depenses', 'profiles'];

const verifier = (error: { message: string } | null): void => {
  if (error) throw new Error(error.message);
};

// Port étroit sur supabase-js — dynamic import : l'app sans backend ne
// télécharge jamais cette dépendance (le chunk est séparé par le bundler).
export const creerClient = async (): Promise<SyncClient> => {
  const { createClient } = await import('@supabase/supabase-js');
  const { token, foyerId } = lireSession()!;
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  // Le realtime passe les RLS : il a besoin du JWT foyer lui aussi.
  try {
    supabase.realtime.setAuth(token);
  } catch {
    // version sans setAuth : REST seul, le pull reste fonctionnel
  }

  return {
    upsert: async (table, rows) => {
      const { error } = await supabase.from(table).upsert(rows);
      verifier(error);
    },
    supprimer: async (table, clefs) => {
      for (const cle of clefs) {
        let q = supabase.from(table).delete().eq('household_id', foyerId);
        for (const [k, v] of Object.entries(cle)) q = q.eq(k, v);
        const { error } = await q;
        verifier(error);
      }
    },
    toutLire: async (table) => {
      const { data, error } = await supabase.from(table).select('*').eq('household_id', foyerId);
      verifier(error);
      return (data ?? []) as RowSync[];
    },
    purger: async () => {
      for (const t of TABLES) {
        const { error } = await supabase.from(t).delete().eq('household_id', foyerId);
        verifier(error);
      }
    },
    abonner: (onEvenement) => {
      const canal = supabase.channel('sync-foyer');
      for (const t of TABLES) {
        canal.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: t, filter: `household_id=eq.${foyerId}` },
          () => onEvenement(),
        );
      }
      canal.subscribe();
      return () => {
        void supabase.removeChannel(canal);
      };
    },
  };
};
