import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { Checklist } from '../../src/components/Checklist';
import { injecterClient, reinitialiser } from '../../src/lib/sync/engine';
import { viderOutbox } from '../../src/lib/sync/outbox';
import type { RowSync, SyncClient } from '../../src/lib/sync/client';
import { definirSession, effacerSession } from '../../src/lib/sync/session';
import { getChecks, setCheck } from '../../src/lib/storage';

// Config sync simulée active : le vrai câblage initSync tourne (engine actif),
// le client passif injecté évite tout réseau.
vi.mock('../../src/lib/sync/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  syncActif: vi.fn(() => true),
}));

const clientPassif = (): SyncClient => ({
  upsert: async () => {},
  supprimer: async () => {},
  toutLire: async () => [] as RowSync[],
  purger: async () => {},
  abonner: () => () => {},
});

describe('sync UI: app', () => {
  beforeEach(() => {
    localStorage.clear();
    viderOutbox();
    effacerSession();
    reinitialiser();
    injecterClient(clientPassif());
  });

  it('sans profil : onboarding, pas de crash sync', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Qui est derrière l'écran/ })).toBeInTheDocument();
  });

  it('avec session : l’app démarre en sync (pas de brique cassée)', async () => {
    const profil = {
      id: 'marc',
      dateNaissance: '1990-01-01',
      taille: 180,
      objectif: { type: 'maintien' },
      complements: [],
      regime: 'aucun',
    };
    localStorage.setItem('sportapp:profile', JSON.stringify(profil));
    definirSession('t', 'f');
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /Qui est derrière l'écran/ })).toBeNull(),
    );
    expect(screen.getByText('Semaine 2026-S37')).toBeInTheDocument();
  });
});

describe('sync UI: Checklist re-read', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const items = [{ id: 'b1', label: 'Riz' }];

  it('bump dataVersion → relit getChecks (changement remote visible)', () => {
    const { rerender } = render(<Checklist items={items} semaine="2026-S39" dataVersion={0} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    // « Autre téléphone » : écrit direct storage (comme un pull remote).
    setCheck('2026-S39', 'b1', true);
    rerender(<Checklist items={items} semaine="2026-S39" dataVersion={1} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('cocher localement reste instantané', async () => {
    const u = userEvent.setup();
    render(<Checklist items={items} semaine="2026-S39" dataVersion={0} />);
    await u.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(getChecks('2026-S39')['b1']).toBe(true);
  });
});
