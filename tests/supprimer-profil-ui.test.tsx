import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilScreen } from '../src/components/ProfilScreen';
import type { UserProfile } from '../src/lib/model';

const { supprimerProfilMock } = vi.hoisted(() => ({ supprimerProfilMock: vi.fn() }));

vi.mock('../src/lib/sync/engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/sync/engine')>()),
  supprimerProfil: (...args: unknown[]) => supprimerProfilMock(...args),
}));

const profil: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  objectif: { type: 'perte', echeance: '2026-12-15' },
  complements: [],
  regime: 'aucun',
};

const monter = (surSupprime = vi.fn()) => {
  const user = userEvent.setup();
  render(
    <ProfilScreen
      profile={profil}
      onBack={() => undefined}
      onChangeProfile={() => undefined}
      onProfilSupprime={surSupprime}
    />,
  );
  return { user, surSupprime };
};

const ouvrir = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /Supprimer mon profil/ }));
  return screen.getByRole('alertdialog', { name: /Supprimer mon profil/ });
};

beforeEach(() => {
  localStorage.clear();
  supprimerProfilMock.mockReset();
  supprimerProfilMock.mockResolvedValue(undefined);
});

describe('Supprimer mon profil (UI)', () => {
  it('l’entrée n’existe que si l’app fournit onProfilSupprime', () => {
    render(<ProfilScreen profile={profil} onBack={() => undefined} onChangeProfile={() => undefined} />);
    expect(screen.queryByRole('button', { name: /Supprimer mon profil/ })).toBeNull();
  });

  it('dialogue accessible : explique ce qui est effacé, bouton bloqué tant que SUPPRIMER n’est pas saisi', async () => {
    const { user } = monter();
    const dialogue = await ouvrir(user);
    expect(dialogue).toHaveAttribute('aria-modal', 'true');
    expect(dialogue).toHaveTextContent(/pesées/);
    expect(dialogue).toHaveTextContent(/définitiv/);
    const confirmer = screen.getByRole('button', { name: 'Supprimer définitivement' });
    expect(confirmer).toBeDisabled();
    const champ = screen.getByLabelText(/Tape SUPPRIMER/);
    expect(champ).toHaveFocus();
    await user.type(champ, 'supprim');
    expect(confirmer).toBeDisabled();
    await user.type(champ, 'er');
    expect(confirmer).toBeEnabled();
    expect(supprimerProfilMock).not.toHaveBeenCalled();
  });

  it('annuler (bouton ou Échap) ne supprime rien', async () => {
    const { user, surSupprime } = monter();
    await ouvrir(user);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await ouvrir(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(supprimerProfilMock).not.toHaveBeenCalled();
    expect(surSupprime).not.toHaveBeenCalled();
  });

  it('confirmation : supprime puis prévient l’app (retour onboarding)', async () => {
    const { user, surSupprime } = monter();
    await ouvrir(user);
    await user.type(screen.getByLabelText(/Tape SUPPRIMER/), 'SUPPRIMER');
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));
    await waitFor(() => expect(surSupprime).toHaveBeenCalledTimes(1));
    expect(supprimerProfilMock).toHaveBeenCalledWith({ localSeulement: false });
  });

  it('serveur injoignable : message clair, réessayer ou supprimer quand même sur ce téléphone', async () => {
    const { user, surSupprime } = monter();
    supprimerProfilMock.mockRejectedValueOnce(new Error('serveur-injoignable'));
    await ouvrir(user);
    await user.type(screen.getByLabelText(/Tape SUPPRIMER/), 'SUPPRIMER');
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Impossible de joindre le serveur/);
    expect(surSupprime).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(surSupprime).toHaveBeenCalledTimes(1));
    expect(supprimerProfilMock).toHaveBeenLastCalledWith({ localSeulement: false });
  });

  it('« Supprimer quand même sur ce téléphone » : suppression locale seule', async () => {
    const { user, surSupprime } = monter();
    supprimerProfilMock.mockRejectedValueOnce(new Error('serveur-injoignable'));
    await ouvrir(user);
    await user.type(screen.getByLabelText(/Tape SUPPRIMER/), 'SUPPRIMER');
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: /Supprimer quand même sur ce téléphone/ }));
    await waitFor(() => expect(surSupprime).toHaveBeenCalledTimes(1));
    expect(supprimerProfilMock).toHaveBeenLastCalledWith({ localSeulement: true });
  });
});
