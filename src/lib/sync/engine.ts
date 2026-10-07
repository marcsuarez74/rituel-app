import {
  CLE_CYCLE,
  CLE_FOYER,
  CLE_PRECEDENT,
  cleReports,
  estCycleActifValide,
  estFoyerValide,
  estPrecedentValide,
  estReportValide,
  getReports,
  loadCycle,
  loadFoyer,
  loadPrecedent,
  saveCycle,
  saveFoyer,
  savePrecedent,
  saveReports,
  semaineCoches,
} from '../cycle/etat';
import type { ProfileKey, UserProfile } from '../model';
import {
  addWeight,
  deleteDepense,
  estProfilValide,
  getChecks,
  getDepenses,
  getWeights,
  loadProfile,
  saveDepense,
  saveProfile,
  setCheck,
} from '../storage';
import { creerClient, type RowSync, type SyncClient } from './client';
import { syncActif } from './config';
import {
  TABLES,
  empiler,
  lireOutbox,
  retirer,
  reprendreEmpilement,
  surEmpile,
  suspendreEmpilement,
  viderOutbox,
  type MutationSync,
  type TableSync,
} from './outbox';
import { demanderSession, definirSession, effacerSession, lireSession } from './session';

export type SyncEtat = 'off' | 'hors-foyer' | 'attente' | 'sync' | 'erreur';

let client: SyncClient | null = null;
let etat: SyncEtat = 'off';
let onEtatCb: ((e: SyncEtat) => void) | null = null;
// Enregistré par initSync : callback UI après application du remote (re-rendu).
let onRemote: (() => void) | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
// Debounce du realtime : rafale d'événements → un seul pull après 150 ms.
let pullTimer: ReturnType<typeof setTimeout> | null = null;
// Désabonnement realtime (posé par connecter, retiré par deconnecterFoyer).
let desabonner: (() => void) | null = null;
// Reconnexion du canal planifiée après une coupure (une seule en vol).
let reconnexionTimer: ReturnType<typeof setTimeout> | null = null;
// Génération du realtime installé : tout callback de statut d'une
// installation supplantée (canal retiré) est obsolète — la lib appelle
// CLOSED même pour un canal retiré volontairement.
let generationRealtime = 0;
// Fencing : une seule flush en vol, représentée par sa promesse partagée —
// les déclencheurs (mutations, realtime, réseau) peuvent se rafaler, les
// demandes concurrentes reçoivent la même promesse et re-programment un tour.
let flushPromise: Promise<void> | null = null;
// Retour du réseau : si le client n'existe pas (échec au démarrage), on
// relance la connexion ; sinon on rafale ce qui s'est empilé hors ligne.
const surEnLigne = (): void => {
  if (!client && lireSession()) {
    void connecter().catch(() => definirEtat('erreur'));
    return;
  }
  void flush();
};

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
  desabonner?.();
  desabonner = null;
  generationRealtime++; // les callbacks de statut en vol deviennent obsolètes
  window.removeEventListener('online', surEnLigne);
  client = null;
  etat = 'off';
  onEtatCb = null;
  onRemote = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = null;
  if (reconnexionTimer) clearTimeout(reconnexionTimer);
  reconnexionTimer = null;
  flushPromise = null;
  surEmpile(null);
  inited = false; // reset test : initSync rejouable
};

export const flush = (): Promise<void> => {
  if (flushPromise) {
    flushDiffere(); // demande pendant l'envol : re-programmer (retry avalé sinon)
    return flushPromise;
  }
  let ok = false;
  flushPromise = (async () => {
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
            // profiles et etat : payload enveloppé (colonne JSON serveur) —
            // checks/weights/depenses : colonnes scalaires (spread).
            ...(t === 'profiles' || t === 'etat'
              ? { payload: m.payload }
              : { ...m.payload }),
            household_id: foyerId,
            updated_at: new Date().toISOString(),
          }));
        if (rows.length > 0) await client.upsert(t, rows);
        const clefs = finales.filter((m) => m.op === 'delete').map((m) => m.key);
        if (clefs.length > 0) await client.supprimer(t, clefs);
      }
      // Déconnexion pendant la flush en vol : pas d'état 'sync' fantôme,
      // l'outbox reste en place pour un retry.
      if (!client || !lireSession()) return;
      for (const m of outbox) retirer(m);
      definirEtat('sync');
      ok = true;
    } catch {
      definirEtat('erreur'); // outbox conservée — retry au prochain déclencheur
    } finally {
      // Mutations empilées pendant l'envol (corps sans exception) : partent
      // au tour suivant. En échec, on reste sur les déclencheurs existants.
      if (ok && lireOutbox().length > 0) flushDiffere();
    }
  })();
  // La remise à null de la fence passe par .finally() sur la promesse — PAS
  // dans le corps : un corps sans await (outbox vide, session absente) se
  // termine de façon synchrone, AVANT l'affectation ci-dessus ; un null
  // interne serait écrasé par l'affectation et la promesse résolue resterait
  // posée pour toujours — tout flush suivant retomberait dans la fence.
  void flushPromise.finally(() => {
    flushPromise = null;
  });
  return flushPromise;
};

export const flushDiffere = (): void => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flush();
  }, 300);
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date_))) continue; // date_ illégale → ligne ignorée
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

// Une ligne de la table `etat` : valeur gardée (jamais persistée si illégale),
// écrite seulement si elle diffère du local. Clé inconnue → ignorée.
const idReports = (cle: string): string => (cle.startsWith(cleReports('')) ? cle.slice(cleReports('').length) : '');

const appliquerEtat = (cle: string, v: unknown): boolean => {
  const differe = (local: unknown) => JSON.stringify(local) !== JSON.stringify(v);
  if (cle === CLE_FOYER && estFoyerValide(v) && differe(loadFoyer())) saveFoyer(v);
  else if (cle === CLE_CYCLE && estCycleActifValide(v) && differe(loadCycle())) saveCycle(v);
  else if (cle === CLE_PRECEDENT && estPrecedentValide(v) && differe(loadPrecedent())) savePrecedent(v);
  else if (idReports(cle) && Array.isArray(v) && v.every(estReportValide) && differe(getReports(idReports(cle))))
    saveReports(idReports(cle), v);
  else return false;
  return true;
};

// Corps synchrone : garantit que la suspension d'empilement ne peut pas
// fuiter entre deux opérations entrelacées.
const appliquerRemoteSync = (rows: Record<TableSync, RowSync[]>): boolean => {
  const attente = clesOutbox();
  let change = false;
  for (const r of rows.checks) {
    const key = { semaine: String(r.semaine), check_id: String(r.check_id) };
    if (attente.has(signature('checks', key))) continue;
    if (!key.semaine || !key.check_id) continue; // clé vide → ignorée
    // 2.0 : seules les coches du cycle (cycle:{id}:{n}) ; celles des semaines
    // .md qu'un téléphone resté en 1.x pousserait encore ne reviennent pas.
    if (!key.semaine.startsWith('cycle:')) continue;
    if (getChecks(key.semaine)[key.check_id] !== r.done) {
      setCheck(key.semaine, key.check_id, r.done === true);
      change = true;
    }
  }

  for (const r of rows.weights) {
    const key = { profil: String(r.profil), date_: String(r.date_) };
    if (attente.has(signature('weights', key))) continue;
    if (key.profil !== 'marc' && key.profil !== 'melanie') continue; // profil inconnu → jamais de clé junk
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
    if (!estProfilValide(payload)) continue; // payload distant invalide → jamais persisté
    if (JSON.stringify(local) !== JSON.stringify(payload)) {
      saveProfile(payload);
      change = true;
    }
  }

  for (const r of rows.etat ?? []) {
    const cle = String(r.cle ?? '');
    if (!cle || attente.has(signature('etat', { cle }))) continue;
    const payload = r.payload as { valeur?: unknown } | null | undefined;
    if (appliquerEtat(cle, payload?.valeur)) change = true;
  }

  return change;
};

// Applique les lignes remote au localStorage — règle « outbox locale prime » :
// une clé en attente d'envoi ne reçoit PAS le remote (elle flushera sa valeur).
// L'empilement est suspendu : ce qui vient du serveur ne repart pas vers lui.
// Retourne true si au moins une écriture a eu lieu (pour ne re-rendre que là).
export const appliquerRemote = async (rows: Record<TableSync, RowSync[]>): Promise<boolean> => {
  suspendreEmpilement();
  try {
    return appliquerRemoteSync(rows);
  } finally {
    reprendreEmpilement();
  }
};

export const pull = async (): Promise<void> => {
  const c = client;
  if (!c) return;
  try {
    // Lectures parallèles : toutes les tables en 1 RTT au lieu d'un RTT par table.
    const listes = await Promise.all(TABLES.map((t) => c.toutLire(t)));
    if (!client || !lireSession()) return; // déconnexion pendant les lectures → n'écrit rien
    const rows = {} as Record<TableSync, RowSync[]>;
    TABLES.forEach((t, i) => {
      rows[t] = listes[i];
    });
    if (await appliquerRemote(rows)) onRemote?.();
    definirEtat('sync');
  } catch {
    definirEtat('erreur'); // symétrique de la flush : retry au prochain déclencheur
  }
};

// Empile TOUT l'état local à la connexion — fusion union : le local gagne
// via outbox-prime pendant le merge, puis flush pousse l'union. Passe par
// `empiler` directement (bypass de la gate de empilerMutation) : on est
// connecté à ce moment, c'est voulu.
const pousserCoches = (semaine: string): void => {
  for (const [check_id, done] of Object.entries(getChecks(semaine))) {
    empiler({
      op: 'upsert',
      table: 'checks',
      key: { semaine, check_id },
      payload: { done: done === true }, // valeur corrompue → jamais envoyée telle quelle
    });
  }
};

const pousserEtat = (cle: string, valeur: unknown): void =>
  empiler({ op: 'upsert', table: 'etat', key: { cle }, payload: { valeur } });

const pousserTout = (): void => {
  const foyer = loadFoyer();
  if (foyer) pousserEtat(CLE_FOYER, foyer);
  const precedent = loadPrecedent();
  if (precedent.length > 0) pousserEtat(CLE_PRECEDENT, precedent);
  const cycle = loadCycle();
  if (cycle) {
    pousserEtat(CLE_CYCLE, cycle);
    const reports = getReports(cycle.id);
    if (reports.length > 0) pousserEtat(cleReports(cycle.id), reports);
    for (let n = 0; n < 4; n++) pousserCoches(semaineCoches(cycle.id, n));
  }
  for (const p of ['marc', 'melanie'] as const) {
    for (const w of getWeights(p)) {
      empiler({
        op: 'upsert',
        table: 'weights',
        key: { profil: p, date_: w.date },
        payload: { kg: w.kg },
      });
    }
  }
  for (const d of getDepenses()) {
    empiler({
      op: 'upsert',
      table: 'depenses',
      key: { date_: d.date, magasin_key: d.magasin.toLowerCase() },
      payload: { magasin: d.magasin, total: d.total },
    });
  }
  const profil = loadProfile();
  if (profil) {
    empiler({ op: 'upsert', table: 'profiles', key: { profil: profil.id }, payload: { ...profil } });
  }
};

// Fusion union à la connexion : l'état local part d'abord (pousserTout →
// outbox), puis le remote est fusionné avec la règle outbox-prime (les clés
// locales gagnent), puis flush envoie l'union. Pas de branche vide/non-vide.
const postConnexion = async (): Promise<void> => {
  const c = client;
  if (!c || !lireSession()) return;
  definirEtat('attente');
  pousserTout();
  const listes = await Promise.all(TABLES.map((t) => c.toutLire(t)));
  if (!client || !lireSession()) return; // déconnexion pendant les lectures → n'écrit rien
  const rows = {} as Record<TableSync, RowSync[]>;
  TABLES.forEach((t, i) => {
    rows[t] = listes[i];
  });
  if (await appliquerRemote(rows)) onRemote?.();
  await flush();
};

// Coupure du canal : une seule reconnexion planifiée en vol (5 s), annulée
// par deconnecterFoyer/reinitialiser. No-op sans client ou sans session.
const planifierReconnexion = (): void => {
  if (reconnexionTimer) return;
  reconnexionTimer = setTimeout(() => {
    reconnexionTimer = null;
    if (client && lireSession()) installerRealtime();
  }, 5000);
};

// Installe (ou réinstalle) le realtime sur le client courant : événements
// data (pull debouncé) + statut du canal (coupure → erreur + reconnexion).
const installerRealtime = (): void => {
  if (!client) return;
  desabonner?.();
  const gen = ++generationRealtime;
  desabonner = client.abonner(
    () => {
      if (pullTimer) clearTimeout(pullTimer);
      pullTimer = setTimeout(() => {
        void pull();
      }, 150);
    },
    (ouvert) => {
      // Statut d'une installation supplantée ou app sans session : ignorer —
      // seul le canal courant pilote l'état.
      if (gen !== generationRealtime || !client || !lireSession()) return;
      if (ouvert) {
        if (etat !== 'sync') definirEtat('sync');
        if (pullTimer) clearTimeout(pullTimer);
        pullTimer = setTimeout(() => {
          void pull();
        }, 150); // rattrapage : récupérer ce que la coupure a fait manquer
        // La outbox peut contenir des mutations restées bloquées pendant la
        // coupure (pas d'event online si le réseau, lui, n'est pas tombé).
        // flush est fence et auto-correctrice : succès → sync, échec → erreur.
        void flush();
      } else {
        definirEtat('erreur');
        planifierReconnexion();
      }
    },
  );
};

// Installe le client + le realtime (idempotent) puis déclenche la
// post-connexion. Si un client est déjà posé (tests, reconnexion), on ne
// recrée rien — mais la post-connexion doit avoir lieu.
const connecter = async (): Promise<void> => {
  if (!client) {
    client = await creerClient();
  }
  installerRealtime();
  await postConnexion();
};

export const connecterFoyer = async (code: string): Promise<void> => {
  if (!syncActif()) throw new Error('sync-inactive');
  const session = await demanderSession(code.trim());
  definirSession(session.token, session.foyerId);
  try {
    await connecter();
  } catch (e) {
    // Session posée mais connexion échouée : l'état doit refléter l'erreur
    // (point rouge + tap réparateur), pas rester hors-foyer avec une session.
    if (lireSession()) definirEtat('erreur');
    throw e;
  }
};

export const deconnecterFoyer = (): void => {
  desabonner?.();
  desabonner = null;
  generationRealtime++; // les callbacks de statut en vol deviennent obsolètes
  client = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = null;
  if (reconnexionTimer) clearTimeout(reconnexionTimer);
  reconnexionTimer = null;
  viderOutbox();
  effacerSession();
  // hors-foyer (pas off) : le bloc Profil reste affiché avec le formulaire
  // de reconnexion — plus besoin de recharger la page pour se reconnecter.
  definirEtat('hors-foyer');
};

// Purge du foyer : le serveur est nettoyé AVANT le local — si le réseau
// échoue, session + outbox restent en place (retry possible) et l'état ne
// repasse 'hors-foyer' qu'après une purge confirmée.
export const purgerFoyer = async (): Promise<void> => {
  if (!client) throw new Error('pas-connecte');
  definirEtat('attente'); // purge engagée : plus 'hors-foyer', même en cas d'échec
  await flush(); // fence : les upserts en attente partent avant les deletes
  if (!client) return; // déconnexion pendant la flush → plus rien à purger
  await client.purger(); // serveur d'abord — jamais de données orphelines
  deconnecterFoyer();
};

// Amorçage une seule fois par chargement de l'app (idempotent).
let inited = false;

export const initSync = (
  opts: { onRemote?: () => void; onEtat?: (e: SyncEtat) => void } = {},
): void => {
  if (inited) return;
  inited = true;
  onRemote = opts.onRemote ?? null;
  onEtatCb = opts.onEtat ?? null;
  // Branché avant le gate syncActif : sans sync, empilerMutation est déjà un
  // no-op (gaté dans outbox) et la flush différée ne fait rien sans client.
  surEmpile(() => flushDiffere());
  if (!syncActif()) {
    definirEtat('off');
    return;
  }
  window.addEventListener('online', surEnLigne);
  const demarrer = async (): Promise<void> => {
    if (!lireSession()) {
      definirEtat('hors-foyer'); // sync prête, foyer non appairé : pas de point
      return;
    }
    try {
      await connecter();
      definirEtat('sync');
    } catch {
      definirEtat('erreur');
    }
  };
  void demarrer();
};

// Tap sur l'indicateur de la bannière. Client absent (échec au démarrage) :
// reconnecter d'abord — flush/pull sans client ne feraient rien. Sinon :
// re-sync manuelle séquentielle (flush puis pull — jamais en parallèle).
export const ressynchroniser = (): void => {
  void (async () => {
    if (!client && lireSession()) {
      try {
        await connecter();
      } catch {
        definirEtat('erreur');
      }
      return;
    }
    await flush();
    if (client) await pull();
  })();
};

// Ré-export pour l'UI (ProfilScreen) sans import direct de session —
// le engine reste le point d'entrée unique de la sync.
export const lireSessionPub = lireSession;
