// Logique pure des rappels : calcul "du" en fuseau local (Intl), messages, validation.
// Utilisée par push-rappels. Testée par vecteurs (script node, non commité).

export interface RappelConfig {
  type: 'seance' | 'pesee' | 'rituel';
  jours: number[]; // 0 = dimanche … 6 = samedi
  heure: string; // 'HH:MM'
}

const TYPES: RappelConfig['type'][] = ['seance', 'pesee', 'rituel'];

export const estRappel = (v: unknown): v is RappelConfig =>
  !!v &&
  typeof v === 'object' &&
  TYPES.includes((v as RappelConfig).type) &&
  Array.isArray((v as RappelConfig).jours) &&
  (v as RappelConfig).jours.every((j) => Number.isInteger(j) && j >= 0 && j <= 6) &&
  typeof (v as RappelConfig).heure === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test((v as RappelConfig).heure);

// Un push par rappel dû — titre seul (le corps est vide).
export const MESSAGE_RAPPEL: Record<RappelConfig['type'], string> = {
  seance: '💪 C’est l’heure de ta séance',
  pesee: '⚖️ C’est l’heure de ta pesée',
  rituel: '🧅 C’est l’heure du rituel du dimanche',
};

const JOURS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

export interface Locale {
  date: string; // YYYY-MM-DD (tz locale) — fr-CA donne l'ISO
  heure: string; // HH:MM (tz locale) — fr-FR donne '08:03' (fr-CA : '08 h 03')
  jour: number; // 0-6 (tz locale)
}

export const localeCourante = (tz: string, maintenant: Date): Locale => {
  const f = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
    new Intl.DateTimeFormat('fr-CA', { timeZone: tz, ...opts });
  return {
    date: f({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant),
    heure: new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(maintenant),
    jour: JOURS[f({ weekday: 'long' }).format(maintenant)] ?? 0,
  };
};

// Rappels dus : jour matche, heure atteinte, pas déjà envoyé aujourd'hui (dédup par type).
// tz invalide → aucun rappel (l'appareil est simplement ignoré).
export const rappelsDus = (
  rappels: RappelConfig[],
  tz: string,
  creneaux: Record<string, string>,
  maintenant: Date,
): RappelConfig[] => {
  let locale: Locale;
  try {
    locale = localeCourante(tz, maintenant);
  } catch {
    return [];
  }
  return rappels.filter(
    (r) => r.jours.includes(locale.jour) && locale.heure >= r.heure && creneaux[r.type] !== locale.date,
  );
};
