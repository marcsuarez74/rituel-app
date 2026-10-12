import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { addWeight, saveProfile } from '../src/lib/storage';
import type { UserProfile } from '../src/lib/model';

const profil: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  objectif: { type: 'perte', echeance: '2026-12-15' },
  complements: [],
  regime: 'aucun',
};

beforeEach(() => localStorage.clear());

describe('App — suppression du profil de bout en bout (sans sync)', () => {
  it('Profil → Supprimer → confirmation : clés sportapp:* effacées, retour à l’onboarding', async () => {
    saveProfile(profil);
    addWeight('marc', '2026-10-01', 80);
    localStorage.setItem('autre-lib:reglage', 'garde');
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Mon profil' }));
    await user.click(await screen.findByRole('button', { name: /Supprimer mon profil/ }));
    await user.type(screen.getByLabelText(/Tape SUPPRIMER/), 'SUPPRIMER');
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));

    expect(await screen.findByLabelText("Comment tu t'appelles ?")).toBeInTheDocument();
    await waitFor(() =>
      expect(Object.keys(localStorage).filter((k) => k.startsWith('sportapp:'))).toEqual([]),
    );
    expect(localStorage.getItem('autre-lib:reglage')).toBe('garde');
  });

  it('annuler ne supprime rien', async () => {
    saveProfile(profil);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Mon profil' }));
    await user.click(await screen.findByRole('button', { name: /Supprimer mon profil/ }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(localStorage.getItem('sportapp:profile')).not.toBeNull();
    expect(screen.queryByLabelText("Comment tu t'appelles ?")).toBeNull();
  });
});
