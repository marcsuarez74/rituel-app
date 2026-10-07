
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

// Période de semaine en format court pour la bannière : « 21 → 27 sept. » (même
// mois) ou « 30 sept. → 3 oct. » (mois différents). Réutilise MOIS_ABBR.
export const periodeCourte = (du: string, au: string): string => {
  const [, mDu, jDu] = du.split('-');
  const [, mAu, jAu] = au.split('-');
  const fin = `${Number(jAu)} ${MOIS_ABBR[Number(mAu) - 1] ?? ''}`.trim();
  if (mDu === mAu) return `${Number(jDu)} → ${fin}`;
  return `${Number(jDu)} ${MOIS_ABBR[Number(mDu) - 1] ?? ''} → ${fin}`;
};
