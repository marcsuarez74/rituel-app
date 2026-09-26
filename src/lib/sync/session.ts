import { SYNC_URL } from './config';

const TOKEN_KEY = 'sportapp:sync:token';
const FOYER_KEY = 'sportapp:sync:foyer';

export interface SessionFoyer {
  token: string;
  foyerId: string;
}

export const lireSession = (): SessionFoyer | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const foyerId = localStorage.getItem(FOYER_KEY);
  return token && foyerId ? { token, foyerId } : null;
};

export const definirSession = (token: string, foyerId: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(FOYER_KEY, foyerId);
};

export const effacerSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(FOYER_KEY);
};

const post = async (route: string, body: Record<string, string>): Promise<Response> =>
  fetch(`${SYNC_URL}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Connexion par code : { code } → { token, foyerId }. 401 = code refusé.
export const demanderSession = async (code: string): Promise<SessionFoyer> => {
  const res = await post('/connexion', { code });
  if (res.status === 401) throw new Error('code-refuse');
  if (!res.ok) throw new Error('indisponible');
  const { token, foyerId } = (await res.json()) as { token?: string; foyerId?: string };
  if (!token || !foyerId) throw new Error('reponse-invalide');
  return { token, foyerId };
};

// Création du foyer depuis l'app : { code } → { foyerId }. Le code n'est
// jamais stocké en clair côté serveur (PBKDF2) — impossible de le réafficher.
export const creerFoyer = async (code: string): Promise<{ foyerId: string }> => {
  const res = await post('/foyers', { code });
  if (res.status === 400) throw new Error('code-trop-court');
  if (res.status === 409) throw new Error('code-occupe');
  if (!res.ok) throw new Error('indisponible');
  const { foyerId } = (await res.json()) as { foyerId?: string };
  if (!foyerId) throw new Error('reponse-invalide');
  return { foyerId };
};

const MOTS = ['basilic', 'citron', 'sauge', 'romarin', 'thym', 'menthe', 'origan', 'estragon'];

// Phrase « mots d'herbes + 8 hex » — même générateur que l'ancien script CLI
// supabase/scripts/creer-foyer.mjs (ex. romarin-basilic-3f9a2c7e).
export const genererCodeFoyer = (): string => {
  const mot = (): string => MOTS[crypto.getRandomValues(new Uint32Array(1))[0]! % MOTS.length]!;
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${mot()}-${mot()}-${hex}`;
};
