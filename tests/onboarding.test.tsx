import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { Onboarding } from '../src/components/onboarding/Onboarding';
import { REGIMES } from '../src/lib/model';
import type { ProfilLegacy, Regime, UserProfile } from '../src/lib/model';
import { addWeight, getWeights, loadProfile } from '../src/lib/storage';
import { todayISO } from '../src/lib/dates';

// happy-dom ne déclenche pas la soumission implicite des formulaires :
// convention repo = fireEvent.submit.
const soumettre = () => fireEvent.submit(document.querySelector('.onboarding-form')!);

// Les input[type=date] ne se laissent pas taper : convention repo = fireEvent.change.
const saisirDate = (label: string, valeur: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value: valeur } });
};

const remplirEtape2 = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides: { poids?: string; dateNaissance?: string; taille?: string } = {},
) => {
  await user.clear(screen.getByLabelText('Poids (kg)'));
  await user.type(screen.getByLabelText('Poids (kg)'), overrides.poids ?? '62.4');
  saisirDate('Date de naissance', overrides.dateNaissance ?? '1987-03-02');
  await user.clear(screen.getByLabelText('Taille (cm)'));
  await user.type(screen.getByLabelText('Taille (cm)'), overrides.taille ?? '165');
};

const allerEtape2 = async () => {
  const user = userEvent.setup();
  render(<Onboarding onDone={onDone} />);
  await user.click(screen.getByRole('button', { name: /Mélanie/ }));
  await user.click(screen.getByRole('button', { name: /Continuer/ }));
  return user;
};

const allerEtape3 = async () => {
  const user = await allerEtape2();
  await remplirEtape2(user);
  await user.click(screen.getByRole('button', { name: /Continuer/ }));
  return user;
};

const allerEtape4 = async (choix: { regime?: Regime; complements?: string[] } = {}) => {
  const user = await allerEtape3();
  await user.click(screen.getByRole('button', { name: /Continuer/ }));
  // Les choix passés ici sont faits à l'étape 4, avant de quitter (états persistants).
  if (choix.complements) {
    for (const c of choix.complements) {
      await user.click(screen.getByRole('button', { name: c }));
    }
  }
  if (choix.regime) {
    const nom = REGIMES.find((r) => r.id === choix.regime)!.nom;
    await user.click(screen.getByRole('radio', { name: nom }));
  }
  return user;
};

const allerEtape5 = async (choix: { regime?: Regime; complements?: string[] } = {}) => {
  const user = await allerEtape4(choix);
  await user.click(screen.getByRole('button', { name: /Continuer/ }));
  expect(screen.getByRole('heading', { name: /Maison & courses/ })).toBeInTheDocument();
  return user;
};

let onDone: Mock<(profile: UserProfile) => void>;

beforeEach(() => {
  localStorage.clear();
  onDone = vi.fn();
});

describe('Onboarding — étape 1 (choix du profil)', () => {
  it('affiche la question, les deux cartes et 5 points de progression', () => {
    render(<Onboarding onDone={() => {}} />);

    expect(screen.getByRole('heading', { name: /Qui est derrière l'écran/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marc/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mélanie/ })).toBeInTheDocument();
    const dots = screen.getByRole('group', { name: /Progression/ });
    expect(dots.querySelectorAll('span')).toHaveLength(5);
    expect(dots.querySelectorAll('span')[0]).toHaveClass('onboarding-dot-active');
    expect(screen.queryByLabelText('Poids (kg)')).not.toBeInTheDocument();
  });

  it('choisir une carte la sélectionne, préremplit le prénom et affiche Continuer', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    const carte = screen.getByRole('button', { name: /Mélanie/ });
    expect(carte).toHaveClass('sel');
    expect(screen.getByLabelText("C'est ton prénom ?")).toHaveValue('Mélanie');

    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: /Salut Mélanie/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(screen.getByRole('button', { name: /Mélanie/ })).toHaveClass('sel');
  });

  it('le prénom édité est utilisé dans la salutation puis enregistré', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.clear(screen.getByLabelText("C'est ton prénom ?"));
    await user.type(screen.getByLabelText("C'est ton prénom ?"), 'Mel');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: /Salut Mel/ })).toBeInTheDocument();

    // Mêmes actions qu'allerEtape5, en poursuivant l'état courant (prénom édité).
    await remplirEtape2(user);
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: /Maison & courses/ })).toBeInTheDocument();
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ prenom: 'Mel' })),
    );
  });

  it('prénom vidé : salutation et profil retombent sur le défaut', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.clear(screen.getByLabelText("C'est ton prénom ?"));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: /Salut Mélanie/ })).toBeInTheDocument();
  });

  it('changer de carte réinitialise le prénom au défaut de la nouvelle carte', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.clear(screen.getByLabelText("C'est ton prénom ?"));
    await user.type(screen.getByLabelText("C'est ton prénom ?"), 'X');
    await user.click(screen.getByRole('button', { name: /Marc/ }));
    expect(screen.getByLabelText("C'est ton prénom ?")).toHaveValue('Marc');
  });
});

describe('Onboarding — étape 2 (infos : poids, date de naissance, taille)', () => {
  it('refuse un formulaire incomplet avec une erreur explicite', async () => {
    await allerEtape2();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Poids (kg)'), '62.4');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/incomplet/i);
    expect(loadProfile()).toBeNull();
  });

  it('refuse un poids hors bornes', async () => {
    const user = await allerEtape2();
    await remplirEtape2(user, { poids: '500' });
    await user.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/poids/i);
  });

  it('refuse une date de naissance dans le futur', async () => {
    const user = await allerEtape2();
    await remplirEtape2(user, { dateNaissance: '2999-01-01' });
    await user.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/futur/i);
  });

  it('refuse un âge calculé hors bornes (naissance en 2020)', async () => {
    const user = await allerEtape2();
    await remplirEtape2(user, { dateNaissance: '2020-01-01' });
    await user.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/10 et 100 ans/i);
  });

  it('passe à l étape 3 (objectif) quand les infos sont valides', async () => {
    await allerEtape3();

    expect(screen.getByRole('heading', { name: /Ton objectif/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Perte de poids/ })).toBeChecked();
  });
});

describe('Onboarding — étape 3 (objectif)', () => {
  it('permet de choisir un des 4 types et affiche sa description', async () => {
    const user = await allerEtape3();

    await user.click(screen.getByRole('radio', { name: /Prise de masse/ }));
    expect(screen.getByRole('radio', { name: /Prise de masse/ })).toBeChecked();
    expect(screen.getByText(/Prendre du muscle/)).toBeInTheDocument();
  });

  it('valide le poids objectif (refus hors bornes)', async () => {
    const user = await allerEtape3();
    await user.type(screen.getByLabelText('Poids objectif (kg)'), '500');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/poids objectif/i);
  });

  it('le retour conserve les infos saisies', async () => {
    const user = await allerEtape3();
    await user.click(screen.getByRole('button', { name: /Retour/ }));

    expect(screen.getByLabelText('Poids (kg)')).toHaveValue(62.4);
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: /Ton objectif/ })).toBeInTheDocument();
  });
});

describe('Onboarding — navigation clavier (Entrée = Continuer)', () => {
  it('Entrée à l étape 2 avance à l étape 3 (form submit → continuerInfos)', async () => {
    const user = await allerEtape2();
    await remplirEtape2(user);
    soumettre();

    expect(screen.getByRole('heading', { name: /Ton objectif/ })).toBeInTheDocument();
  });

  it('Entrée à l étape 3 avance à l étape 4 (form submit → continuerObjectif)', async () => {
    await allerEtape3();
    soumettre();

    expect(screen.getByRole('heading', { name: /Personnalisation/ })).toBeInTheDocument();
  });

  it('Entrée à l étape 4 avance à l étape 5 (form submit → aller(5)), sans enregistrer', async () => {
    const user = await allerEtape4();
    await user.type(screen.getByLabelText('Ajouter un complément'), 'Zinc');
    soumettre();

    expect(screen.getByRole('heading', { name: /Maison & courses/ })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(loadProfile()).toBeNull();
  });
});

describe('Onboarding — étape 4 (compléments et régime)', () => {
  it('bascule les compléments presets', async () => {
    const user = await allerEtape4();
    const whey = screen.getByRole('button', { name: 'Whey' });
    expect(whey).not.toHaveAttribute('aria-pressed', 'true');
    await user.click(whey);
    expect(whey).toHaveAttribute('aria-pressed', 'true');
    await user.click(whey);
    expect(whey).not.toHaveAttribute('aria-pressed', 'true');
  });

  it('ajoute un complément libre et refuse le doublon (casse ignorée)', async () => {
    const user = await allerEtape4();
    await user.click(screen.getByRole('button', { name: 'Whey' }));
    await user.type(screen.getByLabelText('Ajouter un complément'), 'whey');
    await user.click(screen.getByRole('button', { name: /Ajouter/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/déjà sélectionné/i);
    await user.clear(screen.getByLabelText('Ajouter un complément'));
    await user.type(screen.getByLabelText('Ajouter un complément'), 'Zinc');
    await user.click(screen.getByRole('button', { name: /Ajouter/ }));
    expect(screen.getByRole('button', { name: /Zinc/ })).toBeInTheDocument();
  });

  it('refuse « creatine » quand le chip « Créatine » est actif (accents ignorés)', async () => {
    const user = await allerEtape4();
    await user.click(screen.getByRole('button', { name: 'Créatine' }));
    await user.type(screen.getByLabelText('Ajouter un complément'), 'creatine');
    await user.click(screen.getByRole('button', { name: /Ajouter/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/déjà sélectionné/i);
    await user.clear(screen.getByLabelText('Ajouter un complément'));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    soumettre();
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({ complements: ['Créatine'] }),
      ),
    );
  });
});

describe('Onboarding — étape 5 (maison & courses)', () => {
  it('affiche les champs maison avec le datalist magasins', async () => {
    await allerEtape5();

    expect(screen.getByLabelText('Magasin habituel')).toHaveAttribute('list', 'ob-magasins');
    // <option value="…"/> n'a pas de texte : on vérifie les valeurs du datalist.
    const valeurs = [...document.querySelectorAll('#ob-magasins option')].map((o) =>
      o.getAttribute('value'),
    );
    expect(valeurs).toContain('Intermarché');
    expect(screen.getByLabelText('Budget max courses / semaine (€, optionnel)')).toBeInTheDocument();
    expect(screen.getByLabelText('Personnes à table')).toBeInTheDocument();
    expect(screen.getByLabelText('Repas par jour')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Healthy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batch-friendly' })).toBeInTheDocument();
  });

  it('bascule les préférences presets et refuse le doublon à l ajout libre', async () => {
    const user = await allerEtape5();
    await user.click(screen.getByRole('button', { name: 'Petit budget' }));
    expect(screen.getByRole('button', { name: 'Petit budget' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Healthy' }));
    await user.type(screen.getByLabelText('Ajouter une préférence'), 'healthy');
    await user.click(screen.getByRole('button', { name: /Ajouter/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/déjà sélectionné/i);
    await user.clear(screen.getByLabelText('Ajouter une préférence'));
    await user.type(screen.getByLabelText('Ajouter une préférence'), 'Végé');
    await user.click(screen.getByRole('button', { name: /Ajouter/ }));
    expect(screen.getByRole('button', { name: /Végé/ })).toBeInTheDocument();
  });

  it('refuse un budget max invalide ou des personnes hors bornes', async () => {
    const user = await allerEtape5();
    await user.type(screen.getByLabelText('Budget max courses / semaine (€, optionnel)'), '0');
    await user.click(screen.getByRole('button', { name: /C'est parti/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Budget max invalide/i);

    await user.clear(screen.getByLabelText('Budget max courses / semaine (€, optionnel)'));
    await user.type(screen.getByLabelText('Personnes à table'), '0');
    await user.click(screen.getByRole('button', { name: /C'est parti/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Personnes à table/i);
    expect(loadProfile()).toBeNull();
  });

  it('C est parti enregistre le profil v2 complet (régime choisi à l étape 4 + maison)', async () => {
    const user = await allerEtape5({ regime: 'keto', complements: ['Créatine'] });
    await user.type(screen.getByLabelText('Magasin habituel'), 'Lidl');
    await user.type(screen.getByLabelText('Budget max courses / semaine (€, optionnel)'), '40');
    await user.type(screen.getByLabelText('Personnes à table'), '4');
    await user.type(screen.getByLabelText('Repas par jour'), '3');
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        id: 'melanie',
        dateNaissance: '1987-03-02',
        taille: 165,
        prenom: 'Mélanie',
        objectif: { type: 'perte' },
        complements: ['Créatine'],
        regime: 'keto',
        magasin: 'Lidl',
        budgetMax: 40,
        personnes: 4,
        repasJour: 3,
      } satisfies UserProfile),
    );
    expect(getWeights('melanie')).toEqual([{ date: todayISO(), kg: 62.4 }]);
  });

  it('C est parti sans rien remplir : aucun champ maison n est écrit', async () => {
    await allerEtape5();
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        id: 'melanie',
        dateNaissance: '1987-03-02',
        taille: 165,
        prenom: 'Mélanie',
        objectif: { type: 'perte' },
        complements: [],
        regime: 'aucun',
      } satisfies UserProfile),
    );
  });
});

describe('Onboarding — migration (prefill ancienne forme)', () => {
  const legacy: ProfilLegacy = { id: 'marc', age: 41, taille: 178, poidsObjectif: 74 };

  it('démarre à l étape 2 avec le bandeau, sans points ni étape 1', () => {
    render(<Onboarding onDone={() => {}} prefill={legacy} />);

    expect(screen.getByText(/Une mise à jour/)).toBeInTheDocument();
    expect(screen.getByText(/non modifiable ici/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mélanie/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Progression/ })).not.toBeInTheDocument();
  });

  it('préremplit poids (dernière pesée), taille et poids objectif ; date vide', () => {
    addWeight('marc', '2026-09-01', 79.1);
    addWeight('marc', '2026-09-09', 78.4);
    render(<Onboarding onDone={() => {}} prefill={legacy} />);

    expect(screen.getByLabelText('Poids (kg)')).toHaveValue(78.4);
    expect(screen.getByLabelText('Taille (cm)')).toHaveValue(178);
    expect(screen.getByLabelText('Poids objectif (kg)')).toHaveValue(74);
    expect(screen.getByLabelText('Date de naissance')).toHaveValue('');
  });

  it('la date de naissance reste obligatoire avant de continuer', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} prefill={legacy} />);
    await user.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/incomplet/i);
  });

  it('migration sans pesée : le message d erreur cite la date seule (pas le poids)', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} prefill={legacy} />);
    await user.click(screen.getByRole('button', { name: /Continuer/ }));

    const alerte = screen.getByRole('alert');
    expect(alerte).toHaveTextContent(/incomplet/i);
    expect(alerte.textContent).not.toContain('poids');
  });

  it('enregistre le profil v2 (migration à sens unique) et appelle onDone', async () => {
    addWeight('marc', '2026-09-09', 78.4);
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} prefill={legacy} />);
    saisirDate('Date de naissance', '1985-04-12');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        id: 'marc',
        dateNaissance: '1985-04-12',
        taille: 178,
        poidsObjectif: 74,
        objectif: { type: 'perte' },
        complements: [],
        regime: 'aucun',
      } satisfies UserProfile),
    );
  });

  it('migration sans pesée : aucune pesée n est créée à l enregistrement', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} prefill={legacy} />);
    saisirDate('Date de naissance', '1985-04-12');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    soumettre();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(getWeights('marc')).toEqual([]);
  });
});
