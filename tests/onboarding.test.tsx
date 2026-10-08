import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { Onboarding } from '../src/components/onboarding/Onboarding';
import { REGIMES } from '../src/lib/model';
import type { ProfilLegacy, Regime, UserProfile } from '../src/lib/model';
import { addWeight, getWeights, loadProfile } from '../src/lib/storage';
import { todayISO } from '../src/lib/dates';
import { loadFoyer } from '../src/lib/cycle/etat';

// Ids de profil déterministes : « Mélanie » → melanie (sans suffixe aléatoire).
vi.mock('../src/lib/model', async (importOriginal) => {
  const reel = await importOriginal<typeof import('../src/lib/model')>();
  return { ...reel, nouvelIdProfil: (p: string) => reel.nouvelIdProfil(p, () => 'x').replace(/-x$/, '') };
});

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

// Étape 1 : prénom + « Suivre mon poids » (les étapes 2-3 n'existent qu'avec le suivi).
const etape1 = async (user: ReturnType<typeof userEvent.setup>, prenom = 'Mélanie', suivi = true) => {
  await user.type(screen.getByLabelText("Comment tu t'appelles ?"), prenom);
  if (suivi) await user.click(screen.getByRole('radio', { name: /Suivre mon poids/ }));
  await user.click(screen.getByRole('button', { name: /Continuer/ }));
};

const allerEtape2 = async () => {
  const user = userEvent.setup();
  render(<Onboarding onDone={(p) => onDone(p)} />);
  await etape1(user);
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

describe('Onboarding — étape 1 (prénom, pour qui, routine ou suivi)', () => {
  it('aucun prénom imposé : question ouverte, 5 points de progression, « Juste la routine » par défaut', () => {
    render(<Onboarding onDone={() => {}} />);
    expect(screen.getByRole('heading', { name: /Bienvenue sur Rituel/ })).toBeInTheDocument();
    expect(screen.queryByText(/Marc|Mélanie/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Comment tu t'appelles ?")).toHaveAttribute('maxLength', '20');
    expect(screen.getByRole('radio', { name: 'Juste moi' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Juste la routine/ })).toBeChecked();
    const dots = screen.getByRole('group', { name: /Progression/ });
    expect(dots.querySelectorAll('span')).toHaveLength(5);
  });

  it('prénom obligatoire', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ton prénom, pour commencer.');
  });

  it('« À deux » demande le/la partenaire, « En famille » aussi les enfants (ajout / retrait)', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    expect(screen.queryByLabelText(/partenaire/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'À deux' }));
    expect(screen.getByLabelText(/partenaire/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Prénom d'un enfant")).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'En famille' }));
    await user.type(screen.getByLabelText("Prénom d'un enfant"), 'Léo');
    await user.click(screen.getByRole('button', { name: /Ajouter/ }));
    await user.type(screen.getByLabelText("Prénom d'un enfant"), 'Zoé{Enter}');
    await user.click(screen.getByRole('button', { name: 'Retirer Léo' }));
    expect(screen.getByRole('button', { name: 'Retirer Zoé' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer Léo' })).not.toBeInTheDocument();
  });

  it('avec suivi : salutation au prénom saisi, puis mesures ; le retour garde la saisie', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await etape1(user, 'Thérèse');
    expect(screen.getByRole('heading', { name: /Salut Thérèse/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(screen.getByLabelText("Comment tu t'appelles ?")).toHaveValue('Thérèse');
  });

  it('juste la routine : saute mesures et objectif, profil sans suivi, foyer créé (moi, partenaire, enfants)', async () => {
    const user = userEvent.setup();
    const fin = vi.fn();
    render(<Onboarding onDone={fin} />);
    await user.type(screen.getByLabelText("Comment tu t'appelles ?"), 'Jean');
    await user.click(screen.getByRole('radio', { name: 'En famille' }));
    await user.type(screen.getByLabelText(/partenaire/), 'Thérèse');
    await user.type(screen.getByLabelText("Prénom d'un enfant"), 'Léo{Enter}');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: 'Personnalisation' })).toBeInTheDocument(); // étape 4
    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(screen.getByRole('heading', { name: /Bienvenue/ })).toBeInTheDocument(); // retour direct à l'étape 1
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    soumettre();

    await waitFor(() => expect(fin).toHaveBeenCalled());
    const [profil, foyerLocal] = fin.mock.calls[0];
    expect(profil).toMatchObject({ id: 'jean', prenom: 'Jean', suivi: false });
    expect(foyerLocal).toBe(true);
    expect(loadFoyer()?.membres).toEqual([
      { id: 'jean', prenom: 'Jean', type: 'adulte', suivi: false, telephone: true },
      { id: 'therese', prenom: 'Thérèse', type: 'adulte', suivi: false },
      { id: 'leo', prenom: 'Léo', type: 'enfant', suivi: false },
    ]);
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

describe('Onboarding — étape 4 (compléments, régime — sans doublon d objectif)', () => {
  it('ne propose plus le doublon d objectif (ni type ni poids objectif)', async () => {
    await allerEtape4();

    expect(screen.queryByRole('radio', { name: /Perte de poids/ })).toBeNull();
    expect(screen.queryByLabelText('Poids objectif (kg)')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Aucun' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Whey' })).toBeInTheDocument();
  });

  it('l objectif choisi à l étape 3 survit au passage à l étape 4', async () => {
    const user = await allerEtape3();
    await user.click(screen.getByRole('radio', { name: /Prise de masse/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    // L'étape 4 n'affiche plus d'objectif mais l'état est conservé pour l'enregistrement.
    soumettre();
    expect(screen.getByRole('heading', { name: /Maison & courses/ })).toBeInTheDocument();
  });

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
    // Qui est à table : le foyer ; quels repas : la semaine type — plus de questions en double.
    expect(screen.queryByLabelText('Personnes à table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Repas par jour')).not.toBeInTheDocument();
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

  it('refuse un budget max invalide', async () => {
    const user = await allerEtape5();
    await user.type(screen.getByLabelText('Budget max courses / semaine (€, optionnel)'), '0');
    await user.click(screen.getByRole('button', { name: /C'est parti/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Budget max invalide/i);
    expect(loadProfile()).toBeNull();
  });

  it('C est parti enregistre le profil v2 complet (régime choisi à l étape 4 + maison)', async () => {
    const user = await allerEtape5({ regime: 'keto', complements: ['Créatine'] });
    await user.type(screen.getByLabelText('Magasin habituel'), 'Lidl');
    await user.type(screen.getByLabelText('Budget max courses / semaine (€, optionnel)'), '40');
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
    render(<Onboarding onDone={(p) => onDone(p)} prefill={legacy} />);
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
    render(<Onboarding onDone={(p) => onDone(p)} prefill={legacy} />);
    saisirDate('Date de naissance', '1985-04-12');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    soumettre();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(getWeights('marc')).toEqual([]);
  });
});

describe('Onboarding — CTA « Passer » (tout sautable sauf l étape 1)', () => {
  it('l étape 2 peut être passée : on arrive à l objectif sans rien remplir', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await etape1(user);
    await user.click(screen.getByRole('button', { name: 'Passer' }));

    expect(screen.getByRole('heading', { name: /Ton objectif/ })).toBeInTheDocument();
  });

  it('les étapes 3 et 4 peuvent être passées', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={(p) => onDone(p)} />);
    await etape1(user);
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));

    expect(screen.getByRole('heading', { name: /Maison & courses/ })).toBeInTheDocument();
  });

  it('parcours tout sauté : profil minimal sans date ni taille ni poids', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={(p) => onDone(p)} />);
    await etape1(user);
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        id: 'melanie',
        prenom: 'Mélanie',
        objectif: { type: 'perte' },
        complements: [],
        regime: 'aucun',
      } satisfies UserProfile),
    );
    expect(getWeights('melanie')).toEqual([]);
  });

  it('champs présents = validés même en parcours sauté (poids saisi puis Passer)', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await etape1(user);
    await user.type(screen.getByLabelText('Poids (kg)'), '500');
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    soumettre();

    expect(screen.getByRole('alert')).toHaveTextContent(/Poids invalide/i);
    expect(loadProfile()).toBeNull();
  });

  it('date seule : profil avec date, sans taille, sans pesée', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={(p) => onDone(p)} />);
    await etape1(user);
    saisirDate('Date de naissance', '1987-03-02');
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({ dateNaissance: '1987-03-02' }),
      ),
    );
    expect(onDone.mock.calls[0][0]).not.toHaveProperty('taille');
    expect(getWeights('melanie')).toEqual([]);
  });

  it('migration tout sautée : aucune donnée perdue (poids objectif, taille, pesée du jour)', async () => {
    const legacy: ProfilLegacy = { id: 'marc', age: 41, taille: 178, poidsObjectif: 74 };
    addWeight('marc', '2026-09-01', 79.1);
    addWeight('marc', '2026-09-09', 78.4);
    const user = userEvent.setup();
    render(<Onboarding onDone={(p) => onDone(p)} prefill={legacy} />);
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({ taille: 178, poidsObjectif: 74 }),
      ),
    );
    // Rien n'est perdu : les 2 pesées préexistantes + la pesée du jour
    // (poids prérempli de la migration) — addWeight upsert par date, tri asc.
    expect(getWeights('marc')).toEqual([
      { date: '2026-09-01', kg: 79.1 },
      { date: '2026-09-09', kg: 78.4 },
      { date: todayISO(), kg: 78.4 },
    ]);
  });
});
