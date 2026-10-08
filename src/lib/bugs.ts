import { SYNC_URL } from './sync/config';
import { lireSession } from './sync/session';

// « Signaler un bug » : le serveur de sync crée l'issue GitHub (le jeton GitHub
// ne quitte jamais le serveur). Réservé à un foyer connecté.

export type TypeSignalement = 'bug' | 'amélioration';

export const TITRE_MIN = 3;
export const TITRE_MAX = 120;
export const DESC_MIN = 10;
export const DESC_MAX = 4000;
export const CAPTURE_MAX = 5 * 1024 * 1024;
export const TYPES_CAPTURE = ['image/png', 'image/jpeg', 'image/webp'];

export type EtatSignalement = 'sync-off' | 'sans-foyer' | 'ok';

export const etatSignalement = (): EtatSignalement => {
  if (!SYNC_URL) return 'sync-off';
  return lireSession() ? 'ok' : 'sans-foyer';
};

export interface InfosAppareil {
  version: string;
  page: string;
  appareil: string;
  navigateur: string;
  ecran: string;
  langue: string;
  installation: string;
}

const nomAppareil = (ua: string): string => {
  if (/iPhone|iPad|iPod/.test(ua)) return `iOS ${/OS (\d+)[_\d]*/.exec(ua)?.[1] ?? '?'}`;
  if (/Android/.test(ua)) return `Android ${/Android (\d+)/.exec(ua)?.[1] ?? '?'}`;
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'inconnu';
};

const nomNavigateur = (ua: string): string => {
  const m = /(Edg|OPR|Firefox|FxiOS|CriOS|Chrome|Version)\/(\d+)/.exec(ua);
  if (!m) return 'inconnu';
  const noms: Record<string, string> = {
    Edg: 'Edge',
    OPR: 'Opera',
    Firefox: 'Firefox',
    FxiOS: 'Firefox',
    CriOS: 'Chrome',
    Chrome: 'Chrome',
    Version: 'Safari',
  };
  return `${noms[m[1] ?? ''] ?? 'inconnu'} ${m[2]}`;
};

/** Ce qui part avec le signalement : appareil et app uniquement, jamais de donnée perso ni de santé. */
export const infosAppareil = (page: string): InfosAppareil => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const standalone =
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    version: __APP_VERSION__,
    page,
    appareil: nomAppareil(ua),
    navigateur: nomNavigateur(ua),
    ecran: `${window.screen?.width ?? '?'} × ${window.screen?.height ?? '?'} @${window.devicePixelRatio ?? 1}x`,
    langue: navigator.language || 'inconnu',
    installation: standalone ? 'PWA installée' : 'navigateur',
  };
};

export type ResultatSignalement =
  | { ok: true; issueUrl: string }
  | { ok: false; raison: 'quota' | 'indisponible' | 'invalide' | 'session' | 'reseau' };

export const envoyerSignalement = async (s: {
  titre: string;
  type: TypeSignalement;
  description: string;
  capture?: File | null;
  page: string;
}): Promise<ResultatSignalement> => {
  const session = lireSession();
  if (!SYNC_URL || !session) return { ok: false, raison: 'session' };
  const form = new FormData();
  form.set('titre', s.titre.trim());
  form.set('type', s.type);
  form.set('description', s.description.trim());
  form.set('device', JSON.stringify(infosAppareil(s.page)));
  if (s.capture) form.set('capture', s.capture);
  try {
    // Pas de Content-Type manuel : le navigateur pose la frontière multipart.
    const res = await fetch(`${SYNC_URL}/bugs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
      body: form,
    });
    if (res.ok) {
      const j = (await res.json()) as { issueUrl?: string };
      return { ok: true, issueUrl: j.issueUrl ?? '' };
    }
    if (res.status === 429) return { ok: false, raison: 'quota' };
    if (res.status === 401) return { ok: false, raison: 'session' };
    if (res.status === 400 || res.status === 413) return { ok: false, raison: 'invalide' };
    return { ok: false, raison: 'indisponible' };
  } catch {
    return { ok: false, raison: 'reseau' };
  }
};
