import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import App from '../../src/App';
import { useCoches } from '../../src/components/useCoches';
import { Onboarding } from '../../src/components/onboarding/Onboarding';
import { ProfilScreen } from '../../src/components/ProfilScreen';
import { EnTete } from '../../src/components/shell/EnTete';
import type { UserProfile } from '../../src/lib/model';
import { syncActif } from '../../src/lib/sync/config';
import { injecterClient, reinitialiser } from '../../src/lib/sync/engine';
import { viderOutbox } from '../../src/lib/sync/outbox';
import type { RowSync, SyncClient } from '../../src/lib/sync/client';
import { definirCode, definirSession, effacerSession } from '../../src/lib/sync/session';
import { getChecks, loadProfile, setCheck } from '../../src/lib/storage';
import { foyerParDefaut, saveFoyer } from '../../src/lib/cycle/etat';

// Config sync simulée active : le vrai câblage initSync tourne (engine actif),
// le client passif injecté évite tout réseau.
vi.mock('../../src/lib/sync/config', () => ({
  SYNC_URL: 'https://rituel.example.fr',
  syncActif: vi.fn(() => true),
}));

// Engine partiellement mocké : connexion/purge interceptées (les autres
// exports restent réels — initSync, session, outbox…).
vi.mock('../../src/lib/sync/engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sync/engine')>()),
  connecterFoyer: vi.fn(async () => {}),
  purgerFoyer: vi.fn(async () => {}),
}));

const { creerFoyerMock, genererCodeMock } = vi.hoisted(() => ({
  creerFoyerMock: vi.fn(async () => ({ foyerId: 'f-1' })),
  genererCodeMock: vi.fn(() => 'romarin-basilic-3f9a2c7e'),
}));

// Session partiellement mockée : création de foyer + code interceptés
// (les autres exports restent réels — definirSession, effacerSession…).
vi.mock('../../src/lib/sync/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/sync/session')>()),
  creerFoyer: () => creerFoyerMock(),
  genererCodeFoyer: () => genererCodeMock(),
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

  it('sans profil : onboarding, pas de crash sync', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Bienvenue sur Rituel/ })).toBeInTheDocument();
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
      expect(screen.queryByRole('heading', { name: /Bienvenue sur Rituel/ })).toBeNull(),
    );
    expect(screen.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeInTheDocument();
  });
});

describe('sync UI: en-tête', () => {
  const entete = (syncEtat: Parameters<typeof EnTete>[0]['syncEtat']) => (
    <EnTete titre="Menu" prenom="Marc" syncEtat={syncEtat} onProfil={() => {}} />
  );

  it('sans sync : avatar seul, sans point', () => {
    const { container } = render(entete('off'));
    expect(screen.getByRole('button', { name: 'Mon profil' })).toHaveTextContent('M');
    expect(container.querySelector('.avatar-pt')).toBeNull();
  });

  it('le point de l’avatar porte l’état de la sync', () => {
    const { container, rerender } = render(entete('hors-foyer'));
    expect(screen.getByRole('button', { name: 'Mon profil — Local' })).toBeInTheDocument();
    expect(container.querySelector('.avatar-pt')).toHaveClass('gris');
    rerender(entete('erreur'));
    expect(container.querySelector('.avatar-pt')).toHaveClass('danger');
    rerender(entete('sync'));
    expect(screen.getByRole('button', { name: 'Mon profil — Duo connecté' })).toBeInTheDocument();
    expect(container.querySelector('.avatar-pt')).toHaveClass('basilic');
  });

  it('tap sur l’avatar : ouvre le profil', async () => {
    const onProfil = vi.fn();
    render(<EnTete titre="Menu" prenom="Marc" syncEtat="sync" onProfil={onProfil} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Mon profil/ }));
    expect(onProfil).toHaveBeenCalledOnce();
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
      />,
    );

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('hors foyer : rejoindre avec un code (le foyer du serveur gagne)', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    renderProfil('hors-foyer');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await user.click(screen.getByRole('button', { name: 'Rejoindre un foyer' }));
    await user.type(screen.getByLabelText('Code de foyer'), 'rituel-2026');
    await user.click(screen.getByRole('button', { name: 'Rejoindre' }));
    expect(connecterFoyer).toHaveBeenCalledWith('rituel-2026', { rejoindre: true });
  });

  it('code refusé : message visible', async () => {
    const engine = await import('../../src/lib/sync/engine');
    vi.mocked(engine.connecterFoyer).mockRejectedValueOnce(new Error('code-refuse'));
    renderProfil('attente');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await u.click(screen.getByRole('button', { name: 'Rejoindre un foyer' }));
    await u.type(screen.getByLabelText('Code de foyer'), 'mauvais');
    await u.click(screen.getByRole('button', { name: 'Rejoindre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/code de foyer refusé/i);
  });

  it('connecté : membres, code du foyer masqué puis affiché, pas de formulaire', async () => {
    definirSession('t', 'f');
    definirCode('romarin-basilic-3f9a2c7e');
    saveFoyer({ ...foyerParDefaut(profil()), membres: [...foyerParDefaut(profil()).membres, { id: 'therese-3f9a', prenom: 'Thérèse', type: 'adulte', suivi: false }] });
    renderProfil('sync');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    expect(screen.getByText('toi · ce téléphone')).toBeInTheDocument();
    expect(screen.getByText('Thérèse').closest('.membre')).toHaveTextContent('adulte · pas encore de téléphone');
    expect(screen.queryByText('romarin-basilic-3f9a2c7e')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Afficher' }));
    expect(screen.getByText('romarin-basilic-3f9a2c7e')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejoindre un foyer' })).not.toBeInTheDocument();
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
});

describe('profil: création de foyer (VPS)', () => {
  const profilBase = (): UserProfile => ({
    id: 'marc',
    dateNaissance: '1990-01-01',
    taille: 180,
    objectif: { type: 'maintien' },
    complements: [],
    regime: 'aucun',
  });
  const renderProfil = () =>
    render(
      <ProfilScreen
        profile={profilBase()}
        syncEtat="attente"
        onBack={() => {}}
        onChangeProfile={() => {}}
        onProfileSaved={() => {}}
      />,
    );

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('créer → connexion au nouveau code, code affiché à noter, puis vue connectée', async () => {
    const engine = await import('../../src/lib/sync/engine');
    vi.mocked(engine.connecterFoyer).mockImplementation(async (code: string) => {
      definirSession('t', 'f');
      definirCode(code);
    });
    renderProfil();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await user.click(screen.getByRole('button', { name: 'Créer mon foyer' }));
    expect(await screen.findByText('romarin-basilic-3f9a2c7e')).toBeInTheDocument();
    expect(engine.connecterFoyer).toHaveBeenCalledWith('romarin-basilic-3f9a2c7e');
    await user.click(screen.getByRole('button', { name: /^Copier/ }));
    await user.click(screen.getByRole('button', { name: /C'est noté/ }));
    expect(screen.getByRole('button', { name: 'Déconnecter le foyer' })).toBeInTheDocument();
    vi.mocked(engine.connecterFoyer).mockImplementation(async () => {});
  });

  it('code déjà pris (409) → alerte visible', async () => {
    creerFoyerMock.mockRejectedValueOnce(new Error('code-occupe'));
    renderProfil();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await user.click(screen.getByRole('button', { name: 'Créer mon foyer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/déjà pris/i);
  });

  it('note de posture VPS', async () => {
    renderProfil();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    expect(screen.getByText(/votre serveur.*rituel\.marco-studio\.fr/i)).toBeInTheDocument();
  });
});

describe('sync UI: coches relues au pull', () => {
  const Coche = ({ version }: { version: number }) => {
    const { coches, basculer } = useCoches('cycle:c1:0', version);
    return (
      <button type="button" aria-pressed={!!coches.b1} onClick={() => basculer('b1')}>
        b1
      </button>
    );
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('bump syncVersion → relit getChecks (changement remote visible)', () => {
    const { rerender } = render(<Coche version={0} />);
    expect(screen.getByRole('button', { name: 'b1' })).toHaveAttribute('aria-pressed', 'false');
    setCheck('cycle:c1:0', 'b1', true); // simule appliquerRemote
    rerender(<Coche version={1} />);
    expect(screen.getByRole('button', { name: 'b1' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('cocher localement reste instantané', async () => {
    render(<Coche version={0} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'b1' }));
    expect(screen.getByRole('button', { name: 'b1' })).toHaveAttribute('aria-pressed', 'true');
    expect(getChecks('cycle:c1:0')).toEqual({ b1: true });
  });
});

describe('sync UI: onboarding — partager avec son foyer', () => {
  let onDone: Mock<(profile: UserProfile, foyerLocal: boolean) => void>;

  beforeEach(() => {
    localStorage.clear();
    effacerSession();
    vi.clearAllMocks();
    onDone = vi.fn();
  });

  // Jusqu'à l'écran « Partager » : étape 1 (routine), étapes 4 et 5 passées.
  const allerPartage = async (prenom = 'Thérèse') => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} />);
    await user.type(screen.getByLabelText("Comment tu t'appelles ?"), prenom);
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /C'est parti/ }));
    expect(screen.getByRole('heading', { name: 'Partager avec ton foyer' })).toBeInTheDocument();
    return user;
  };

  // Le foyer du serveur, tel que le pull le pose (connecterFoyer mocké).
  const foyerDeJean = () => ({
    ...foyerParDefaut(null),
    membres: [
      { id: 'jean-01ab', prenom: 'Jean', type: 'adulte' as const, suivi: true, telephone: true },
      { id: 'therese-3f9a', prenom: 'Thérèse', type: 'adulte' as const, suivi: false },
    ],
  });

  it('Plus tard : termine avec le foyer local', async () => {
    const user = await allerPartage();
    expect(onDone).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Plus tard/ }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ prenom: 'Thérèse' }), true);
  });

  it('Créer : crée le foyer, s’y connecte, affiche le code à donner ; C’est noté termine', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    const user = await allerPartage('Jean');
    await user.click(screen.getByRole('button', { name: 'Créer mon foyer' }));
    expect(await screen.findByText('romarin-basilic-3f9a2c7e')).toBeInTheDocument();
    expect(connecterFoyer).toHaveBeenCalledWith('romarin-basilic-3f9a2c7e');
    await user.click(screen.getByRole('button', { name: /Copier/ }));
    expect(screen.getByRole('button', { name: /Copié/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /C'est noté/ }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ prenom: 'Jean' }), true);
  });

  it('Rejoindre, même prénom : rattachée sans question à la Thérèse saisie par Jean (id, pesées)', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    vi.mocked(connecterFoyer).mockImplementation(async () => saveFoyer(foyerDeJean()));
    const user = await allerPartage('Thérèse');
    await user.click(screen.getByRole('button', { name: 'Rejoindre un foyer' }));
    await user.type(screen.getByLabelText('Code de foyer'), 'romarin-basilic-3f9a2c7e');
    await user.click(screen.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(connecterFoyer).toHaveBeenCalledWith('romarin-basilic-3f9a2c7e', { rejoindre: true });
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: 'therese-3f9a', prenom: 'Thérèse' }), false);
    expect(loadProfile()?.id).toBe('therese-3f9a');
  });

  it('Rejoindre, prénom différent : « Es-tu Thérèse ? » — Non, ajoute-moi garde mon id', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    vi.mocked(connecterFoyer).mockImplementation(async () => saveFoyer(foyerDeJean()));
    const user = await allerPartage('Tess');
    await user.click(screen.getByRole('button', { name: 'Rejoindre un foyer' }));
    await user.type(screen.getByLabelText('Code de foyer'), 'code');
    await user.click(screen.getByRole('button', { name: 'Rejoindre' }));

    expect(await screen.findByRole('heading', { name: 'Es-tu Thérèse ?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: "Oui, c'est moi" })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Non, ajoute-moi' }));
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^tess-/) }), false);
  });

  it('Rejoindre : code refusé → message, double tap → une seule connexion', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    vi.mocked(connecterFoyer).mockRejectedValueOnce(new Error('code-refuse'));
    const user = await allerPartage();
    await user.click(screen.getByRole('button', { name: 'Rejoindre un foyer' }));
    await user.type(screen.getByLabelText('Code de foyer'), 'mauvais');
    await user.click(screen.getByRole('button', { name: 'Rejoindre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/code de foyer refusé/i);

    vi.mocked(connecterFoyer).mockImplementation(() => new Promise(() => {})); // connexion en vol
    await user.click(screen.getByRole('button', { name: 'Rejoindre' }));
    await user.click(screen.getByRole('button', { name: /Connexion…/ }));
    expect(connecterFoyer).toHaveBeenCalledTimes(2); // l'essai refusé + un seul en vol
  });

  it('sync inactive : pas d’écran Partager, C’est parti termine directement', async () => {
    vi.mocked(syncActif).mockReturnValue(false);
    try {
      const user = userEvent.setup();
      render(<Onboarding onDone={onDone} />);
      await user.type(screen.getByLabelText("Comment tu t'appelles ?"), 'Jean');
      await user.click(screen.getByRole('button', { name: /Continuer/ }));
      await user.click(screen.getByRole('button', { name: /Continuer/ }));
      await user.click(screen.getByRole('button', { name: /C'est parti/ }));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('heading', { name: 'Partager avec ton foyer' })).toBeNull();
    } finally {
      vi.mocked(syncActif).mockReturnValue(true);
    }
  });
});
