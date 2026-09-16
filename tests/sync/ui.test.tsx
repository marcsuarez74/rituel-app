import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { Checklist } from '../../src/components/Checklist';
import { ProfilScreen } from '../../src/components/ProfilScreen';
import { WeekBanner } from '../../src/components/WeekBanner';
import type { UserProfile } from '../../src/lib/model';
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

// Engine partiellement mocké : connexion/purge interceptées (les autres
// exports restent réels — initSync, session, outbox…).
vi.mock('../../src/lib/sync/engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sync/engine')>()),
  connecterFoyer: vi.fn(async () => {}),
  purgerFoyer: vi.fn(async () => {}),
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

describe('sync UI: bannière', () => {
  it('pas de point sans sync (off / prop absente)', () => {
    render(<WeekBanner meta={{ semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' }} />);
    expect(screen.queryByRole('button', { name: /synchroni/i })).toBeNull();
  });

  it('point visible en erreur, tap déclenche re-sync', async () => {
    const onSyncTap = vi.fn();
    render(
      <WeekBanner
        meta={{ semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' }}
        syncEtat="erreur"
        onSyncTap={onSyncTap}
      />,
    );
    const dot = screen.getByRole('button', { name: /synchronisation.*erreur/i });
    await userEvent.setup().click(dot);
    expect(onSyncTap).toHaveBeenCalledOnce();
  });
});

describe('sync UI: bloc profil', () => {
  const profil = (): UserProfile => ({
    id: 'marc',
    dateNaissance: '1990-01-01',
    taille: 180,
    objectif: { type: 'maintien' },
    complements: [],
    regime: 'aucun',
  });

  const renderProfil = (syncEtat: 'attente' | 'sync' = 'attente') =>
    render(
      <ProfilScreen
        profile={profil()}
        syncEtat={syncEtat}
        onBack={() => {}}
        onChangeProfile={() => {}}
        onProfileSaved={() => {}}
        onImported={() => {}}
      />,
    );

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('attente : saisie code + bouton connecter (appel engine)', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    renderProfil('attente');
    await userEvent.setup().type(screen.getByLabelText('Code de foyer'), 'rituel-2026');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Se connecter au foyer' }));
    expect(connecterFoyer).toHaveBeenCalledWith('rituel-2026');
  });

  it('code refusé : message visible', async () => {
    const engine = await import('../../src/lib/sync/engine');
    vi.mocked(engine.connecterFoyer).mockRejectedValueOnce(new Error('code-refuse'));
    renderProfil('attente');
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Code de foyer'), 'mauvais');
    await u.click(screen.getByRole('button', { name: 'Se connecter au foyer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/code de foyer refusé/i);
  });

  it('connecté : bouton suppression foyer, double confirmation, purge', async () => {
    const { purgerFoyer } = await import('../../src/lib/sync/engine');
    definirSession('t', 'f');
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmSpy);
    renderProfil('sync');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /supprimer les données du foyer/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(purgerFoyer).toHaveBeenCalledOnce();
  });

  it('purge : double-tap → un seul appel', async () => {
    const { purgerFoyer } = await import('../../src/lib/sync/engine');
    definirSession('t', 'f');
    vi.stubGlobal('confirm', () => true);
    // Jamais résolue : simule la flush en vol — le bouton doit se verrouiller.
    vi.mocked(purgerFoyer).mockImplementation(() => new Promise(() => {}));
    renderProfil('sync');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /supprimer les données du foyer/i }));
    await u.click(screen.getByRole('button', { name: /suppression/i }));
    expect(purgerFoyer).toHaveBeenCalledOnce();
  });

  it('note de transparence affichée', () => {
    renderProfil('attente');
    expect(screen.getByText(/supabase.*région ue.*accès limité au foyer/i)).toBeInTheDocument();
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
