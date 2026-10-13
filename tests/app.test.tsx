import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { addWeight, loadProfile, saveProfile } from '../src/lib/storage';
import { foyerParDefaut, loadCycle, loadFoyer, saveCycle, saveFoyer } from '../src/lib/cycle/etat';
import { importerCycle } from '../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './lib/cycle/fabrique';
import type { ProfileKey } from '../src/lib/model';

const cycleDuTest = () => importerCycle(enFichiers(quatreFichiers())).cycle!;

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

  it('sans cycle importé : Aujourd’hui sur les menus d’exemple', async () => {
    initProfile('marc', 'Jean');
    render(<App />);

    // L'en-tête porte la salutation (h1) et la date (sous-titre).
    expect(screen.getByRole('heading', { level: 1, name: 'Bonjour Jean' })).toBeInTheDocument();
    expect(screen.getByText('Mercredi 7 octobre')).toBeInTheDocument();
    expect(await screen.findByText(/Menus d'exemple/)).toBeInTheDocument();
    // Le menu du jour (mercredi) de l'exemple, avec ses repas cochables.
    expect(screen.getByRole('heading', { name: "Au menu aujourd'hui" })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /marquer comme fait/ }).length).toBeGreaterThan(0);
  });

  it('ardoise « Maintenant » : Ce midi à 10 h, le bouton coche le repas (même coche qu’aujourd’hui)', async () => {
    initProfile('marc', 'Jean'); // l'exemple : mercredi midi = une box pour Jean
    const user = userEvent.setup();
    render(<App />);

    const ardoise = await screen.findByRole('region', { name: 'Maintenant' });
    expect(within(ardoise).getByText('Ce midi')).toBeInTheDocument();
    expect(within(ardoise).getByText(/Box poulet effiloché/)).toBeInTheDocument();
    await user.click(within(ardoise).getByRole('button', { name: "J'ai pris ma box" }));
    expect(await screen.findByRole('button', { name: /: fait, annuler/ })).toBeInTheDocument();
    // La box prise, l'ardoise passe au repas suivant.
    expect(within(ardoise).getByText('Ce soir')).toBeInTheDocument();
  });

  it('ardoise « Maintenant » : Ce soir à 19 h', async () => {
    initProfile('marc', 'Jean');
    vi.setSystemTime(new Date('2026-10-07T19:00:00'));
    render(<App />);

    const ardoise = await screen.findByRole('region', { name: 'Maintenant' });
    expect(within(ardoise).getByText('Ce soir')).toBeInTheDocument();
    expect(within(ardoise).getByRole('button', { name: "C'est mangé" })).toBeInTheDocument();
  });

  it('dimanche, jour de rituel : l’ardoise appelle à commencer le rituel', async () => {
    initProfile('marc', 'Jean');
    vi.setSystemTime(new Date('2026-10-11T10:00:00')); // dimanche
    const user = userEvent.setup();
    render(<App />);

    const ardoise = await screen.findByRole('region', { name: 'Maintenant' });
    expect(within(ardoise).getByRole('heading', { name: /jour de rituel/ })).toBeInTheDocument();
    await user.click(within(ardoise).getByRole('button', { name: 'Commencer le rituel' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Rituel' })).toBeInTheDocument();
  });

  it('jour des courses changé dans Ma semaine type : début recalé et confirmation', async () => {
    initProfile('marc', 'Jean');
    saveFoyer(foyerParDefaut(loadProfile()!));
    saveCycle({ id: 'c1', numero: 1, debut: '2026-10-03', pauses: [], cycle: cycleDuTest() });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Moi : Jean' }));
    await user.click(await screen.findByRole('button', { name: /Ma semaine type/ }));
    await user.selectOptions(await screen.findByLabelText(/Jour des courses/), 'mercredi');
    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Tes menus démarreront désormais le mercredi.')).toBeInTheDocument();
    expect(loadCycle()?.debut).toBe('2026-10-07'); // mercredi suivant le samedi de départ
    expect(loadFoyer()?.jourCourses).toBe('mercredi');
  });

  it('barre du bas : 4 onglets libellés, l’actif en aria-current, avatar « Moi »', async () => {
    initProfile();
    const user = userEvent.setup();
    render(<App />);

    const noms = within(nav()).getAllByRole('button').map((b) => b.textContent);
    expect(noms).toEqual(["Aujourd'hui", 'Semaine', 'Courses', 'Rituel']);
    expect(onglet("Aujourd'hui")).toHaveAttribute('aria-current', 'page');

    await user.click(onglet('Courses'));
    expect(onglet('Courses')).toHaveAttribute('aria-current', 'page');
    expect(onglet("Aujourd'hui")).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { level: 1, name: 'Courses' })).toBeInTheDocument();

    // L'avatar de l'en-tête ouvre « Moi » (écran poussé, la barre disparaît).
    await user.click(screen.getByRole('button', { name: 'Moi : Marc' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Moi' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument();
  });

  it('juste la routine (suivi coupé) : mêmes 4 onglets, pas de carte Suivi', async () => {
    saveProfile({ ...loadProfileDe('marc'), suivi: false });
    render(<App />);
    const noms = within(nav()).getAllByRole('button').map((b) => b.textContent);
    expect(noms).toEqual(["Aujourd'hui", 'Semaine', 'Courses', 'Rituel']);
    expect(screen.queryByRole('button', { name: /Mon suivi/ })).not.toBeInTheDocument();
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
    await screen.findByText(/Menus d'exemple/);
    await user.click(onglet('Semaine'));
    expect(await screen.findAllByText(/Thérèse/)).not.toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/Marc|Mélanie|Maëlle|Maxine|\bAlex\b/); // Alex = rôle anonyme non remplacé
  });

  it('plus de ligne semaine dans la coque ; la navigation de semaine vit dans Semaine', async () => {
    initProfile();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Menus d'exemple/);
    expect(screen.queryByText(/Sem\. 1/)).not.toBeInTheDocument();

    await user.click(onglet('Semaine'));
    expect(screen.getByText(/Sem\. 1 · 3 → 9 oct\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    expect(screen.getByText(/Sem\. 2 · 10 → 16 oct\./)).toHaveTextContent('Menu B');

    // Les autres onglets n'affichent plus de ligne semaine ; la semaine
    // consultée reste en mémoire et est reprise au retour sur Semaine.
    await user.click(onglet('Courses'));
    expect(screen.queryByText(/Sem\. 2/)).not.toBeInTheDocument();
    await user.click(onglet('Semaine'));
    expect(screen.getByText(/Sem\. 2/)).toBeInTheDocument();
  });

  it('Semaine : en-tête « Menus · semaine N sur 4 », bande des jours, lien Ma semaine type', async () => {
    initProfile();
    const user = userEvent.setup();
    render(<App />);
    await user.click(onglet('Semaine'));
    expect(screen.getByRole('heading', { level: 1, name: 'Menus' })).toBeInTheDocument();
    expect(screen.getByText('Semaine 1 sur 4')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Jours' })).toBeInTheDocument();
    // Semaine 1 : l'assistant n'est pas proposé ; la semaine type est à portée.
    expect(screen.queryByRole('button', { name: 'Prépare tes prochains menus' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ma semaine type' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ma semaine type' })).toBeInTheDocument();
  });

  it('Semaine : en semaine 4, l’action pleine propose de préparer les prochains menus', async () => {
    initProfile();
    const { importerCycle } = await import('../src/lib/cycle/valider');
    const { saveCycle } = await import('../src/lib/cycle/etat');
    const { enFichiers, quatreFichiers } = await import('./lib/cycle/fabrique');
    // 2026-10-07 tombe dans la 4e semaine d'un cycle démarré le 12 septembre.
    saveCycle({ id: 'c7', numero: 1, debut: '2026-09-12', pauses: [], cycle: importerCycle(enFichiers(quatreFichiers())).cycle! });
    const user = userEvent.setup();
    render(<App />);
    await user.click(onglet('Semaine'));
    expect(screen.getByText('Semaine 4 sur 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prépare tes prochains menus' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ta semaine type est-elle toujours la bonne ?' })).toBeInTheDocument();
  });

  it('Moi › Suivi poids : objectif et pesées, sans séances (reportées)', async () => {
    initProfile();
    addWeight('marc', '2026-10-05', 82.4);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Moi : Marc' }));
    await user.click(screen.getByRole('button', { name: /Suivi poids/ }));
    expect(await screen.findByRole('heading', { name: 'Suivi poids' })).toBeInTheDocument();
    expect(screen.getByText('05/10 — 82.4 kg')).toBeInTheDocument();
    expect(screen.queryByText(/Séances/)).not.toBeInTheDocument();
  });

  it('Aujourd’hui : carte Suivi avec la dernière pesée, « Ajouter » ouvre Suivi poids', async () => {
    initProfile();
    addWeight('marc', '2026-10-05', 82.4);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText(/Mon suivi : 82,4 kg/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajouter une pesée' }));
    expect(await screen.findByRole('heading', { name: 'Suivi poids' })).toBeInTheDocument();
  });

  it('un cycle importé remplace l’exemple', async () => {
    initProfile();
    const { importerCycle } = await import('../src/lib/cycle/valider');
    const { saveCycle } = await import('../src/lib/cycle/etat');
    const { enFichiers, quatreFichiers } = await import('./lib/cycle/fabrique');
    const cycle = importerCycle(enFichiers(quatreFichiers())).cycle!;
    // 2026-10-07 tombe dans la 2e semaine (menu B) d'un cycle démarré le 26 septembre.
    saveCycle({ id: 'c7', numero: 3, debut: '2026-09-26', pauses: [], cycle });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Recette diner-b-mercredi : marquer comme fait' })).toBeInTheDocument();
    expect(screen.queryByText(/Menus d'exemple/)).not.toBeInTheDocument();
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
    await user.click(repas);
    expect(getChecks('cycle:c7:0')).toEqual({ 'menu:A:mercredi:mercredi-diner-famille': true });

    await user.click(onglet('Semaine'));
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
    // Fin de l'onboarding : l'assistant des prochains menus s'ouvre directement.
    expect(await screen.findByRole('heading', { name: 'Ta semaine type est-elle toujours la bonne ?' })).toBeInTheDocument();
    expect(screen.getByText('Étape 1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oui, continuer' })).toBeInTheDocument();
    // « Plus tard » : retour à l'app (menus d'exemple).
    await user.click(screen.getByRole('button', { name: /Plus tard/ }));
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
    // Pas encore de menus à soi : même arrivée directe sur l'assistant.
    expect(await screen.findByRole('heading', { name: 'Ta semaine type est-elle toujours la bonne ?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Plus tard/ }));
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(localStorage.getItem('sportapp:foyer')).not.toBeNull();
  });
});
