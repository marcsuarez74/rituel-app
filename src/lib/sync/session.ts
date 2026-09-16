import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

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

// Appel de l'edge function connexion-foyer : { code } → { token, foyer }.
// 401 = code refusé. Le code de foyer ne vit nulle part ailleurs.
export const demanderSession = async (code: string): Promise<SessionFoyer> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/connexion-foyer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY! },
    body: JSON.stringify({ code }),
  });
  if (res.status === 401) throw new Error('code-refuse');
  if (!res.ok) throw new Error('indisponible');
  const { token, foyer } = (await res.json()) as { token?: string; foyer?: string };
  if (!token || !foyer) throw new Error('reponse-invalide');
  return { token, foyerId: foyer };
};
