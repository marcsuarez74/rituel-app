import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ url: 'https://rituel.example.fr' as string | undefined }));
vi.mock('../src/lib/sync/config', () => ({
  get SYNC_URL() {
    return config.url;
  },
  syncActif: () => !!config.url,
}));

import { SignalerBug } from '../src/components/ecrans/SignalerBug';
import { envoyerSignalement, etatSignalement, infosAppareil } from '../src/lib/bugs';

const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'ecran.png', { type: 'image/png' });

const connecter = () => {
  localStorage.setItem('sportapp:sync:token', 'jeton-foyer');
  localStorage.setItem('sportapp:sync:foyer', 'foyer-1');
};

const repondre = (status: number, corps: unknown = { ok: true, issueUrl: 'https://github.com/o/r/issues/7', issueNumber: 7 }) =>
  vi.fn(async () => new Response(JSON.stringify(corps), { status }));

beforeEach(() => {
  localStorage.clear();
  config.url = 'https://rituel.example.fr';
});
afterEach(() => vi.unstubAllGlobals());

describe('lib/bugs', () => {
  it('etatSignalement : sync-off sans URL, sans-foyer sans session, ok sinon', () => {
    config.url = undefined;
    expect(etatSignalement()).toBe('sync-off');
    config.url = 'https://rituel.example.fr';
    expect(etatSignalement()).toBe('sans-foyer');
    connecter();
    expect(etatSignalement()).toBe('ok');
  });

  it("infosAppareil ne contient ni id de foyer ni donnée de santé, valeurs bornées", () => {
    connecter();
    localStorage.setItem('sportapp:weights:marc', '[{"kg":80}]');
    const infos = infosAppareil('profil');
    const json = JSON.stringify(infos);
    expect(json).not.toContain('foyer-1');
    expect(json).not.toContain('jeton-foyer');
    expect(json).not.toContain('80');
    expect(infos.page).toBe('profil');
    expect(infos.version).toBeTruthy();
  });

  it('envoie un multipart authentifié vers SYNC_URL/bugs', async () => {
    connecter();
    const f = repondre(200);
    vi.stubGlobal('fetch', f);
    const r = await envoyerSignalement({
      titre: 'Un titre',
      type: 'bug',
      description: 'Une description assez longue',
      capture: PNG,
      page: 'profil',
    });
    expect(r).toEqual({ ok: true, issueUrl: 'https://github.com/o/r/issues/7' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://rituel.example.fr/bugs');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-foyer');
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    const corps = init.body as FormData;
    expect(corps.get('titre')).toBe('Un titre');
    expect(corps.get('type')).toBe('bug');
    expect(corps.get('capture')).toBeInstanceOf(File);
    expect(String(corps.get('device'))).not.toContain('foyer-1');
  });

  it.each([
    [429, 'quota'],
    [503, 'indisponible'],
    [502, 'indisponible'],
    [400, 'invalide'],
    [401, 'session'],
  ])('statut %i → %s', async (status, raison) => {
    connecter();
    vi.stubGlobal('fetch', repondre(status, { erreur: 'x' }));
    const r = await envoyerSignalement({ titre: 'abc', type: 'bug', description: '0123456789', page: 'profil' });
    expect(r).toEqual({ ok: false, raison });
  });

  it('erreur réseau → reseau', async () => {
    connecter();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const r = await envoyerSignalement({ titre: 'abc', type: 'bug', description: '0123456789', page: 'profil' });
    expect(r).toEqual({ ok: false, raison: 'reseau' });
  });
});

describe('SignalerBug (écran)', () => {
  it('sans VITE_SYNC_URL : écran explicatif, pas de formulaire, pas de crash', () => {
    config.url = undefined;
    render(<SignalerBug onRetour={() => {}} page="profil" />);
    expect(screen.getByText(/pas disponible dans cette version/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/titre/i)).toBeNull();
  });

  it('sans foyer : explique qu’il faut connecter un foyer (Profil › Foyer)', () => {
    render(<SignalerBug onRetour={() => {}} page="profil" />);
    expect(screen.getByText(/Profil › Foyer/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/titre/i)).toBeNull();
  });

  it('valide les bornes avant envoi : bouton désactivé tant que titre/description sont trop courts', async () => {
    connecter();
    const user = userEvent.setup();
    render(<SignalerBug onRetour={() => {}} page="profil" />);
    const envoyer = screen.getByRole('button', { name: /envoyer/i });
    expect(envoyer).toBeDisabled();
    await user.type(screen.getByLabelText(/titre/i), 'Ab');
    await user.type(screen.getByLabelText(/description/i), 'court');
    expect(envoyer).toBeDisabled();
    await user.type(screen.getByLabelText(/titre/i), 'c');
    await user.type(screen.getByLabelText(/description/i), ' mais ok maintenant');
    expect(envoyer).toBeEnabled();
  });

  it('affiche les informations envoyées (transparence)', () => {
    connecter();
    render(<SignalerBug onRetour={() => {}} page="profil" />);
    expect(screen.getByText(/Informations envoyées/i)).toBeInTheDocument();
  });

  it('envoie puis affiche l’écran de succès avec le lien de l’issue', async () => {
    connecter();
    vi.stubGlobal('fetch', repondre(200));
    const user = userEvent.setup();
    render(<SignalerBug onRetour={() => {}} page="profil" />);
    await user.type(screen.getByLabelText(/titre/i), 'Mon titre');
    await user.type(screen.getByLabelText(/description/i), 'Une description détaillée');
    await user.click(screen.getByRole('button', { name: /envoyer/i }));
    expect(await screen.findByText(/Merci/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voir le signalement/i })).toHaveAttribute(
      'href',
      'https://github.com/o/r/issues/7',
    );
  });

  it.each([
    [429, /3 signalements/],
    [503, /indisponible/i],
  ])('statut %i : message dédié, formulaire conservé', async (status, message) => {
    connecter();
    vi.stubGlobal('fetch', repondre(status, { erreur: 'x' }));
    const user = userEvent.setup();
    render(<SignalerBug onRetour={() => {}} page="profil" />);
    await user.type(screen.getByLabelText(/titre/i), 'Mon titre');
    await user.type(screen.getByLabelText(/description/i), 'Une description détaillée');
    await user.click(screen.getByRole('button', { name: /envoyer/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText(/titre/i)).toHaveValue('Mon titre');
  });

  it('erreur réseau : message et possibilité de réessayer', async () => {
    connecter();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('x'))));
    const user = userEvent.setup();
    render(<SignalerBug onRetour={() => {}} page="profil" />);
    await user.type(screen.getByLabelText(/titre/i), 'Mon titre');
    await user.type(screen.getByLabelText(/description/i), 'Une description détaillée');
    await user.click(screen.getByRole('button', { name: /envoyer/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/connexion/i));
    expect(screen.getByRole('button', { name: /envoyer/i })).toBeEnabled();
  });

  it('refuse une capture qui n’est pas une image PNG/JPEG/WebP ou > 5 Mo', async () => {
    connecter();
    const user = userEvent.setup({ applyAccept: false });
    render(<SignalerBug onRetour={() => {}} page="profil" />);
    const champ = screen.getByLabelText(/capture/i);
    await user.upload(champ, new File(['x'], 'a.gif', { type: 'image/gif' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/PNG, JPEG ou WebP/);
    const gros = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'g.png', { type: 'image/png' });
    await user.upload(champ, gros);
    expect(screen.getByRole('alert')).toHaveTextContent(/5 Mo/);
  });

  it('le bouton retour appelle onRetour', async () => {
    const onRetour = vi.fn();
    const user = userEvent.setup();
    render(<SignalerBug onRetour={onRetour} page="profil" />);
    await user.click(screen.getByRole('button', { name: /profil/i }));
    expect(onRetour).toHaveBeenCalled();
  });
});
