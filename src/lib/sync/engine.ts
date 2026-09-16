import type { ImportedWeek, ProfileKey, UserProfile } from '../model';
import {
  addWeight,
  deleteDepense,
  getChecks,
  getDepenses,
  getWeights,
  loadProfile,
  loadWeeks,
  saveDepense,
  saveProfile,
  setCheck,
  upsertWeek,
} from '../storage';
import type { RowSync, SyncClient } from './client';
import { TABLES, lireOutbox, retirer, type MutationSync, type TableSync } from './outbox';
import { lireSession } from './session';

export type SyncEtat = 'off' | 'attente' | 'sync' | 'erreur';

let client: SyncClient | null = null;
let etat: SyncEtat = 'off';
let onEtatCb: ((e: SyncEtat) => void) | null = null;
// Enregistré par initSync : callback UI après application du remote (re-rendu).
let onRemote: (() => void) | null = null;
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
  onRemote = null;
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

const signature = (table: TableSync, key: Record<string, string>): string =>
  `${table}|${JSON.stringify(key)}`;

const clesOutbox = (): Set<string> =>
  new Set(lireOutbox().map((m) => signature(m.table, m.key)));

// Dépenses : le serveur fait foi (upsert + delete) → reconstruction complète.
// Les clés en attente d'outbox tranchent (elles flushent juste après).
const reconstruireDepenses = (remoteRows: RowSync[]): boolean => {
  const attente = lireOutbox().filter((m) => m.table === 'depenses');
  const clesAttente = new Set(attente.map((m) => `${m.key.date_}|${m.key.magasin_key}`));
  const cible = new Map<string, { date: string; magasin: string; total: number }>();
  for (const r of remoteRows) {
    const total = Number(r.total);
    if (!Number.isFinite(total) || total <= 0) continue;
    const date = String(r.date_);
    const magasinKey = String(r.magasin_key);
    if (clesAttente.has(`${date}|${magasinKey}`)) continue;
    cible.set(`${date}|${magasinKey}`, { date, magasin: String(r.magasin), total });
  }
  for (const m of attente) {
    if (m.op === 'upsert' && m.payload) {
      cible.set(`${m.key.date_}|${m.key.magasin_key}`, {
        date: m.key.date_,
        magasin: String(m.payload.magasin),
        total: Number(m.payload.total),
      });
    } // op delete : absent de la cible
  }
  const cibleTriee = [...cible.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.magasin.localeCompare(a.magasin),
  );
  const actuelles = getDepenses();
  const cleDe = (date: string, magasin: string): string => `${date}|${magasin.toLowerCase()}`;
  let change = false;
  for (const d of actuelles) {
    if (!cible.has(cleDe(d.date, d.magasin))) {
      deleteDepense(d.date, d.magasin);
      change = true;
    }
  }
  for (const d of cibleTriee) {
    const local = actuelles.find((x) => cleDe(x.date, x.magasin) === cleDe(d.date, d.magasin));
    if (!local || local.total !== d.total) {
      saveDepense(d.date, d.magasin, d.total);
      change = true;
    }
  }
  return change;
};

// Applique les lignes remote au localStorage — règle « outbox locale prime » :
// une clé en attente d'envoi ne reçoit PAS le remote (elle flushera sa valeur).
// Retourne true si au moins une écriture a eu lieu (pour ne re-rendre que là).
export const appliquerRemote = async (rows: Record<TableSync, RowSync[]>): Promise<boolean> => {
  const attente = clesOutbox();
  let change = false;

  for (const r of rows.weeks) {
    const key = { semaine: String(r.semaine) };
    if (attente.has(signature('weeks', key))) continue;
    const payload = r.payload as ImportedWeek | undefined;
    if (!payload?.data?.meta?.semaine) continue; // payload remote invalide → ignoré
    const local = loadWeeks()[key.semaine];
    if (local && local.raw === payload.raw) continue;
    upsertWeek(payload.raw, payload.data);
    change = true;
  }

  for (const r of rows.checks) {
    const key = { semaine: String(r.semaine), check_id: String(r.check_id) };
    if (attente.has(signature('checks', key))) continue;
    if (getChecks(key.semaine)[key.check_id] !== r.done) {
      setCheck(key.semaine, key.check_id, r.done === true);
      change = true;
    }
  }

  for (const r of rows.weights) {
    const key = { profil: String(r.profil), date_: String(r.date_) };
    if (attente.has(signature('weights', key))) continue;
    const kg = Number(r.kg);
    if (!Number.isFinite(kg) || kg <= 0) continue;
    const connu = getWeights(key.profil as ProfileKey).some(
      (w) => w.date === key.date_ && w.kg === kg,
    );
    if (!connu) {
      addWeight(key.profil as ProfileKey, key.date_, kg);
      change = true;
    }
  }

  if (reconstruireDepenses(rows.depenses)) change = true;

  for (const r of rows.profiles) {
    const key = { profil: String(r.profil) };
    if (attente.has(signature('profiles', key))) continue;
    const payload = r.payload as UserProfile | undefined;
    const local = loadProfile();
    if (!payload || payload.id !== local?.id) continue; // l'autre profil : pas de slot local
    if (JSON.stringify(local) !== JSON.stringify(payload)) {
      saveProfile(payload);
      change = true;
    }
  }

  return change;
};

export const pull = async (): Promise<void> => {
  if (!client) return;
  const rows = {} as Record<TableSync, RowSync[]>;
  for (const t of TABLES) rows[t] = await client.toutLire(t);
  if (await appliquerRemote(rows)) onRemote?.();
  definirEtat('sync');
};
