import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { addWeight, loadProfile, saveProfile } from '../src/lib/storage';
import { foyerParDefaut, loadFoyer, saveFoyer } from '../src/lib/cycle/etat';
import type { ProfileKey } from '../src/lib/model';

// Toute vue shell suppose un profil choisi (onboarding passé).
const initProfile = (id: ProfileKey = 'marc', prenom?: string) =>
  saveProfile({
    id,
    ...(prenom ? { prenom } : {}),
    dateNaissance: id === 'marc' ? '1985-04-12' : '1987-03-02',
    taille: id === 'marc' ? 178 : 165,
    objectif: { type: 'perte', echeance: '2026-12-15' },
    complements: [],
    regime: id === 'melanie' ? 'keto' : 'aucun',
  });

const loadProfileDe = (id: ProfileKey) => {
  initProfile(id);
  return loadProfile()!;
};

const nav = () => screen.getByRole('navigation', { name: 'Navigation principale' });
const onglet = (nom: string) => within(nav()).getByRole('button', { name: nom });

describe('App shell v2', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date('2026-10-07T10:00:00')); // mercredi
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche l’onboarding quand aucun profil n’est choisi', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Bienvenue sur Rituel/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument();
  });

  it('sans cycle importé : Aujourd’hui sur le cycle d’exemple, démarré au dernier jour des courses', async () => {
    initProfile('marc', 'Jean');
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeInTheDocument();
    expect(await screen.findByText(/Salut Jean/)).toBeInTheDocument();
    expect(screen.getByText('mercredi 7 octobre')).toBeInTheDocument();
    expect(await screen.findByText('Cycle 1 · semaine 1 sur 4 · Menu A')).toBeInTheDocument();
    expect(screen.getByText(/Cycle d'exemple/)).toBeInTheDocument();
    // Le menu du jour (mercredi) de l'exemple, avec ses repas cochables.
    expect(screen.getByRole('heading', { name: "Au menu aujourd'hui" })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /marquer comme fait/ }).length).toBeGreaterThan(0);
  });

  it('barre du bas : 5 onglets libellés, l’actif en aria-current, titre de l’en-tête suivi', async () => {
    initProfile();
    const user = userEvent.setup();
    render(<App />);

    const noms = within(nav()).getAllByRole('button').map((b) => b.textContent);
    expect(noms).toEqual(["Aujourd'hui", 'Menu', 'Courses', 'Rituel', 'Suivi']);
    expect(onglet("Aujourd'hui")).toHaveAttribute('aria-current', 'page');

    await user.click(onglet('Courses'));
    expect(onglet('Courses')).toHaveAttribute('aria-current', 'page');
    expect(onglet("Aujourd'hui")).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument();
  });

  it('juste la routine (suivi coupé) : 4 onglets, pas de Suivi', async () => {
    saveProfile({ ...loadProfileDe('marc'), suivi: false });
    render(<App />);
    const noms = within(nav()).getAllByRole('button').map((b) => b.textContent);
    expect(noms).toEqual(["Aujourd'hui", 'Menu', 'Courses', 'Rituel']);
  });

  it('au démarrage, mon membre du foyer est marqué « sur ce téléphone » et suit mon profil', async () => {
    saveProfile({ ...loadProfileDe('therese-3f9a'), prenom: 'Thérèse', suivi: false });
    saveFoyer({ ...foyerParDefaut(null), membres: [{ id: 'jean-01ab', prenom: 'Jean', type: 'adulte', suivi: true, telephone: true }] });
    render(<App />);
    expect(loadFoyer()?.membres).toEqual([
      { id: 'jean-01ab', prenom: 'Jean', type: 'adulte', suivi: true, telephone: true },
      { id: 'therese-3f9a', prenom: 'Thérèse', type: 'adulte', suivi: false, telephone: true },
    ]);
  });

  it('cycle d’exemple aux prénoms du foyer, jamais ceux d’une autre famille', async () => {
    saveProfile({ ...loadProfileDe('therese-3f9a'), prenom: 'Thérèse' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Cycle d'exemple/);
    await user.click(onglet('Menu'));
    expect(await screen.findAllByText(/Thérèse/)).not.toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/Marc|Mélanie|Maëlle|Maxine|\bAlex\b/); // Alex = rôle anonyme non remplacé
  });

  it('ligne semaine sur Menu / Courses / Rituel seulement, navigation dans les 4 semaines', async () => {
    initProfile();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Salut/);
    expect(screen.queryByText(/Sem\. 1/)).not.toBeInTheDocument();

    await user.click(onglet('Menu'));
    expect(screen.getByText(/Sem\. 1 · 3 → 9 oct\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    expect(screen.getByText(/Sem\. 2 · 10 → 16 oct\./)).toHaveTextContent('Menu B');

    await user.click(onglet('Rituel'));
    expect(screen.getByText(/Sem\. 2/)).toBeInTheDocument(); // la semaine consultée est gardée
    await user.click(onglet('Suivi'));
    expect(screen.queryByText(/Sem\. 2/)).not.toBeInTheDocument();
  });

  it('Suivi : objectif et poids, sans séances (reportées)', async () => {
    initProfile();
    addWeight('marc', '2026-10-05', 82.4);
    const user = userEvent.setup();
    render(<App />);

    await user.click(onglet('Suivi'));
    expect(await screen.findByRole('heading', { name: 'Suivi poids' })).toBeInTheDocument();
    expect(screen.getByText('05/10 — 82.4 kg')).toBeInTheDocument();
    expect(screen.queryByText(/Séances/)).not.toBeInTheDocument();
  });

  it('un cycle importé remplace l’exemple', async () => {
    initProfile();
    const { importerCycle } = await import('../src/lib/cycle/valider');
    const { saveCycle } = await import('../src/lib/cycle/etat');
    const { enFichiers, quatreFichiers } = await import('./lib/cycle/fabrique');
    const cycle = importerCycle(enFichiers(quatreFichiers())).cycle!;
    saveCycle({ id: 'c7', numero: 3, debut: '2026-09-26', pauses: [], cycle });
    render(<App />);

    expect(await screen.findByText('Cycle 3 · semaine 2 sur 4 · Menu B')).toBeInTheDocument();
    expect(screen.queryByText(/Cycle d'exemple/)).not.toBeInTheDocument();
  });

  it('cocher un repas d’Aujourd’hui le compte dans la semaine et le retrouve dans Menu', async () => {
    initProfile();
    const { importerCycle } = await import('../src/lib/cycle/valider');
    const { saveCycle } = await import('../src/lib/cycle/etat');
    const { getChecks } = await import('../src/lib/storage');
    const { enFichiers, quatreFichiers } = await import('./lib/cycle/fabrique');
    const fs = quatreFichiers();
    for (const f of fs) for (const m of f.menus) for (const j of m.jours) for (const r of j.repas) r.pour = 'famille';
    saveCycle({ id: 'c7', numero: 1, debut: '2026-10-03', pauses: [], cycle: importerCycle(enFichiers(fs)).cycle! });
    const user = userEvent.setup();
    render(<App />);

    const repas = await screen.findByRole('button', { name: 'Recette diner-a-mercredi : marquer comme fait' });
    expect(screen.getByRole('button', { name: /Repas/ })).toHaveTextContent('0/7');
    await user.click(repas);
    expect(screen.getByRole('button', { name: /Repas/ })).toHaveTextContent('1/7');
    expect(getChecks('cycle:c7:0')).toEqual({ 'menu:A:mercredi:mercredi-diner-famille': true });

    await user.click(onglet('Menu'));
    expect(await screen.findByRole('tab', { name: 'Mercredi', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recette diner-a-mercredi : fait, annuler' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fiche recette : ouverte depuis le menu, « C’est fait » coche le repas, retour au menu', async () => {
    initProfile();
    const { importerCycle } = await import('../src/lib/cycle/valider');
    const { saveCycle } = await import('../src/lib/cycle/etat');
    const { enFichiers, quatreFichiers } = await import('./lib/cycle/fabrique');
    saveCycle({ id: 'c7', numero: 1, debut: '2026-10-03', pauses: [], cycle: importerCycle(enFichiers(quatreFichiers())).cycle! });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Toute la semaine/ }));
    await user.click(await screen.findByRole('tab', { name: 'Jeudi' }));
    await user.click(screen.getByRole('button', { name: /^Dîner famille/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Recette diner-a-jeudi' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "C'est fait" }));
    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(await screen.findByRole('button', { name: 'Recette diner-a-jeudi : fait, annuler' })).toBeInTheDocument();
  });

  it('report : demain (toast Annuler), semaine prochaine → à placer, courses « déjà au frigo ? »', async () => {
    initProfile();
    const { importerCycle } = await import('../src/lib/cycle/valider');
    const { saveCycle, getReports } = await import('../src/lib/cycle/etat');
    const { enFichiers, quatreFichiers } = await import('./lib/cycle/fabrique');
    const fs = quatreFichiers();
    for (const f of fs) for (const m of f.menus) for (const j of m.jours) for (const r of j.repas) r.pour = 'famille';
    saveCycle({ id: 'c7', numero: 1, debut: '2026-10-03', pauses: [], cycle: importerCycle(enFichiers(fs)).cycle! });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Toute la semaine/ }));
    await user.click(await screen.findByRole('button', { name: 'Pas ce soir : reporter' }));
    const feuille = screen.getByRole('dialog', { name: 'Reporter « Recette diner-a-mercredi »' });
    await user.click(within(feuille).getByRole('button', { name: /Demain, jeudi/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Reporté : demain, jeudi');
    expect(screen.queryByText('Recette diner-a-mercredi')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Jeudi' }));
    expect(screen.getByText(/reporté de mercredi/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(getReports('c7')).toEqual([]);

    await user.click(screen.getByRole('tab', { name: 'Mercredi' }));
    await user.click(screen.getByRole('button', { name: 'Pas ce soir : reporter' }));
    await user.click(screen.getByRole('button', { name: /Semaine prochaine/ }));
    await user.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    const encadre = screen.getByRole('region', { name: 'Reporté de la semaine dernière' });
    expect(within(encadre).getByText('Recette diner-a-mercredi')).toBeInTheDocument();
    await user.click(within(encadre).getByRole('button', { name: /^Le / }));
    expect(screen.queryByRole('region', { name: 'Reporté de la semaine dernière' })).not.toBeInTheDocument();

    await user.click(onglet('Courses'));
    const frigo = await screen.findByRole('region', { name: 'Déjà au frigo ?' });
    const oeufs = within(frigo).getByRole('button', { name: /Œufs/ });
    expect(oeufs).toHaveAttribute('aria-pressed', 'true');
    await user.click(oeufs);
    expect(oeufs).toHaveTextContent('à racheter');
  });

  it('ne pose pas data-profile sur <html> (accent unique)', () => {
    initProfile('melanie');
    render(<App />);
    expect(document.documentElement.getAttribute('data-profile')).toBeNull();
  });
});

describe('Onboarding — persistance via App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parcours complet 5 étapes : objectif, compléments et régime persistés', async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Comment tu t'appelles ?"), 'Jean');
    await user.click(screen.getByRole('radio', { name: /Suivre mon poids/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.type(screen.getByLabelText('Poids (kg)'), '85');
    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '1985-04-12' } });
    await user.type(screen.getByLabelText('Taille (cm)'), '178');
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('radio', { name: /Affiner/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: 'Créatine' }));
    await user.click(screen.getByRole('radio', { name: 'Keto' }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    // happy-dom ne soumet pas le form au clic du bouton (convention repo : fireEvent.submit)
    fireEvent.submit(document.querySelector('.onboarding-form')!);

    expect(JSON.parse(localStorage.getItem('sportapp:profile')!)).toMatchObject({
      id: expect.stringMatching(/^jean-[0-9a-f]{4}$/),
      prenom: 'Jean',
      objectif: { type: 'affiner' },
      complements: ['Créatine'],
      regime: 'keto',
    });
    // Étape optionnelle « Ta semaine » (foyer né de cette inscription).
    expect(await screen.findByRole('heading', { name: 'Ta semaine' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(localStorage.getItem('sportapp:foyer')).not.toBeNull();
  });
});

describe('Migration profil v1 → v2', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('un profil ancien (age) relance l onboarding prérempli à l étape 2', async () => {
    localStorage.setItem('sportapp:profile', JSON.stringify({ id: 'marc', age: 41, taille: 178 }));
    addWeight('marc', '2026-09-09', 78.4);
    render(<App />);

    expect(await screen.findByText(/Une mise à jour/)).toBeInTheDocument();
    expect(screen.getByText(/non modifiable ici/)).toBeInTheDocument();
    expect(screen.getByLabelText('Poids (kg)')).toHaveValue(78.4);
    expect(screen.getByLabelText('Date de naissance')).toHaveValue('');
    expect(screen.queryByRole('button', { name: /Mélanie/ })).not.toBeInTheDocument();
  });

  it('après migration, le profil v2 est enregistré et l app s affiche', async () => {
    localStorage.setItem('sportapp:profile', JSON.stringify({ id: 'melanie', age: 38, taille: 165 }));
    const user = userEvent.setup();
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Date de naissance'), { target: { value: '1987-03-02' } });
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    fireEvent.submit(document.querySelector('.onboarding-form')!);

    expect(JSON.parse(localStorage.getItem('sportapp:profile')!)).toMatchObject({
      id: 'melanie',
      dateNaissance: '1987-03-02',
      objectif: { type: 'perte' },
      regime: 'aucun',
    });
    // Étape optionnelle « Ta semaine » (foyer né de cette inscription).
    expect(await screen.findByRole('heading', { name: 'Ta semaine' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(localStorage.getItem('sportapp:foyer')).not.toBeNull();
  });
});
