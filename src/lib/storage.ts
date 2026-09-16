import type { DepenseEntry, ImportedWeek, ProfileKey, ProfilLegacy, UserProfile, WeeklyData } from './model';
import { normaliseComplement } from './model';
import { empilerMutation } from './sync/outbox';

const WEEK_KEY = 'sportapp:week';
const WEEKS_KEY = 'sportapp:weeks';
const PROFILE_KEY = 'sportapp:profile';
const checksKey = (s: string) => `sportapp:checks:${s}`;
const weightsKey = (p: string) => `sportapp:weights:${p}`;
const DEPENSES_KEY = 'sportapp:depenses';

const safeParse = <T>(key: string, raw: string | null, fallback: T): T => {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`Clé corrompue ignorée : ${key}`);
    localStorage.removeItem(key);
    return fallback;
  }
};

export interface WeightEntry {
  date: string;
  kg: number;
}

export const saveWeek = (raw: string, data: WeeklyData): void =>
  localStorage.setItem(
    WEEK_KEY,
    JSON.stringify({ raw, data, importedAt: new Date().toISOString() } satisfies ImportedWeek),
  );

export const loadWeek = (): ImportedWeek | null => {
  const s = localStorage.getItem(WEEK_KEY);
  if (!s) return null;
  const parsed = safeParse<ImportedWeek | null>(WEEK_KEY, s, null);
  if (!parsed || typeof parsed?.data?.meta?.semaine !== 'string') {
    console.warn(`Semaine corrompue ignorée : ${WEEK_KEY}`);
    localStorage.removeItem(WEEK_KEY);
    return null;
  }
  return parsed;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const estSemaineValide = (v: unknown): v is ImportedWeek =>
  isPlainObject(v) &&
  typeof v.raw === 'string' &&
  typeof v.importedAt === 'string' &&
  isPlainObject(v.data) &&
  isPlainObject(v.data.meta) &&
  typeof v.data.meta.semaine === 'string';

// Lecture du stock multi-semaines. Garde de forme PAR ENTRÉE : une semaine
// corrompue est retirée de la mémoire (warn), les autres sont gardées.
// Si le stock est absent/vide, l'ancienne clé sportapp:week est migrée dedans
// (l'ancienne clé reste en place, non écrite).
export const loadWeeks = (): Record<string, ImportedWeek> => {
  const raw = localStorage.getItem(WEEKS_KEY);
  if (raw === null) return migrerAncienneSemaine();
  const parsed = safeParse<unknown>(WEEKS_KEY, raw, null);
  if (!isPlainObject(parsed) || !isPlainObject(parsed.semaines)) {
    console.warn(`Semaines corrompues ignorées : ${WEEKS_KEY}`);
    localStorage.removeItem(WEEKS_KEY);
    return migrerAncienneSemaine();
  }
  const semaines: Record<string, ImportedWeek> = {};
  for (const [id, entry] of Object.entries(parsed.semaines)) {
    if (estSemaineValide(entry)) semaines[id] = entry;
    else console.warn(`Semaine corrompue ignorée : ${id}`);
  }
  return semaines;
};

const migrerAncienneSemaine = (): Record<string, ImportedWeek> => {
  const ancienne = loadWeek();
  if (!ancienne) return {};
  const semaines = { [ancienne.data.meta.semaine]: ancienne };
  localStorage.setItem(WEEKS_KEY, JSON.stringify({ semaines }));
  return semaines;
};

// Même meta.semaine -> remplace ; les autres semaines restent.
export const upsertWeek = (raw: string, data: WeeklyData): void => {
  const semaines = loadWeeks();
  semaines[data.meta.semaine] = {
    raw,
    data,
    importedAt: new Date().toISOString(),
  } satisfies ImportedWeek;
  localStorage.setItem(WEEKS_KEY, JSON.stringify({ semaines }));
  empilerMutation({
    op: 'upsert',
    table: 'weeks',
    key: { semaine: data.meta.semaine },
    payload: { ...semaines[data.meta.semaine] },
  });
};

export const getChecks = (semaine: string): Record<string, boolean> => {
  const key = checksKey(semaine);
  const raw = localStorage.getItem(key);
  if (raw === null) return {};
  const parsed = safeParse<unknown>(key, raw, null);
  if (!isPlainObject(parsed)) {
    console.warn(`Checks corrompus ignorés : ${key}`);
    localStorage.removeItem(key);
    return {};
  }
  return parsed as Record<string, boolean>;
};

export const setCheck = (semaine: string, id: string, done: boolean): void => {
  const c = getChecks(semaine);
  c[id] = done;
  localStorage.setItem(checksKey(semaine), JSON.stringify(c));
  empilerMutation({
    op: 'upsert',
    table: 'checks',
    key: { semaine, check_id: id },
    payload: { done },
  });
};

export const getWeights = (p: ProfileKey): WeightEntry[] => {
  const key = weightsKey(p);
  const raw = localStorage.getItem(key);
  if (raw === null) return [];
  const parsed = safeParse<unknown>(key, raw, null);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((w) => !!w && typeof w.date === 'string' && typeof w.kg === 'number')
  ) {
    console.warn(`Pesées corrompues ignorées : ${key}`);
    localStorage.removeItem(key);
    return [];
  }
  return parsed as WeightEntry[];
};

// Remplace l'entrée existante pour `date` (upsert) puis persiste.
export const addWeight = (p: ProfileKey, date: string, kg: number): WeightEntry[] => {
  const list = getWeights(p)
    .filter((w) => w.date !== date)
    .concat({ date, kg })
    .sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(weightsKey(p), JSON.stringify(list));
  empilerMutation({
    op: 'upsert',
    table: 'weights',
    key: { profil: p, date_: date },
    payload: { kg },
  });
  return list;
};

// Normalise un champ libre type « preferences » : trim, 40 caractères max,
// dédoublonnage insensible casse/accents (même règle que les compléments).
const normaliseChampsLibres = (list: string[]): string[] => {
  const out: string[] = [];
  for (const v of list) {
    const t = v.trim().slice(0, 40);
    if (t && !out.some((x) => normaliseComplement(x) === normaliseComplement(t))) out.push(t);
  }
  return out;
};

export const saveProfile = (profile: UserProfile): void => {
  const net: UserProfile = {
    ...profile,
    ...(profile.magasin !== undefined ? { magasin: profile.magasin.trim() } : {}),
    ...(profile.preferences !== undefined
      ? { preferences: normaliseChampsLibres(profile.preferences) }
      : {}),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(net));
  empilerMutation({ op: 'upsert', table: 'profiles', key: { profil: net.id }, payload: { ...net } });
};

export const removeProfile = (): void => {
  localStorage.removeItem(PROFILE_KEY);
};

const OBJECTIF_TYPES_VALIDES = ['perte', 'affiner', 'masse', 'maintien'];
const REGIMES_VALIDES = ['keto', 'vegetarien', 'vegan', 'sans-gluten', 'aucun'];

// Garde de forme du profil v2.1 — partagée entre la lecture locale (loadProfile)
// et le merge remote (engine) : un payload invalide n'est jamais persisté.
export const estProfilValide = (v: unknown): v is UserProfile => {
  const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  const isStr = (x: unknown): x is string => typeof x === 'string';
  const optionalNum = (x: unknown): boolean => x === undefined || isNum(x);
  const obj = isPlainObject(v) ? v.objectif : undefined;
  const complements = isPlainObject(v) ? v.complements : undefined;
  return (
    isPlainObject(v) &&
    (v.id === 'marc' || v.id === 'melanie') &&
    isStr(v.dateNaissance) &&
    isNum(v.taille) &&
    optionalNum(v.poidsObjectif) &&
    isPlainObject(obj) &&
    OBJECTIF_TYPES_VALIDES.includes(obj.type as string) &&
    (obj.echeance === undefined || isStr(obj.echeance)) &&
    Array.isArray(complements) &&
    complements.every(isStr) &&
    REGIMES_VALIDES.includes(v.regime as string)
  );
};

export const loadProfile = (): UserProfile | null => {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw === null) return null;
  const parsed = safeParse<unknown>(PROFILE_KEY, raw, null);
  if (!estProfilValide(parsed)) {
    console.warn(`Profil corrompu ignoré : ${PROFILE_KEY}`);
    localStorage.removeItem(PROFILE_KEY);
    return null;
  }
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const isStr = (v: unknown): v is string => typeof v === 'string';
  const optionalNum = (v: unknown): boolean => v === undefined || isNum(v);
  const optionalInt1a12 = (v: unknown): v is number =>
    v === undefined || (isNum(v) && Number.isInteger(v) && v >= 1 && v <= 12);
  const optionalPositif = (v: unknown): v is number => v === undefined || (isNum(v) && v > 0);
  const p = parsed as unknown as UserProfile;
  // Reconstruction explicite : les champs optionnels illégaux sont ignorés
  // (retirés), le profil reste valide — et les clés inconnues sont lâchées.
  return {
    id: p.id,
    dateNaissance: p.dateNaissance,
    taille: p.taille,
    ...(optionalNum(p.poidsObjectif) && p.poidsObjectif !== undefined
      ? { poidsObjectif: p.poidsObjectif }
      : {}),
    objectif: {
      type: p.objectif.type,
      ...(p.objectif.echeance !== undefined ? { echeance: p.objectif.echeance } : {}),
    },
    complements: [...p.complements],
    regime: p.regime,
    ...(isStr(p.magasin) && p.magasin.trim() ? { magasin: p.magasin.trim() } : {}),
    ...(optionalPositif(p.budgetMax) && p.budgetMax !== undefined ? { budgetMax: p.budgetMax } : {}),
    ...(Array.isArray(p.preferences) && p.preferences.every(isStr)
      ? { preferences: [...p.preferences] }
      : {}),
    ...(optionalInt1a12(p.personnes) && p.personnes !== undefined ? { personnes: p.personnes } : {}),
    ...(optionalInt1a12(p.repasJour) && p.repasJour !== undefined ? { repasJour: p.repasJour } : {}),
  };
};

// Ancienne forme du profil ({age}) — lecture read-only pour préremplir
// l'onboarding de migration. Pas de warn ni de remove : la clé est écrasée
// par le saveProfile v2, pas avant.
export const loadProfilLegacy = (): ProfilLegacy | null => {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw === null) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const optionalNum = (v: unknown): boolean => v === undefined || isNum(v);
  const ok =
    isPlainObject(parsed) &&
    (parsed.id === 'marc' || parsed.id === 'melanie') &&
    isNum(parsed.age) &&
    isNum(parsed.taille) &&
    optionalNum(parsed.poidsObjectif) &&
    optionalNum(parsed.kcalObjectif);
  return ok ? (parsed as unknown as ProfilLegacy) : null;
};

// Dépenses réelles de courses — tableau brut (convention sportapp:weights:*),
// trié par date desc. Garde de forme PAR ENTRÉE : une entrée illégale est
// rejetée (warn), les autres sont gardées. Tableau entier illégal → remove.
const estDepenseValide = (v: unknown): v is DepenseEntry =>
  isPlainObject(v) &&
  typeof v.date === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
  typeof v.magasin === 'string' &&
  v.magasin.trim().length > 0 &&
  typeof v.total === 'number' &&
  Number.isFinite(v.total) &&
  v.total > 0;

export const getDepenses = (): DepenseEntry[] => {
  const raw = localStorage.getItem(DEPENSES_KEY);
  if (raw === null) return [];
  const parsed = safeParse<unknown>(DEPENSES_KEY, raw, null);
  if (!Array.isArray(parsed)) {
    console.warn(`Dépenses corrompues ignorées : ${DEPENSES_KEY}`);
    localStorage.removeItem(DEPENSES_KEY);
    return [];
  }
  const out: DepenseEntry[] = [];
  for (const entry of parsed) {
    if (estDepenseValide(entry)) out.push(entry);
    else console.warn(`Dépense illégale ignorée : ${JSON.stringify(entry)}`);
  }
  return out;
};

// Upsert par (date, magasin). La casse du magasin est ignorée pour la
// correspondance (évite « lidl » + « Lidl » en doublon) : la première graphie
// saisie gagne — une re-sauvegarde sous une autre casse est ignorée, à
// graphie identique la dépense est remplacée. Trie par date desc (à date
// égale : ordre magasin descendant, cf. test « deux magasins le même jour »).
export const saveDepense = (date: string, magasin: string, total: number): DepenseEntry[] => {
  const mag = magasin.trim();
  const list = getDepenses();
  const existante = list.find(
    (d) => d.date === date && d.magasin.toLowerCase() === mag.toLowerCase(),
  );
  if (existante && existante.magasin !== mag) return list;
  const maj = list
    .filter((d) => !(d.date === date && d.magasin === mag))
    .concat({ date, magasin: mag, total })
    .sort((a, b) => b.date.localeCompare(a.date) || b.magasin.localeCompare(a.magasin));
  localStorage.setItem(DEPENSES_KEY, JSON.stringify(maj));
  empilerMutation({
    op: 'upsert',
    table: 'depenses',
    key: { date_: date, magasin_key: mag.toLowerCase() },
    payload: { magasin: mag, total },
  });
  return maj;
};

export const deleteDepense = (date: string, magasin: string): DepenseEntry[] => {
  const mag = magasin.toLowerCase();
  const list = getDepenses().filter(
    (d) => !(d.date === date && d.magasin.toLowerCase() === mag),
  );
  localStorage.setItem(DEPENSES_KEY, JSON.stringify(list));
  empilerMutation({
    op: 'delete',
    table: 'depenses',
    key: { date_: date, magasin_key: mag },
  });
  return list;
};
