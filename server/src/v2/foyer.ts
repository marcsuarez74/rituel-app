import { createHmac, randomInt } from 'node:crypto';

// Code du foyer de l'app native : 6 caractères, sans caractère ambigu (0/O, 1/I/L)
// → 31^6 ≈ 887 millions de codes. Trop peu pour résister à un essai en masse :
// c'est le rate-limit de /v2/foyers/rejoindre qui protège, pas la longueur.
export const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 6;

export const genererCode = (): string =>
  Array.from({ length: LONGUEUR_CODE }, () => ALPHABET_CODE[randomInt(ALPHABET_CODE.length)]).join('');

// Saisie tolérante (minuscules, espaces, tirets) ; null si ce n'est pas un code possible.
export const normaliserCode = (saisie: unknown): string | null => {
  if (typeof saisie !== 'string') return null;
  const code = saisie.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== LONGUEUR_CODE) return null;
  return [...code].every((c) => ALPHABET_CODE.includes(c)) ? code : null;
};

// Secrets v2 dérivés du secret serveur (JWT_SECRET) : pas de nouvelle variable à poser,
// et un jeton v2 ne vérifie pas avec le secret de la PWA (ni l'inverse).
export const deriverSecret = (secret: string, usage: 'code-foyer' | 'jeton'): string =>
  createHmac('sha256', secret).update(`rituel-v2:${usage}`).digest('hex');

// Empreinte déterministe (HMAC) : recherche directe par égalité, code jamais stocké en clair.
export const empreinteCode = (code: string, secretCode: string): string =>
  createHmac('sha256', secretCode).update(code).digest('hex');
