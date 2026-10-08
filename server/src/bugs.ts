// "Signaler un bug" : validation, détection d'image et corps de l'issue GitHub.
// Le dépôt cible est PUBLIC : le corps ne contient jamais l'id du foyer ni de
// donnée de santé — uniquement ce que l'utilisateur écrit et des infos d'appareil.

export type TypeBug = 'bug' | 'amélioration';

export const TITRE_MIN = 3;
export const TITRE_MAX = 120;
export const DESC_MIN = 10;
export const DESC_MAX = 4000;
export const CAPTURE_MAX = 5 * 1024 * 1024;
export const QUOTA_JOUR = 3;

export const NOM_CAPTURE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/;

export const TYPES_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Extension déduite des magic bytes (le type MIME déclaré n'est pas fiable). */
export const extensionImage = (b: Uint8Array): 'png' | 'jpg' | 'webp' | null => {
  const eq = (debut: number, octets: number[]): boolean => octets.every((o, i) => b[debut + i] === o);
  if (b.length >= 8 && eq(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (b.length >= 3 && eq(0, [0xff, 0xd8, 0xff])) return 'jpg';
  if (b.length >= 12 && eq(0, [0x52, 0x49, 0x46, 0x46]) && eq(8, [0x57, 0x45, 0x42, 0x50])) return 'webp';
  return null;
};

export interface ChampsBug {
  titre: string;
  type: TypeBug;
  description: string;
}

const texte = (f: FormData, nom: string): string => {
  const v = f.get(nom);
  return typeof v === 'string' ? v.trim() : '';
};

/** Valide titre / type / description ; renvoie null si invalide. */
export const validerChamps = (f: FormData): ChampsBug | null => {
  const titre = texte(f, 'titre');
  const description = texte(f, 'description');
  const type = f.get('type');
  if (type !== 'bug' && type !== 'amélioration') return null;
  if (titre.length < TITRE_MIN || titre.length > TITRE_MAX) return null;
  if (description.length < DESC_MIN || description.length > DESC_MAX) return null;
  return { titre, type, description };
};

const CHAMPS_APPAREIL = ['version', 'page', 'appareil', 'navigateur', 'ecran', 'langue', 'installation'] as const;
type ChampAppareil = (typeof CHAMPS_APPAREIL)[number];
export type Appareil = Record<ChampAppareil, string>;

/** Infos d'appareil : JSON client, chaque valeur nettoyée et tronquée à 120 caractères. */
export const lireAppareil = (brut: unknown): Appareil => {
  let obj: Record<string, unknown> = {};
  if (typeof brut === 'string' && brut.length <= 4000) {
    try {
      const v: unknown = JSON.parse(brut);
      if (v && typeof v === 'object' && !Array.isArray(v)) obj = v as Record<string, unknown>;
    } catch {
      /* illisible → "inconnu" */
    }
  }
  const out = {} as Appareil;
  for (const k of CHAMPS_APPAREIL) {
    const v = obj[k];
    out[k] = typeof v === 'string' && v.trim() ? v.replace(/[\r\n`]/g, ' ').trim().slice(0, 120) : 'inconnu';
  }
  return out;
};

export const construireCorps = (
  champs: ChampsBug,
  appareil: Appareil,
  userAgent: string,
  urlCapture: string | null,
  maintenant: Date,
): string => {
  const lignes = [
    '## Description',
    '',
    champs.description,
    '',
    '## Contexte',
    '',
    `- Version de l'app : ${appareil.version}`,
    `- Écran d'origine : ${appareil.page}`,
    `- Appareil : ${appareil.appareil}`,
    `- Navigateur : ${appareil.navigateur}`,
    `- Écran : ${appareil.ecran}`,
    `- Langue : ${appareil.langue}`,
    `- Installation : ${appareil.installation}`,
    `- Date : ${maintenant.toISOString()}`,
  ];
  if (urlCapture) lignes.push('', '## Capture', '', `![capture](${urlCapture})`);
  lignes.push(
    '',
    '<details><summary>User-Agent brut</summary>',
    '',
    '```',
    userAgent.replace(/`/g, "'").slice(0, 300) || 'inconnu',
    '```',
    '',
    '</details>',
  );
  return lignes.join('\n');
};
