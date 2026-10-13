import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type Mock } from 'vitest';
import App from '../src/App';
import { ProfilScreen } from '../src/components/ProfilScreen';
import type { UserProfile } from '../src/lib/model';
import { addWeight, getWeights, loadProfile, saveProfile } from '../src/lib/storage';

const profileMarc: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  objectif: { type: 'perte', echeance: '2026-12-15' },
  complements: [],
  regime: 'aucun',
};

const monterApp = () => {
  saveProfile(profileMarc);
  const user = userEvent.setup();
  render(<App />);
  return user;
};

// Hub : chaque tuile est un <button> (name = titre + résumé) ; les pages
// détail vivent sous leur h2 (niveau 2).
const ouvrirPage = (titre: string) =>
  screen.getByRole('button', { name: new RegExp(titre) });
const page = (nom: string) =>
  screen.getByRole('heading', { name: nom, level: 2 }).closest('section')!;

describe('ProfilScreen (unité)', () => {
  let onBack: Mock<() => void>;
  let onChangeProfile: Mock<() => void>;
  let onProfileSaved: Mock<(p: UserProfile) => void>;

  beforeEach(() => {
    localStorage.clear();
    onBack = vi.fn();
    onChangeProfile = vi.fn();
    onProfileSaved = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('affiche le hub, le retour, mes infos et le changement de profil', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );

    expect(screen.getByRole('button', { name: /Retour/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Changer de profil/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mon foyer', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Moi', level: 2 })).toBeInTheDocument();

    await user.click(ouvrirPage('Mes infos'));
    expect(screen.getByLabelText('Date de naissance')).toHaveValue('1985-04-12');
    expect(screen.getByLabelText('Taille (cm)')).toHaveValue(178);
    expect(screen.getByRole('button', { name: 'Enregistrer mes infos' })).toBeInTheDocument();
  });

  it('enregistre les infos modifiées dans le store', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    await user.click(ouvrirPage('Mes infos'));

    // input[type=date] ne se laisse pas taper : convention repo = fireEvent.change.
    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '1984-04-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes infos' }));

    expect(loadProfile()).toEqual({
      id: 'marc',
      dateNaissance: '1984-04-12',
      taille: 178,
      objectif: { type: 'perte', echeance: '2026-12-15' },
      complements: [],
      regime: 'aucun',
    });
  });

  it('Mes infos : champ Prénom prérempli, édité puis enregistré', async () => {
    render(
      <ProfilScreen profile={{ ...profileMarc, prenom: 'Marc' }} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Mes infos'));

    expect(screen.getByLabelText('Prénom')).toHaveValue('Marc');
    await user.clear(screen.getByLabelText('Prénom'));
    await user.type(screen.getByLabelText('Prénom'), 'Jean');
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));

    expect(loadProfile()?.prenom).toBe('Jean');
  });

  it('prénom vidé : le profil ne porte plus de prenom (défaut à l affichage)', async () => {
    render(
      <ProfilScreen profile={{ ...profileMarc, prenom: 'Marc' }} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Mes infos'));

    await user.clear(screen.getByLabelText('Prénom'));
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));

    expect(loadProfile()?.prenom).toBeUndefined();
  });

  it('profil partiel (sans date ni taille) : Mes infos s affiche, le prénom s enregistre seul', async () => {
    const partiel: UserProfile = {
      id: 'marc',
      prenom: '',
      objectif: { type: 'perte' },
      complements: [],
      regime: 'aucun',
    };
    saveProfile(partiel);
    render(
      <ProfilScreen profile={partiel} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Mes infos'));

    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Taille (cm)')).toHaveValue(null);
    expect(screen.getByText('Sélectionne ta date de naissance.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Prénom'), 'Jean');
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));

    const p = loadProfile();
    expect(p?.prenom).toBe('Jean');
    expect(p?.dateNaissance).toBeUndefined();
    expect(p?.taille).toBeUndefined();
  });

  it('date et taille effacées : le profil partiel est enregistré sans erreur', async () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Mes infos'));

    // input[type=date] ne se laisse pas taper : convention repo = fireEvent.change.
    await user.clear(screen.getByLabelText('Taille (cm)'));
    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));

    expect(within(page('Mes infos')).queryByRole('alert')).not.toBeInTheDocument();
    const p = loadProfile();
    expect(p?.dateNaissance).toBeUndefined();
    expect(p?.taille).toBeUndefined();
    expect(p?.objectif).toEqual(profileMarc.objectif);
  });

  it('date sans taille : erreur paire (formulaire incomplet)', async () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Mes infos'));

    await user.clear(screen.getByLabelText('Taille (cm)'));
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));

    expect(within(page('Mes infos')).getByRole('alert')).toHaveTextContent(/incomplet/i);
    expect(loadProfile()).toBeNull();
  });

  it('refuse une date de naissance donnant un âge hors bornes (cohérent avec l’onboarding)', async () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Mes infos'));

    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '2020-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes infos' }));

    expect(within(page('Mes infos')).getByRole('alert')).toHaveTextContent(/âge/i);
    expect(loadProfile()).toBeNull();
  });

  it('prévient le parent après enregistrement (état App resynchronisé)', async () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Mes infos'));

    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '1984-04-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes infos' }));

    expect(onProfileSaved).toHaveBeenCalledWith({
      id: 'marc',
      dateNaissance: '1984-04-12',
      taille: 178,
      objectif: { type: 'perte', echeance: '2026-12-15' },
      complements: [],
      regime: 'aucun',
    });
  });

  it('change de profil après confirmation (et seulement après)', async () => {
    const spy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', spy);
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Changer de profil/ }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(onChangeProfile).toHaveBeenCalledTimes(1);

    spy.mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: /Changer de profil/ }));
    expect(onChangeProfile).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('affiche la version de l’app en pied d’écran', () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );

    expect(
      screen.getByText(`Rituel v${__APP_VERSION__} — vos données restent sur votre téléphone.`),
    ).toBeInTheDocument();
  });

  it('date de naissance vidée : le hint propose de saisir (pas d’âge fantôme « 2026 ans »)', async () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Mes infos'));

    expect(screen.getByText('41 ans — calculé automatiquement.')).toBeInTheDocument();
    // input[type=date] ne se laisse pas taper : convention repo = fireEvent.change.
    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '' } });

    expect(screen.queryByText(/2026 ans/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sélectionne ta date de naissance/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('hub : tuile Mes infos avec résumé, tuile Mes menus avec sa position, « ‹ Moi » revient', async () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    const user = userEvent.setup();
    render(
      <ProfilScreen
        profile={{ ...profileMarc, prenom: 'Marc' }}
        onBack={onBack}
        onChangeProfile={onChangeProfile}
        onProfileSaved={onProfileSaved}
        resumeCycle="Menu B · semaine 2 sur 4"
        onMonCycle={() => {}}
      />,
    );

    // Carte d'identité : initiale + prénom
    expect(screen.getByText('M')).toBeInTheDocument(); // initiale avatar
    expect(screen.getByText('Marc')).toBeInTheDocument();
    expect(screen.queryByText(/Duo/)).not.toBeInTheDocument(); // sync off : pas de label sync
    // Tuile Mes menus : reprend la position actuelle des menus
    expect(ouvrirPage('Mes menus')).toHaveTextContent('Menu B · semaine 2 sur 4');
    // Tuile Mes infos : résumé âge/taille (41 ans au 09/09/2026)
    expect(ouvrirPage('Mes infos')).toHaveTextContent('41 ans · 178 cm');

    await user.click(ouvrirPage('Mes infos'));
    expect(screen.getByRole('heading', { name: 'Mes infos', level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toHaveValue('Marc');

    await user.click(screen.getByRole('button', { name: /Moi/ }));
    expect(screen.queryByRole('heading', { name: 'Mes infos', level: 2 })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('hub : sous-ligne duo selon syncEtat', () => {
    const { rerender } = render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} syncEtat="sync" />,
    );
    expect(screen.getByText('Duo connecté')).toBeInTheDocument();

    rerender(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} syncEtat="hors-foyer" />,
    );
    expect(screen.getByText('Local')).toBeInTheDocument();

    rerender(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} syncEtat="off" />,
    );
    expect(screen.queryByText(/Duo|Local/)).not.toBeInTheDocument();
  });
});

describe('ProfilScreen — Magasin et budget', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('préremplit les champs depuis le profil (magasin unique ancien = une puce cochée)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen
        profile={{
          ...profileMarc,
          magasin: 'Lidl',
          budgetMax: 40,
          preferences: ['Healthy', 'Rapide'],
          personnes: 4,
          repasJour: 3,
        }}
        onBack={() => {}}
        onChangeProfile={() => {}}
       
      />,
    );
    await user.click(ouvrirPage('Magasin et budget'));

    const maison = page('Magasin et budget');
    expect(within(maison).getByRole('button', { name: 'Lidl' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(maison).getByRole('button', { name: 'Aldi' })).toHaveAttribute('aria-pressed', 'false');
    // inputs texte (+ inputMode) : jest-dom renvoie la valeur sous forme de chaîne.
    expect(screen.getByLabelText('Budget max courses / semaine (€)')).toHaveValue('40');
    expect(screen.queryByLabelText('Personnes à table')).not.toBeInTheDocument(); // le foyer le dit
    expect(within(maison).getByRole('button', { name: /Retirer Healthy/ })).toBeInTheDocument();
    expect(within(maison).getByRole('button', { name: /Retirer Rapide/ })).toBeInTheDocument();
    // Mêmes champs que l'onboarding : le bloc de chips porte le même libellé.
    expect(within(maison).getByText('Préférences pour tes prochains menus')).toBeInTheDocument();
  });

  it('enregistre la section (validation incluse)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen profile={profileMarc} onBack={() => {}} onChangeProfile={() => {}} />,
    );
    await user.click(ouvrirPage('Magasin et budget'));
    const maison = page('Magasin et budget');

    await user.click(within(maison).getByRole('button', { name: 'Lidl' }));
    await user.click(within(maison).getByRole('button', { name: 'Aldi' }));
    await user.type(screen.getByLabelText('Budget max courses / semaine (€)'), '40');
    await user.click(within(maison).getByRole('button', { name: 'Ajouter' })); // sans saisir → no-op
    await user.type(screen.getByLabelText('Ajouter une préférence'), 'Batch-friendly');
    await user.click(within(maison).getByRole('button', { name: 'Ajouter' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer maison & courses' }));

    expect(loadProfile()).toEqual(
      expect.objectContaining({ magasin: 'Lidl', magasins: ['Lidl', 'Aldi'], budgetMax: 40, preferences: ['Batch-friendly'] }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Enregistré/);
  });

  it('refuse un budget max invalide (erreur rendue dans la page)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen profile={profileMarc} onBack={() => {}} onChangeProfile={() => {}} />,
    );
    await user.click(ouvrirPage('Magasin et budget'));

    await user.type(screen.getByLabelText('Budget max courses / semaine (€)'), '0');
    await user.click(screen.getByRole('button', { name: 'Enregistrer maison & courses' }));

    expect(within(page('Magasin et budget')).getByRole('alert')).toHaveTextContent(/Budget max invalide/i);
    expect(loadProfile()).toBeNull();
  });

  it('vider les champs et enregistrer retire les données maison du profil (et les anciens personnes / repas)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen
        profile={{
          ...profileMarc,
          magasin: 'Lidl',
          budgetMax: 40,
          preferences: ['Healthy'],
          personnes: 4,
          repasJour: 3,
        }}
        onBack={() => {}}
        onChangeProfile={() => {}}
       
      />,
    );
    await user.click(ouvrirPage('Magasin et budget'));

    await user.click(screen.getByRole('button', { name: 'Lidl' })); // décoche l'unique magasin
    await user.clear(screen.getByLabelText('Budget max courses / semaine (€)'));
    await user.click(screen.getByRole('button', { name: /Retirer Healthy/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer maison & courses' }));

    expect(loadProfile()).toEqual(profileMarc);
  });
});

describe('ProfilScreen (intégration via App)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('l’avatar de l’en-tête ouvre l’écran, le retour revient au shell', async () => {
    const user = monterApp();

    await user.click(await screen.findByRole('button', { name: 'Moi : Marc' }));
    expect(await screen.findByRole('button', { name: /Mes infos/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
  });

  it('« Signaler un bug » ouvre l’écran poussé, le retour revient au profil', async () => {
    const user = monterApp();

    await user.click(await screen.findByRole('button', { name: 'Moi : Marc' }));
    await user.click(await screen.findByRole('button', { name: /Signaler un bug/ }));
    expect(await screen.findByRole('heading', { name: 'Signaler un bug' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Moi/ }));
    expect(await screen.findByRole('button', { name: /Mes infos/ })).toBeInTheDocument();
  });

  it('la réouverture de l’écran montre les infos enregistrées (pas d’état périmé)', async () => {
    const user = monterApp();

    await user.click(await screen.findByRole('button', { name: 'Moi : Marc' }));
    await user.click(await screen.findByRole('button', { name: /Mes infos/ }));
    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '1984-04-12' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes infos' }));

    await user.click(screen.getByRole('button', { name: /Moi/ })); // page → hub
    await user.click(screen.getByRole('button', { name: /Retour/ })); // hub → shell
    await user.click(screen.getByRole('button', { name: 'Moi : Marc' }));
    await user.click(await screen.findByRole('button', { name: /Mes infos/ }));

    expect(screen.getByLabelText('Date de naissance')).toHaveValue('1984-04-12');
  });

  it('changer de profil efface le choix (onboarding) mais garde les données', async () => {
    addWeight('marc', '2026-09-22', 84.2);
    const spy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', spy);
    const user = monterApp();

    await user.click(await screen.findByRole('button', { name: 'Moi : Marc' }));
    await user.click(await screen.findByRole('button', { name: /Changer de profil/ }));

    expect(loadProfile()).toBeNull();
    expect(await screen.findByRole('heading', { name: /Bienvenue sur Rituel/ })).toBeInTheDocument();
    expect(getWeights('marc')).toEqual([{ date: '2026-09-22', kg: 84.2 }]);
  });
});

describe('Page Objectif', () => {
  const ouvrir = async (p: Partial<UserProfile> = {}) => {
    vi.setSystemTime(new Date('2026-10-07T10:00:00'));
    const onProfileSaved = vi.fn();
    render(<ProfilScreen profile={{ ...profileMarc, ...p }} onBack={() => {}} onChangeProfile={() => {}} onProfileSaved={onProfileSaved} />);
    const user = userEvent.setup();
    await user.click(ouvrirPage('Objectif'));
    return { user, onProfileSaved, pageObj: within(page('Objectif')) };
  };

  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('résumé : dernière pesée → poids visé, écart et rythme jusqu’à l’échéance', async () => {
    addWeight('marc', '2026-10-05', 82.4);
    const { pageObj } = await ouvrir({ poidsObjectif: 75, objectif: { type: 'perte', echeance: '2026-12-31' } });
    expect(pageObj.getByText('82,4 kg')).toBeInTheDocument();
    expect(pageObj.getByText('75 kg')).toBeInTheDocument();
    expect(pageObj.getByText('−7,4 kg · d’ici le 31 déc.')).toBeInTheDocument();
    expect(pageObj.getByText('≈ 0,6 kg / semaine')).toBeInTheDocument();
    expect(pageObj.queryByText(/Rythme ambitieux/)).not.toBeInTheDocument();
  });

  it('rythme > 1 kg/semaine : alerte douce, non bloquante', async () => {
    addWeight('marc', '2026-10-05', 82.4);
    const { pageObj, user } = await ouvrir({ poidsObjectif: 75, objectif: { type: 'perte', echeance: '2026-12-31' } });
    fireEvent.change(pageObj.getByLabelText(/Échéance/), { target: { value: '2026-11-15' } });
    expect(pageObj.getByText(/Rythme ambitieux/)).toBeInTheDocument();
    await user.click(pageObj.getByRole('button', { name: 'Enregistrer' }));
    expect(loadProfile()?.objectif.echeance).toBe('2026-11-15');
  });

  it('sans pesée : invite à se peser', async () => {
    const { pageObj } = await ouvrir({ poidsObjectif: 75 });
    expect(pageObj.getByText('Pèse-toi dans Suivi pour voir l’écart.')).toBeInTheDocument();
  });

  it('un seul Enregistrer : cap, poids visé, échéance, régime et compléments ensemble', async () => {
    const { pageObj, user, onProfileSaved } = await ouvrir({ complements: ['Whey', 'Spiruline'] });
    expect(pageObj.getByRole('radio', { name: /Perte de poids/ })).toBeChecked();
    expect(pageObj.getAllByRole('button', { name: /^Enregistrer/ })).toHaveLength(1);

    await user.click(pageObj.getByRole('radio', { name: /Maintien/ }));
    await user.type(pageObj.getByLabelText('Poids visé (kg)'), '70');
    fireEvent.change(pageObj.getByLabelText(/Échéance/), { target: { value: '' } });
    await user.click(pageObj.getByRole('radio', { name: 'Keto' }));
    expect(pageObj.getByRole('button', { name: 'Spiruline' })).toHaveAttribute('aria-pressed', 'true'); // complément libre gardé
    await user.click(pageObj.getByRole('button', { name: 'Whey' })); // décoché
    await user.click(pageObj.getByRole('button', { name: 'Créatine' })); // preset coché
    await user.click(pageObj.getByRole('button', { name: 'Enregistrer' }));

    const attendu = {
      ...profileMarc,
      objectif: { type: 'maintien' },
      poidsObjectif: 70,
      regime: 'keto',
      complements: ['Spiruline', 'Créatine'],
    };
    expect(loadProfile()).toEqual(attendu);
    expect(onProfileSaved).toHaveBeenCalledWith(attendu);
    expect(pageObj.getByRole('status')).toHaveTextContent(/enregistré/i);
  });

  it('poids visé vidé : retiré du profil', async () => {
    const { pageObj, user } = await ouvrir({ poidsObjectif: 72 });
    expect(pageObj.getByLabelText('Poids visé (kg)')).toHaveValue(72);
    await user.clear(pageObj.getByLabelText('Poids visé (kg)'));
    await user.click(pageObj.getByRole('button', { name: 'Enregistrer' }));
    expect(loadProfile()).toEqual(profileMarc);
  });

  it('poids visé hors bornes : erreur explicite, rien d’enregistré', async () => {
    const { pageObj, user } = await ouvrir();
    await user.type(pageObj.getByLabelText('Poids visé (kg)'), '500');
    await user.click(pageObj.getByRole('button', { name: 'Enregistrer' }));
    expect(pageObj.getByRole('alert')).toHaveTextContent(/poids visé/i);
    expect(loadProfile()).toBeNull();
  });

  it('suivi coupé : plus de résumé ni de cap, régime et compléments restent ; enregistré', async () => {
    const { pageObj, user, onProfileSaved } = await ouvrir({ poidsObjectif: 75 });
    const inter = pageObj.getByRole('switch', { name: /Suivre mon poids et un objectif/ });
    expect(inter).toBeChecked();
    await user.click(inter);
    expect(pageObj.queryByRole('radiogroup', { name: 'Ton cap' })).not.toBeInTheDocument();
    expect(pageObj.queryByText(/Pèse-toi/)).not.toBeInTheDocument();
    expect(pageObj.getByText(/Rituel reste une app de routine/)).toBeInTheDocument();
    expect(pageObj.getByRole('radiogroup', { name: 'Régime' })).toBeInTheDocument();
    await user.click(pageObj.getByRole('button', { name: 'Enregistrer' }));
    expect(loadProfile()).toMatchObject({ suivi: false, poidsObjectif: 75 }); // l'objectif reste, prêt si on réactive
    expect(onProfileSaved).toHaveBeenCalledWith(expect.objectContaining({ suivi: false }));

    await user.click(inter);
    await user.click(pageObj.getByRole('button', { name: 'Enregistrer' }));
    expect(loadProfile()?.suivi).toBeUndefined(); // absent = suivi
  });

  it('« Autre… » : ajoute un complément coché ; doublon refusé', async () => {
    const { pageObj, user } = await ouvrir({ complements: ['Whey'] });
    await user.click(pageObj.getByRole('button', { name: /Autre/ }));
    await user.type(pageObj.getByLabelText('Autre complément'), 'Zinc');
    await user.click(pageObj.getByRole('button', { name: 'Ajouter' }));
    expect(pageObj.getByRole('button', { name: 'Zinc' })).toHaveAttribute('aria-pressed', 'true');

    await user.type(pageObj.getByLabelText('Autre complément'), 'whey');
    await user.click(pageObj.getByRole('button', { name: 'Ajouter' }));
    expect(pageObj.getByRole('alert')).toHaveTextContent(/déjà/i);
  });
});
