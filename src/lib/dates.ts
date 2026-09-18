export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

export const todayKey = (): (typeof JOURS)[number] => JOURS[(new Date().getDay() + 6) % 7];

// Date locale en `YYYY-MM-DD` (toISOString serait en UTC et décalerait d'un jour selon le fuseau).
export const todayISO = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// '2026-09-21' -> '21/09' (journal hebdo, l'année est superflue). Un simple split
// évite le parsing UTC de new Date sur la forme date-only.
export const formatDayMonth = (iso: string): string => {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
};

const MOIS_ABBR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Âge atteint, calculé en heure locale (split, jamais de new Date sur une date seule).
export const ageDepuis = (dateNaissance: string): number => {
  const [y, m, d] = dateNaissance.split('-').map(Number);
  const now = new Date();
  const moisNow = now.getMonth() + 1;
  const jourNow = now.getDate();
  let age = now.getFullYear() - y;
  if (moisNow < m || (moisNow === m && jourNow < d)) age -= 1;
  return age;
};

// Jours jusqu'à l'échéance, signé (négatif = dépassée). Calcul local date-only.
export const joursRestants = (echeance: string): number => {
  const [y, m, d] = echeance.split('-').map(Number);
  const now = new Date();
  const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cible = new Date(y, m - 1, d);
  return Math.round((cible.getTime() - aujourdhui.getTime()) / 86_400_000);
};

// '2026-12-15' -> '15 déc.' (bloc objectif).
export const formatJourMoisCourt = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MOIS_ABBR[Number(m) - 1] ?? ''}`.trim();
};

// '2026-S37' -> 'Semaine 37' (bannière compacte : l'année est superflue à l'écran).
export const libelleSemaineCourt = (semaine: string): string => {
  const m = semaine.match(/S(\d+)$/);
  return m ? `Semaine ${m[1]}` : `Semaine ${semaine}`;
};

const JOURS_ABBR: Record<string, string> = {
  lundi: 'lun.',
  mardi: 'mar.',
  mercredi: 'mer.',
  jeudi: 'jeu.',
  vendredi: 'ven.',
  samedi: 'sam.',
  dimanche: 'dim.',
};

export const jourAbrege = (jour: string): string => JOURS_ABBR[jour.toLowerCase()] ?? jour.toLowerCase();

const JOUR_PREFIXE_RE = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*[—–-]\s*(.+)$/i;

// 'Lundi — Muscu libre' -> { jour: 'lundi', reste: 'Muscu libre' } ; sans jour -> jour null.
export const extraireJourLabel = (label: string): { jour: string | null; reste: string } => {
  const m = label.match(JOUR_PREFIXE_RE);
  return m ? { jour: m[1].toLowerCase(), reste: m[2].trim() } : { jour: null, reste: label };
};
