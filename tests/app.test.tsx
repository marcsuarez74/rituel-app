import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import sampleRaw from '../src/assets/semaine-exemple.md?raw';
import App from '../src/App';
import { parseWeeklyFile } from '../src/lib/parse';
import { addWeight, saveProfile } from '../src/lib/storage';
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
    expect(await screen.findByRole('heading', { name: /Qui est derrière l'écran/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument();
  });

  it('sans cycle importé : Aujourd’hui sur le cycle d’exemple, démarré au dernier jour des courses', async () => {
    initProfile('marc', 'Jean');
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: "Aujourd'hui" })).toBeInTheDocument();
    expect(await screen.findByText(/Salut Jean/)).toBeInTheDocument();
    expect(screen.getByText('mercredi 7 octobre')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cycle 1 · semaine 1 sur 4 · Menu A' })).toBeInTheDocument();
    expect(screen.getByText(/Cycle d'exemple/)).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: 'Cycle 3 · semaine 2 sur 4 · Menu B' })).toBeInTheDocument();
    expect(screen.queryByText(/Cycle d'exemple/)).not.toBeInTheDocument();
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
    await user.click(await screen.findByRole('button', { name: /Marc/ }));
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
      id: 'marc',
      objectif: { type: 'affiner' },
      complements: ['Créatine'],
      regime: 'keto',
    });
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
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
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
  });
});

describe("Semaine d'exemple — contenu réel (Menu A, S37)", () => {
  it('se parse sans warning avec meta, menu, courses, batch et profils complets', () => {
    const { data, warnings } = parseWeeklyFile(sampleRaw);

    expect(warnings).toEqual([]);
    expect(data.meta).toEqual({
      semaine: '2026-S37',
      menu: 'A',
      du: '2026-09-07',
      au: '2026-09-13',
      titre: 'Menu A — Base poulet & bolo',
    });

    expect(data.menu.map((d) => d.jour)).toEqual([
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
      'Dimanche',
    ]);
    for (const day of data.menu) {
      expect(day.dejeunerMarc).toBeTruthy();
      expect(day.dinerFamille).toBeTruthy();
    }
    // Le « : » interne doit rester dans la valeur, pas couper la clé
    expect(data.menu.find((d) => d.jour === 'Vendredi')?.dinerFamille).toBe(
      'Tacos maison : galettes + haché (reste bolo) + crudités + yaourt-citron',
    );
    expect(data.menu.find((d) => d.jour === 'Samedi')?.batch).toBe(
      '6-8 œufs durs (boxes de la semaine)',
    );

    expect(data.courses.length).toBeGreaterThanOrEqual(30);
    expect(new Set(data.courses.map((c) => c.rayon)).size).toBeGreaterThanOrEqual(5);
    expect(data.courses.find((c) => c.label === 'Pâtes — 500 g')?.rayon).toBe('feculents');
    expect(data.courses.find((c) => c.label === 'Amandes/noix')?.rayon).toBe('divers');

    expect(data.batch).toHaveLength(5);
    expect(data.batch[0].label).toBe('Egg muffins ×10');
    expect(data.batch[0].ref).toBe('R7');
    expect(data.rituel?.filter((e) => e.ref).length).toBeGreaterThanOrEqual(2);

    expect(data.profiles.marc.cibles).toHaveLength(4);
    expect(data.profiles.marc.seances).toHaveLength(6);
    expect(data.profiles.marc.rappels).toHaveLength(2);
    expect(data.profiles.melanie.cibles).toHaveLength(4);
    expect(data.profiles.melanie.seances).toHaveLength(3);
    expect(data.profiles.melanie.rappels).toHaveLength(2);
  });

  it('lie une recette à au moins un repas de chaque jour, avec données complètes', () => {
    const { data, warnings } = parseWeeklyFile(sampleRaw);

    expect(warnings).toEqual([]);
    // R1-R7 : 7 recettes, chaque jour a son diner-famille lié + les déjeuners
    // liés à leur recette source (mercredi : Marc + Mél sur les restes bolo).
    expect(data.recettes).toHaveLength(7);
    for (const day of data.menu) {
      expect(Object.keys(day.recetteRefs ?? {})).toContain('dinerFamille');
    }
    expect(data.menu.find((d) => d.jour === 'Mercredi')?.recetteRefs).toEqual({
      dejeunerMarc: expect.any(String),
      dejeunerMelanie: expect.any(String),
      dinerFamille: expect.any(String),
    });
    // toutes les recettes liées portent kcal + étapes (contrat e2e « fiche recette »)
    for (const recette of data.recettes!) {
      expect(recette.kcal).toBeTruthy();
      expect(recette.etapes?.length).toBeGreaterThanOrEqual(1);
    }
  });
});
