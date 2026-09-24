import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import sampleRaw from '../src/assets/semaine-exemple.md?raw';
import App from '../src/App';
import { parseWeeklyFile } from '../src/lib/parse';
import { saveProfile, saveWeek, upsertWeek, addWeight } from '../src/lib/storage';
import type { ProfileKey } from '../src/lib/model';

const fixture = (semaine = '2026-S37', extraCourse = 'Carottes') => `---
semaine: ${semaine}
menu: A
du: 2026-09-07
au: 2026-09-13
---

## courses

### Legumes
- ${extraCourse}
- [ ] Épinards

### Viandes
- [ ] Poulet

## menu

### Lundi
- diner-famille: Poulet rôti

### Mardi
- dejeuner-marc: Restes poulet

## batch

### Rituel dimanche
- 0-5 min · Four à 180° — egg muffins ×10 lancés

- [ ] Riz (4 parts)

## marc

### Cibles
- 78 kg

### Seances
- [x] Full body

### Rappels
- Protéines à chaque repas

## melanie

### Cibles
- Keto strict

### Seances
- [ ] Cardio

### Rappels
- Électrolytes
`;

// Toute vue shell suppose un profil choisi (onboarding passé).
const initProfile = (id: ProfileKey = 'marc') =>
  saveProfile({
    id,
    dateNaissance: id === 'marc' ? '1985-04-12' : '1987-03-02',
    taille: id === 'marc' ? 178 : 165,
    objectif: { type: 'perte', echeance: '2026-12-15' },
    complements: [],
    regime: id === 'melanie' ? 'keto' : 'aucun',
  });

const fixtureSemaine = (
  semaine: string,
  du: string,
  au: string,
  menu = 'A',
  plat = 'Poulet rôti',
) => `---
semaine: ${semaine}
menu: ${menu}
du: ${du}
au: ${au}
---

## Courses

### Proteines
- [ ] ${plat} 600 g

## Menu

### Lundi
- dejeuner-marc: ${plat}
- dejeuner-melanie: ${plat} keto
- diner-famille: ${plat} au four
- diner-melanie: ${plat} keto
- batch: Doubler ${plat}

### Mardi
- dejeuner-marc: Restes
- dejeuner-melanie: Box
- diner-famille: ${plat} pâtes
- diner-melanie: ${plat} sans pâtes

### Mercredi
- diner-famille: ${plat} wok

### Jeudi
- diner-famille: ${plat} gratin

### Vendredi
- diner-famille: ${plat} tacos

### Samedi
- diner-famille: ${plat} soupe

### Dimanche
- diner-famille: ${plat} rôti

## Batch

### Rituel dimanche
- 0-5 min · Four à 180° — egg muffins ×10

### Micro-batch
- lundi: doubler le plat

- [ ] Egg muffins ×10

## Marc

### Cibles
- 2 450 kcal

### Seances
- [ ] Lundi — Muscu

### Rappels
- Pesée lun/mer/ven

## Melanie

### Cibles
- 1 450 kcal

### Seances
- [ ] Mardi — Pilates

### Rappels
- Jeûne 16:8
`;

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche l’onboarding quand aucun profil n’est choisi (semaine chargée ou non)', () => {
    const parsed = parseWeeklyFile(fixture());
    saveWeek(fixture(), parsed.data);
    render(<App />);

    expect(screen.getByRole('heading', { name: /Qui est derrière l'écran/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cuisine' })).not.toBeInTheDocument();
  });

  it('sans semaine stockée, la semaine d’exemple se charge automatiquement (aucun écran d’import)', () => {
    initProfile();
    render(<App />);

    expect(screen.getByText('Semaine 37')).toBeInTheDocument();
    expect(screen.getByText('7 → 13 sept.')).toBeInTheDocument();
    expect(screen.queryByText(/Importer/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Charger la semaine/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Changer de semaine/ })).not.toBeInTheDocument();
  });

  it('affiche le shell 2 onglets avec la semaine persistée', () => {
    initProfile();
    const parsed = parseWeeklyFile(fixture());
    saveWeek(fixture(), parsed.data);
    render(<App />);

    expect(screen.getByText('Semaine 37')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cuisine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon suivi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marc' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mélanie' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Importer/)).not.toBeInTheDocument();
  });

  it('navigue entre Cuisine et Mon suivi (données filtrées sur mon profil)', async () => {
    const parsed = parseWeeklyFile(fixture());
    saveWeek(fixture(), parsed.data);
    initProfile('marc');
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Legumes', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Carottes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(document.querySelector('.rtab')).not.toBeNull();
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Poulet rôti');

    await user.click(screen.getByRole('button', { name: 'Mon Rituel' }));
    expect(screen.getByText(/muffins/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mon suivi' }));
    expect(screen.getByText(/Salut Marc/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marc — Diet & Sport', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Full body')).toBeInTheDocument();
    expect(screen.queryByText('Cardio')).not.toBeInTheDocument();
  });

  it('affiche le prénom édité dans la salutation (profil v2.2)', async () => {
    saveProfile({
      id: 'marc',
      prenom: 'Jean',
      dateNaissance: '1985-04-12',
      taille: 178,
      objectif: { type: 'perte' },
      complements: [],
      regime: 'aucun',
    });
    const parsed = parseWeeklyFile(fixture());
    saveWeek(fixture(), parsed.data);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Mon suivi' }));
    expect(screen.getByText(/Salut Jean 👋/)).toBeInTheDocument();
  });

  it('affiche directement la semaine persistée après un re-render complet', () => {
    const parsed = parseWeeklyFile(fixture());
    saveWeek(fixture(), parsed.data);
    initProfile();

    render(<App />);

    expect(screen.getByText('Semaine 37')).toBeInTheDocument();
    expect(screen.queryByText('Importer un .md')).not.toBeInTheDocument();
  });
});

describe('Theming (accent unique)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-profile');
  });

  it('ne pose plus data-profile sur <html>, quel que soit le profil', () => {
    initProfile('melanie');
    const parsed = parseWeeklyFile(fixture());
    saveWeek(fixture(), parsed.data);

    render(<App />);

    expect(document.documentElement.getAttribute('data-profile')).toBeNull();
  });
});

describe('Design system & sémantique', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche le titre de semaine dans un h1 portant la classe week-title', () => {
    initProfile();
    render(<App />);

    const h1 = screen.getByRole('heading', { level: 1, name: /Semaine 37/ });
    expect(h1).toHaveClass('week-title');
  });

  it("marque l'onglet actif avec aria-current=page et le déplace au changement d'onglet", async () => {
    initProfile();
    const user = userEvent.setup();
    render(<App />);

    const cuisine = screen.getByRole('button', { name: 'Cuisine' });
    expect(cuisine).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Mon suivi' })).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('button', { name: 'Mon suivi' }));
    expect(screen.getByRole('button', { name: 'Mon suivi' })).toHaveAttribute('aria-current', 'page');
    expect(cuisine).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Mon suivi' }).parentElement).toHaveAttribute(
      'data-active',
      'suivi',
    );
  });

  it('rend la nav segmented sous la bannière : libellés toujours visibles, aria-current sur l’actif', () => {
    initProfile();
    render(<App />);
    const nav = document.querySelector('.tabbar-segmented');
    expect(nav).not.toBeNull();
    expect(nav).toHaveAttribute('data-active', 'cuisine');
    const cuisine = screen.getByRole('button', { name: 'Cuisine' });
    const suivi = screen.getByRole('button', { name: 'Mon suivi' });
    expect(cuisine).toHaveAttribute('aria-current', 'page');
    // les DEUX labels sont rendus (plus d'icône seule inactive)
    expect(cuisine.textContent).toContain('Cuisine');
    expect(suivi.textContent).toContain('Mon suivi');
    fireEvent.click(suivi);
    expect(nav).toHaveAttribute('data-active', 'suivi');
    expect(suivi).toHaveAttribute('aria-current', 'page');
  });
});

describe('Onboarding v2 — persistance via App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parcours complet 5 étapes : objectif, compléments et régime persistés', async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Marc/ }));
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
    expect(screen.getByText('Semaine 37')).toBeInTheDocument();
  });
});

describe('Migration profil v1 → v2', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('un profil ancien (age) relance l onboarding prérempli à l étape 2', () => {
    localStorage.setItem('sportapp:profile', JSON.stringify({ id: 'marc', age: 41, taille: 178 }));
    addWeight('marc', '2026-09-09', 78.4);
    render(<App />);

    expect(screen.getByText(/Une mise à jour/)).toBeInTheDocument();
    expect(screen.getByText(/non modifiable ici/)).toBeInTheDocument();
    expect(screen.getByLabelText('Poids (kg)')).toHaveValue(78.4);
    expect(screen.getByLabelText('Date de naissance')).toHaveValue('');
    expect(screen.queryByRole('button', { name: /Mélanie/ })).not.toBeInTheDocument();
  });

  it('après migration, le profil v2 est enregistré et l app s affiche', async () => {
    localStorage.setItem('sportapp:profile', JSON.stringify({ id: 'melanie', age: 38, taille: 165 }));
    const user = userEvent.setup();
    render(<App />);
    fireEvent.change(screen.getByLabelText('Date de naissance'), { target: { value: '1987-03-02' } });
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
    expect(screen.getByText('Semaine 37')).toBeInTheDocument();
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

describe('App — multi-semaines', () => {
  beforeEach(() => {
    localStorage.clear();
    initProfile();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ouvre sur la semaine contenant aujourd’hui et navigue par chevrons', async () => {
    // Écart plan/réalité : userEvent + vi.useFakeTimers pend sous React act
    // (setImmediate faked) — la date mockée seule (setSystemTime) suffit.
    vi.setSystemTime(new Date('2026-09-15T10:00:00')); // mardi, dans S38
    const user = userEvent.setup();
    const raw38 = fixtureSemaine('2026-S38', '2026-09-14', '2026-09-20', 'B', 'Chili con carne');
    const raw39 = fixtureSemaine('2026-S39', '2026-09-21', '2026-09-27', 'C', 'Quiche lorraine');
    upsertWeek(raw38, parseWeeklyFile(raw38).data);
    upsertWeek(raw39, parseWeeklyFile(raw39).data);
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 38');
    expect(screen.getByText('Cycle 2')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 39');
    expect(screen.getByText('Cycle 3')).toBeVisible();
    // Dernière semaine : chevron suivant désactivé
    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 38');
    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toBeEnabled();
  });

  it('l’import depuis le profil recharge les semaines, affiche la semaine du jour et ferme le profil', async () => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00')); // mercredi, entre S38 et S40
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Mon profil' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const contenu = fixtureSemaine('2026-S40', '2026-09-28', '2026-10-04', 'D', 'Boulettes');
    await user.upload(input, new File([contenu], '2026-S40-menu-d.md', { type: 'text/markdown' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 40');
    expect(screen.getByText('Cycle 4')).toBeVisible();
  });

  it('rouvre sur la dernière semaine consultée à la relance (sélection persistée)', async () => {
    vi.setSystemTime(new Date('2026-09-15T10:00:00')); // mardi, dans S38
    const user = userEvent.setup();
    const raw38 = fixtureSemaine('2026-S38', '2026-09-14', '2026-09-20', 'B', 'Chili con carne');
    const raw39 = fixtureSemaine('2026-S39', '2026-09-21', '2026-09-27', 'C', 'Quiche lorraine');
    upsertWeek(raw38, parseWeeklyFile(raw38).data);
    upsertWeek(raw39, parseWeeklyFile(raw39).data);
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 39');
    unmount();
    render(<App />); // « relance » : nouvelle instance, storage conservé
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 39');
    expect(screen.getByText('Cycle 3')).toBeVisible();
  });

  it('sélection obsolète (semaine absente du stockage) : retombe sur la semaine du jour', () => {
    vi.setSystemTime(new Date('2026-09-22T10:00:00')); // mardi, dans S39
    const raw38 = fixtureSemaine('2026-S38', '2026-09-14', '2026-09-20', 'B', 'Chili con carne');
    const raw39 = fixtureSemaine('2026-S39', '2026-09-21', '2026-09-27', 'C', 'Quiche lorraine');
    upsertWeek(raw38, parseWeeklyFile(raw38).data);
    upsertWeek(raw39, parseWeeklyFile(raw39).data);
    localStorage.setItem('sportapp:selection', JSON.stringify('2026-S99'));
    render(<App />);
    // Pas la 1re semaine stockée (S38) mais bien la semaine du jour (S39).
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 39');
    expect(screen.getByText('Cycle 3')).toBeVisible();
  });
});
