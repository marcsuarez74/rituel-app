import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import App from '../../src/App';
import { Checklist } from '../../src/components/Checklist';
import { Onboarding } from '../../src/components/onboarding/Onboarding';
import { ProfilScreen } from '../../src/components/ProfilScreen';
import { WeekBanner } from '../../src/components/WeekBanner';
import type { UserProfile } from '../../src/lib/model';
import { syncActif } from '../../src/lib/sync/config';
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
    expect(screen.getByText('Semaine 37')).toBeInTheDocument();
  });
});

describe('sync UI: bannière', () => {
  const metaFix = { semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' };

  it('sans sync (off / prop absente) : chip en mode Local, pas de bouton sync', () => {
    render(<WeekBanner meta={{ semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' }} />);
    expect(screen.queryByRole('button', { name: /synchroni/i })).toBeNull();
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  it('hors-foyer : chip en mode Local (pas de chip Duo)', () => {
    render(<WeekBanner meta={metaFix} syncEtat="hors-foyer" />);
    expect(screen.queryByRole('button', { name: /Synchronisation/ })).not.toBeInTheDocument();
    // Garde : aucune chip Duo (quel que soit son état), la chip affiche Local.
    expect(screen.queryByRole('button', { name: /Duo/ })).not.toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  it('attente, erreur et sync : la chip reste visible (régression)', () => {
    const { rerender } = render(<WeekBanner meta={metaFix} syncEtat="attente" />);
    expect(screen.getByRole('button', { name: /synchronisation en cours/i })).toBeInTheDocument();
    rerender(<WeekBanner meta={metaFix} syncEtat="erreur" />);
    expect(screen.getByRole('button', { name: /erreur, appuyer/i })).toBeInTheDocument();
    rerender(<WeekBanner meta={metaFix} syncEtat="sync" />);
    expect(screen.getByRole('button', { name: /synchronisé, appuyer/i })).toBeInTheDocument();
  });

  it('chip visible en erreur, tap déclenche re-sync', async () => {
    const onSyncTap = vi.fn();
    render(
      <WeekBanner
        meta={{ semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' }}
        syncEtat="erreur"
        onSyncTap={onSyncTap}
      />,
    );
    const chip = screen.getByRole('button', { name: /erreur, appuyer pour réessayer/i });
    await userEvent.setup().click(chip);
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

  const renderProfil = (syncEtat: 'attente' | 'sync' | 'hors-foyer' = 'attente') =>
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
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await user.type(screen.getByLabelText('Code de foyer'), 'rituel-2026');
    await user.click(screen.getByRole('button', { name: 'Se connecter au foyer' }));
    expect(connecterFoyer).toHaveBeenCalledWith('rituel-2026');
  });

  it('hors-foyer : le formulaire de connexion est proposé', async () => {
    renderProfil('hors-foyer');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    expect(screen.getByLabelText('Code de foyer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter au foyer/ })).toBeInTheDocument();
  });

  it('code refusé : message visible', async () => {
    const engine = await import('../../src/lib/sync/engine');
    vi.mocked(engine.connecterFoyer).mockRejectedValueOnce(new Error('code-refuse'));
    renderProfil('attente');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /voir le foyer/ }));
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
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await user.click(screen.getByRole('button', { name: /supprimer les données du foyer/i }));
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
    await u.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await u.click(screen.getByRole('button', { name: /supprimer les données du foyer/i }));
    await u.click(screen.getByRole('button', { name: /suppression/i }));
    expect(purgerFoyer).toHaveBeenCalledOnce();
  });

  it('note de transparence affichée', async () => {
    renderProfil('attente');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
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

describe('sync UI: onboarding étape 6', () => {
  let onDone: Mock<(profile: UserProfile) => void>;

  beforeEach(() => {
    localStorage.clear();
    effacerSession();
    vi.clearAllMocks();
    onDone = vi.fn();
  });

  // Les input[type=date] ne se laissent pas taper : convention repo = fireEvent.change.
  const saisirDate = (label: string, valeur: string) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value: valeur } });
  };

  const allerEtape5 = async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.type(screen.getByLabelText('Poids (kg)'), '62.4');
    saisirDate('Date de naissance', '1987-03-02');
    await user.type(screen.getByLabelText('Taille (cm)'), '165');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: /Maison & courses/ })).toBeInTheDocument();
    return user;
  };

  it('avec sync active : après validation finale, étape 6 avec code + Plus tard', async () => {
    const user = await allerEtape5();
    await user.click(screen.getByRole('button', { name: /C'est parti/ }));

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Synchroniser les téléphones' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: 'melanie' }));
  });

  it('étape 6 : saisie du code → connecterFoyer, session posée → onDone', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    const user = await allerEtape5();
    await user.click(screen.getByRole('button', { name: /C'est parti/ }));
    await user.type(screen.getByLabelText('Code de foyer'), 'rituel-2026');
    await user.click(screen.getByRole('button', { name: 'Connecter le foyer' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(connecterFoyer).toHaveBeenCalledWith('rituel-2026');
  });

  it('étape 6 : double soumission → un seul connecterFoyer', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    // Jamais résolue : simule la connexion en vol — le garde-fou doit verrouiller.
    vi.mocked(connecterFoyer).mockImplementation(() => new Promise(() => {}));
    const user = await allerEtape5();
    await user.click(screen.getByRole('button', { name: /C'est parti/ }));
    await user.type(screen.getByLabelText('Code de foyer'), 'rituel-2026');
    // Tap + Entrée en rafale : le bouton disabled ne couvre pas le Enter
    // (soumission du form — convention repo fireEvent.submit sous happy-dom).
    await user.click(screen.getByRole('button', { name: 'Connecter le foyer' }));
    fireEvent.submit(document.querySelector('.onboarding-form')!);
    expect(connecterFoyer).toHaveBeenCalledOnce();
  });

  it('sync inactive : pas d étape 6, C est parti appelle onDone directement', async () => {
    vi.mocked(syncActif).mockReturnValue(false);
    try {
      const user = await allerEtape5();
      await user.click(screen.getByRole('button', { name: /C'est parti/ }));

      expect(onDone).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('heading', { name: 'Synchroniser les téléphones' })).toBeNull();
    } finally {
      vi.mocked(syncActif).mockReturnValue(true);
    }
  });
});
