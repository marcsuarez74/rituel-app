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
    expect(screen.getByRole('heading', { name: 'Le foyer', level: 2 })).toBeInTheDocument();
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

  it('affiche les objectifs existants et enregistre leurs modifications', async () => {
    render(
      <ProfilScreen
        profile={{ ...profileMarc, poidsObjectif: 72 }}
        onBack={onBack}
        onChangeProfile={onChangeProfile}
        onProfileSaved={onProfileSaved}
       
      />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Objectif'));

    expect(screen.getByLabelText('Poids objectif (kg)')).toHaveValue(72);
    expect(screen.queryByLabelText('Objectif kcal/jour')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Poids objectif (kg)'));
    await user.type(screen.getByLabelText('Poids objectif (kg)'), '70');
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));

    const attendu = { ...profileMarc, poidsObjectif: 70 };
    expect(loadProfile()).toEqual(attendu);
    expect(onProfileSaved).toHaveBeenCalledWith(attendu);
  });

  it('permet de supprimer le poids objectif en vidant le champ', async () => {
    render(
      <ProfilScreen
        profile={{ ...profileMarc, poidsObjectif: 72 }}
        onBack={onBack}
        onChangeProfile={onChangeProfile}
        onProfileSaved={onProfileSaved}
       
      />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Objectif'));

    await user.clear(screen.getByLabelText('Poids objectif (kg)'));
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));

    expect(loadProfile()).toEqual(profileMarc);
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

  it('refuse un poids objectif hors bornes avec une erreur explicite', async () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Objectif'));

    await user.type(screen.getByLabelText('Poids objectif (kg)'), '500');
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));

    expect(within(page('Objectif')).getByRole('alert')).toHaveTextContent(/poids objectif/i);
    expect(loadProfile()).toBeNull();
  });

  it('complément en doublon : alerte rendue dans la page Objectif', async () => {
    render(
      <ProfilScreen profile={{ ...profileMarc, complements: ['Whey'] }} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Objectif'));

    await user.type(screen.getByLabelText('Ajouter un complément'), 'whey');
    await user.click(within(page('Objectif')).getByRole('button', { name: /Ajouter/ }));

    expect(within(page('Objectif')).getByRole('alert')).toHaveTextContent(/déjà sélectionné/i);
  });

  it('sections dédiées : objectif affiché et modifiable', async () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Objectif'));

    expect(screen.getByRole('heading', { name: 'Objectif', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Perte de poids' })).toBeChecked();
    expect(screen.getByLabelText('Échéance (optionnelle)')).toHaveValue('2026-12-15');

    await user.click(screen.getByRole('radio', { name: 'Maintien' }));
    fireEvent.change(screen.getByLabelText('Échéance (optionnelle)'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));

    expect(loadProfile()?.objectif).toEqual({ type: 'maintien' });
    expect(onProfileSaved).toHaveBeenCalled();
  });

  it('sections dédiées : compléments ajoutés et retirés, persistés', async () => {
    render(
      <ProfilScreen profile={{ ...profileMarc, complements: ['Whey'] }} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Objectif'));

    expect(screen.getByRole('button', { name: /Whey/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Ajouter un complément'), 'Zinc');
    await user.click(within(page('Objectif')).getByRole('button', { name: /Ajouter/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer les compléments' }));

    expect(loadProfile()).toMatchObject({ complements: ['Whey', 'Zinc'] });

    await user.click(screen.getByRole('button', { name: /Retirer Whey/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer les compléments' }));
    expect(loadProfile()).toMatchObject({ complements: ['Zinc'] });
  });

  it('sections dédiées : régime persisté', async () => {
    render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} />,
    );
    const user = userEvent.setup();
    await user.click(ouvrirPage('Objectif'));

    await user.click(screen.getByRole('radio', { name: 'Végétarien' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le régime' }));

    expect(loadProfile()).toMatchObject({ regime: 'vegetarien' });
  });

  it('hub : tuile Mes infos avec résumé, ouvre la page, « ‹ Profil » revient', async () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    const user = userEvent.setup();
    render(
      <ProfilScreen profile={{ ...profileMarc, prenom: 'Marc' }} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} cycle={2} />,
    );

    // En-tête compte : initiale + prénom + duo/cycle
    expect(screen.getByText('M')).toBeInTheDocument(); // initiale avatar
    expect(screen.getByText('Marc')).toBeInTheDocument();
    expect(screen.queryByText(/Duo/)).not.toBeInTheDocument(); // sync off : chip masquée
    expect(screen.getByText('Cycle 2')).toBeInTheDocument();
    // Tuile Mes infos : résumé âge/taille (41 ans au 09/09/2026)
    expect(ouvrirPage('Mes infos')).toHaveTextContent('41 ans · 178 cm');

    await user.click(ouvrirPage('Mes infos'));
    expect(screen.getByRole('heading', { name: 'Mes infos', level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toHaveValue('Marc');

    await user.click(screen.getByRole('button', { name: /Profil/ }));
    expect(screen.queryByRole('heading', { name: 'Mes infos', level: 2 })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('hub : sous-ligne duo selon syncEtat', () => {
    const { rerender } = render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} syncEtat="sync" cycle={2} />,
    );
    expect(screen.getByText('Duo connecté')).toBeInTheDocument();

    rerender(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} syncEtat="hors-foyer" cycle={2} />,
    );
    expect(screen.getByText('Local')).toBeInTheDocument();

    rerender(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} syncEtat="off" cycle={2} />,
    );
    expect(screen.queryByText(/Duo|Local/)).not.toBeInTheDocument();
  });
});

describe('ProfilScreen — Courses & budget', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('préremplit les champs depuis le profil et propose le datalist magasins', async () => {
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
    await user.click(ouvrirPage('Courses & budget'));

    const maison = page('Courses & budget');
    expect(screen.getByLabelText('Magasin habituel')).toHaveValue('Lidl');
    expect(screen.getByLabelText('Magasin habituel')).toHaveAttribute('list', 'pf-magasins');
    // inputs texte (+ inputMode) : jest-dom renvoie la valeur sous forme de chaîne.
    expect(screen.getByLabelText('Budget max courses / semaine (€)')).toHaveValue('40');
    expect(screen.getByLabelText('Personnes à table')).toHaveValue('4');
    expect(screen.getByLabelText('Repas par jour')).toHaveValue('3');
    expect(within(maison).getByRole('button', { name: /Retirer Healthy/ })).toBeInTheDocument();
    expect(within(maison).getByRole('button', { name: /Retirer Rapide/ })).toBeInTheDocument();
    // Mêmes champs que l'onboarding : le bloc de chips porte le même libellé.
    expect(within(maison).getByText('Préférences pour les prochains cycles')).toBeInTheDocument();
  });

  it('enregistre la section (validation incluse)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen profile={profileMarc} onBack={() => {}} onChangeProfile={() => {}} />,
    );
    await user.click(ouvrirPage('Courses & budget'));
    const maison = page('Courses & budget');

    await user.type(screen.getByLabelText('Magasin habituel'), 'Lidl');
    await user.type(screen.getByLabelText('Budget max courses / semaine (€)'), '40');
    await user.click(within(maison).getByRole('button', { name: /Ajouter/ })); // sans saisir → no-op
    await user.type(screen.getByLabelText('Ajouter une préférence'), 'Batch-friendly');
    await user.click(within(maison).getByRole('button', { name: /Ajouter/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer maison & courses' }));

    expect(loadProfile()).toEqual(
      expect.objectContaining({ magasin: 'Lidl', budgetMax: 40, preferences: ['Batch-friendly'] }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Enregistré/);
  });

  it('refuse un budget max invalide (erreur rendue dans la page)', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen profile={profileMarc} onBack={() => {}} onChangeProfile={() => {}} />,
    );
    await user.click(ouvrirPage('Courses & budget'));

    await user.type(screen.getByLabelText('Budget max courses / semaine (€)'), '0');
    await user.click(screen.getByRole('button', { name: 'Enregistrer maison & courses' }));

    expect(within(page('Courses & budget')).getByRole('alert')).toHaveTextContent(/Budget max invalide/i);
    expect(loadProfile()).toBeNull();
  });

  it('vider les champs et enregistrer retire les données maison du profil', async () => {
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
    await user.click(ouvrirPage('Courses & budget'));

    await user.clear(screen.getByLabelText('Magasin habituel'));
    await user.clear(screen.getByLabelText('Budget max courses / semaine (€)'));
    await user.clear(screen.getByLabelText('Personnes à table'));
    await user.clear(screen.getByLabelText('Repas par jour'));
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

    await user.click(await screen.findByRole('button', { name: 'Mon profil' }));
    expect(await screen.findByRole('button', { name: /Mes infos/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
  });

  it('la réouverture de l’écran montre les infos enregistrées (pas d’état périmé)', async () => {
    const user = monterApp();

    await user.click(await screen.findByRole('button', { name: 'Mon profil' }));
    await user.click(await screen.findByRole('button', { name: /Mes infos/ }));
    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '1984-04-12' } });
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes infos' }));

    await user.click(screen.getByRole('button', { name: /Profil/ })); // page → hub
    await user.click(screen.getByRole('button', { name: /Retour/ })); // hub → shell
    await user.click(screen.getByRole('button', { name: 'Mon profil' }));
    await user.click(await screen.findByRole('button', { name: /Mes infos/ }));

    expect(screen.getByLabelText('Date de naissance')).toHaveValue('1984-04-12');
  });

  it('changer de profil efface le choix (onboarding) mais garde les données', async () => {
    addWeight('marc', '2026-09-22', 84.2);
    const spy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', spy);
    const user = monterApp();

    await user.click(await screen.findByRole('button', { name: 'Mon profil' }));
    await user.click(await screen.findByRole('button', { name: /Changer de profil/ }));

    expect(loadProfile()).toBeNull();
    expect(await screen.findByRole('heading', { name: /Qui est derrière l'écran/ })).toBeInTheDocument();
    expect(getWeights('marc')).toEqual([{ date: '2026-09-22', kg: 84.2 }]);
  });
});
