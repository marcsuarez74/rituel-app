import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ChecklistItem,
  CourseItem,
  DepenseEntry,
  MenuDay,
  ProfileData,
  Recette,
  UserProfile,
  WeeklyData,
} from '../src/lib/model';
import { addWeight, getChecks, getDepenses, getWeights, loadWeeks, setCheck, upsertWeek } from '../src/lib/storage';
import { todayISO } from '../src/lib/dates';
import { parseWeeklyFile } from '../src/lib/parse';
import { ImportButton } from '../src/components/ImportButton';
import { Checklist } from '../src/components/Checklist';
import { SuiviHero } from '../src/components/SuiviHero';
import { WeightChart } from '../src/components/WeightChart';
import { ProgressRing } from '../src/components/ProgressRing';
import { ShoppingList } from '../src/components/cuisine/ShoppingList';
import { CoursesBudget, DepensesPanel } from '../src/components/cuisine/CoursesBudget';
import { MenuView } from '../src/components/cuisine/MenuView';
import { BatchView } from '../src/components/cuisine/BatchView';
import { CuisineView } from '../src/components/cuisine/CuisineView';
import { ProfileView } from '../src/components/ProfileView';
import { WeekBanner } from '../src/components/WeekBanner';
import { SemaineSwitcher } from '../src/components/SemaineSwitcher';
import { Icon } from '../src/components/Icon';

const profileV2 = (
  id: 'marc' | 'melanie' = 'marc',
  extra: Partial<UserProfile> = {},
): UserProfile => ({
  id,
  dateNaissance: id === 'marc' ? '1985-04-12' : '1987-03-02',
  taille: id === 'marc' ? 178 : 165,
  objectif: { type: 'perte', echeance: '2026-12-15' },
  complements: [],
  regime: id === 'melanie' ? 'keto' : 'aucun',
  ...extra,
});

const seedDepenses = (list: DepenseEntry[]) =>
  localStorage.setItem('sportapp:depenses', JSON.stringify(list));

const dataAvecBudget = (budget?: string): WeeklyData => ({
  meta: {
    semaine: '2026-S37',
    menu: 'Menu A',
    du: '2026-09-07',
    au: '2026-09-13',
  },
  courses: [],
  menu: [],
  batch: [],
  profiles: {
    marc: { cibles: [], seances: [], rappels: [] },
    melanie: { cibles: [], seances: [], rappels: [] },
  },
  ...(budget !== undefined ? { budget } : {}),
});

const items: ChecklistItem[] = [
  { id: 'repas-a', label: 'Préparer les repas' },
  { id: 'course-b', label: 'Faire les courses' },
];

// Mini-semaine valide : doit parser avec 0 warning (toutes les sections, aucune
// ligne hors format).
const mdSemaine = (semaine: string, du: string, au: string, menu = 'A', plat = 'Poulet rôti') =>
  `---
semaine: ${semaine}
menu: ${menu}
du: ${du}
au: ${au}
---

## Courses

### Proteines
- [ ] ${plat} 600 g

### Keto
- [ ] Avocats ×3-4

## Menu

### Lundi
- dejeuner-marc: ${plat}
- dejeuner-melanie: ${plat} version keto
- diner-famille: ${plat} au four
- diner-melanie: ${plat} version keto
- batch: Doubler ${plat}

### Mardi
- dejeuner-marc: Restes de ${plat}
- dejeuner-melanie: Box ${plat}
- diner-famille: ${plat} pâtes
- diner-melanie: ${plat} sans pâtes

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

describe('Checklist', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders one label per item with the item text', () => {
    render(<Checklist items={items} semaine="S39" />);
    expect(screen.getByText('Préparer les repas')).toBeInTheDocument();
    expect(screen.getByText('Faire les courses')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByText('Préparer les repas').closest('label')).not.toHaveClass('done');
  });

  it('checking an item persists it for the week and marks the label done', async () => {
    const user = userEvent.setup();
    render(<Checklist items={items} semaine="S39" />);
    await user.click(screen.getByRole('checkbox', { name: 'Préparer les repas' }));
    expect(getChecks('S39')).toEqual({ 'repas-a': true });
    expect(screen.getByRole('checkbox', { name: 'Préparer les repas' })).toBeChecked();
    expect(screen.getByText('Préparer les repas').closest('label')).toHaveClass('done');
  });

  it('unchecking removes the done class and persists the new state', async () => {
    const user = userEvent.setup();
    render(<Checklist items={items} semaine="S39" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Préparer les repas' });
    await user.click(checkbox);
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(getChecks('S39')).toEqual({ 'repas-a': false });
    expect(screen.getByText('Préparer les repas').closest('label')).not.toHaveClass('done');
  });

  it('renders pre-existing checks as checked', () => {
    setCheck('S39', 'course-b', true);
    render(<Checklist items={items} semaine="S39" />);
    expect(screen.getByRole('checkbox', { name: 'Faire les courses' })).toBeChecked();
    expect(screen.getByText('Faire les courses').closest('label')).toHaveClass('done');
  });

  it('re-reads storage when the semaine prop changes and keeps weeks isolated', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Checklist items={items} semaine="S39" />);
    await user.click(screen.getByRole('checkbox', { name: 'Préparer les repas' }));
    expect(getChecks('S39')).toEqual({ 'repas-a': true });

    rerender(<Checklist items={items} semaine="S40" />);
    expect(screen.getByRole('checkbox', { name: 'Préparer les repas' })).not.toBeChecked();
    expect(screen.getByText('Préparer les repas').closest('label')).not.toHaveClass('done');

    await user.click(screen.getByRole('checkbox', { name: 'Faire les courses' }));
    expect(getChecks('S40')).toEqual({ 'course-b': true });
    expect(getChecks('S39')).toEqual({ 'repas-a': true });
  });
});

describe('WeightChart', () => {
  const base = [
    { date: '2026-01-05', kg: 85 },
    { date: '2026-03-02', kg: 82 },
    { date: '2026-05-04', kg: 80.5 },
    { date: '2026-09-07', kg: 78 },
  ];

  it('affiche départ, actuel, objectif et les dates d axe', () => {
    render(<WeightChart weights={base} objectif={72} />);
    expect(screen.getAllByText('85 kg').length).toBeGreaterThanOrEqual(1); // chip + point de départ
    expect(screen.getAllByText('78 kg').length).toBeGreaterThanOrEqual(1); // chip + point actuel
    expect(screen.getByText('72 kg')).toBeInTheDocument(); // objectif (chip seul)
    expect(screen.getByText(/05\/01/)).toBeInTheDocument(); // 1re pesée
    expect(screen.getByText(/07\/09/)).toBeInTheDocument(); // dernière
    expect(screen.getByRole('img', { name: /courbe de poids/i })).toBeInTheDocument();
  });

  it('affiche « — » à la place de l objectif absent', () => {
    render(<WeightChart weights={base} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('invite à ajouter des pesées en dessous de 2 points', () => {
    render(<WeightChart weights={[{ date: '2026-09-07', kg: 78 }]} />);
    expect(screen.getByText(/Ajoutez au moins 2 pesées/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('gère deux pesées identiques sans NaN dans la courbe', () => {
    const { container } = render(
      <WeightChart weights={[{ date: '2026-09-06', kg: 78 }, { date: '2026-09-07', kg: 78 }]} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.querySelector('.weight-ligne')!.getAttribute('d')).not.toContain('NaN');
  });
});

const courseItems: CourseItem[] = [
  { id: 'courses:proteines:poulet', rayon: 'proteines', label: 'Poulet' },
  { id: 'courses:proteines:oeufs', rayon: 'proteines', label: 'Œufs' },
  { id: 'courses:laitiers:yaourts', rayon: 'laitiers', label: 'Yaourts' },
  { id: 'courses:proteines:tofu', rayon: 'proteines', label: 'Tofu' },
];

describe('ShoppingList', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('groups items by rayon in first-appearance order', () => {
    render(<ShoppingList items={courseItems} semaine="S39" />);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['Proteines', 'Laitiers']);
    const proteines = screen.getByRole('heading', { name: 'Proteines' }).closest('section')!;
    expect(within(proteines).getAllByRole('checkbox')).toHaveLength(3);
    const laitiers = screen.getByRole('heading', { name: 'Laitiers' }).closest('section')!;
    expect(within(laitiers).getAllByRole('checkbox')).toHaveLength(1);
  });

  it('renders 0/4 cochés and a native progress bar initially', () => {
    render(<ShoppingList items={courseItems} semaine="S39" />);
    expect(screen.getByText('0/4 cochés')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '4');
  });

  it('updates the progress live when items are checked', async () => {
    const user = userEvent.setup();
    render(<ShoppingList items={courseItems} semaine="S39" />);
    await user.click(screen.getByRole('checkbox', { name: 'Poulet' }));
    await user.click(screen.getByRole('checkbox', { name: 'Yaourts' }));
    expect(screen.getByText('2/4 cochés')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
  });

  it('does not resurrect stale checks from another group after unchecking', async () => {
    const user = userEvent.setup();
    setCheck('S39', 'courses:proteines:poulet', true);
    render(<ShoppingList items={courseItems} semaine="S39" />);
    expect(screen.getByText('1/4 cochés')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Poulet' }));
    expect(screen.getByText('0/4 cochés')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Yaourts' }));
    expect(screen.getByText('1/4 cochés')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
  });

  it('persists checked items via storage', async () => {
    const user = userEvent.setup();
    render(<ShoppingList items={courseItems} semaine="S39" />);
    await user.click(screen.getByRole('checkbox', { name: 'Poulet' }));
    expect(getChecks('S39')).toEqual({ 'courses:proteines:poulet': true });
  });

  it('renders a muted message and no sections when there are no items', () => {
    const { container } = render(<ShoppingList items={[]} semaine="S39" />);
    expect(screen.getByText('Aucune course pour cette semaine.')).toBeInTheDocument();
    expect(container.querySelector('section.course-group')).toBeNull();
    expect(container.querySelector('.progress')).toBeNull();
    expect(container.querySelector('progress')).toBeNull();
  });

  it('affiche la miniature photo du rayon dans l’en-tête du groupe', () => {
    render(
      <ShoppingList
        semaine="2026-S39"
        items={[
          { id: 'courses:legumes:a', rayon: 'legumes', label: 'Épinards' },
          { id: 'courses:inconnu:b', rayon: 'surgelés', label: 'Glace' },
        ]}
      />,
    );

    const legumes = screen.getByAltText('Legumes');
    expect(legumes).toHaveAttribute('loading', 'lazy');
    expect(screen.getByAltText('Surgelés')).toBeInTheDocument(); // fallback appliqué
  });

  it('capitalizes the rayon slug', () => {    render(
      <ShoppingList
        items={[{ id: 'courses:epicerie:sel', rayon: 'epicerie', label: 'Sel' }]}
        semaine="S39"
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Epicerie' })).toBeInTheDocument();
  });

  it('affiche un compteur fait/total par rayon', () => {
    render(
      <ShoppingList
        semaine="2026-S39"
        items={[
          { id: 'courses:legumes:a', rayon: 'legumes', label: 'Épinards' },
          { id: 'courses:legumes:b', rayon: 'legumes', label: 'Carottes' },
          { id: 'courses:fruits:c', rayon: 'fruits', label: 'Pommes' },
        ]}
      />,
    );
    expect(screen.getByText('0/2', { selector: '.rayon-cnt' })).toBeInTheDocument();
    expect(screen.getByText('0/1', { selector: '.rayon-cnt' })).toBeInTheDocument();
  });

  it('met à jour le compteur du rayon après un clic, y compris celui du rayon keto', async () => {
    const user = userEvent.setup();
    render(
      <ShoppingList
        semaine="2026-S39"
        items={[
          { id: 'courses:keto:avocats', rayon: 'keto', label: 'Avocats ×3-4' },
          { id: 'courses:legumes:a', rayon: 'legumes', label: 'Épinards' },
          { id: 'courses:legumes:b', rayon: 'legumes', label: 'Carottes' },
        ]}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Épinards' }));
    expect(screen.getByText('1/2', { selector: '.rayon-cnt' })).toBeInTheDocument();
    expect(screen.getByText('0/1', { selector: '.rayon-cnt' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Avocats ×3-4' }));
    expect(screen.getByText('1/1', { selector: '.rayon-cnt' })).toBeInTheDocument();
  });

  it('rend le rayon Keto en encadré dédié, en dernier', () => {
    render(
      <ShoppingList
        semaine="2026-S39"
        items={[
          { id: 'courses:keto:avocats', rayon: 'keto', label: 'Avocats ×3-4' },
          { id: 'courses:legumes:a', rayon: 'legumes', label: 'Épinards' },
        ]}
      />,
    );
    expect(screen.getByText('Les extras keto de Mélanie')).toBeInTheDocument();
    const keto = screen.getByText('Les extras keto de Mélanie').closest('section');
    const legumes = screen.getByText('Legumes').closest('section');
    // keto suit legumes dans l'ordre du document : encadré en DERNIERE position
    expect(legumes!.compareDocumentPosition(keto!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(keto).toHaveClass('keto-box');
    expect(screen.queryByAltText('Keto')).not.toBeInTheDocument();
  });

  it('le rayon keto se coche comme un rayon normal et persiste', async () => {
    const user = userEvent.setup();
    render(
      <ShoppingList
        semaine="2026-S39"
        items={[{ id: 'courses:keto:avocats', rayon: 'keto', label: 'Avocats ×3-4' }]}
      />,
    );
    const avocats = screen.getByRole('checkbox', { name: 'Avocats ×3-4' });
    await user.click(avocats);
    expect(avocats).toBeChecked();
    expect(getChecks('2026-S39')).toEqual({ 'courses:keto:avocats': true });
    await user.click(avocats);
    expect(avocats).not.toBeChecked();
    expect(getChecks('2026-S39')).toEqual({ 'courses:keto:avocats': false });
  });

  it('affiche la bannière rituel avec le budget de la semaine', () => {
    render(<ShoppingList items={courseItems} semaine="2026-S37" budget="≈ 35 €" />);
    const ban = document.querySelector('.batch-banner');
    expect(ban).not.toBeNull();
    expect(ban).toHaveTextContent(/Pensées pour le rituel/);
    expect(ban).toHaveTextContent('≈ 35 €');
  });

  it('n’affiche pas de budget quand la semaine n’en a pas', () => {
    render(<ShoppingList items={courseItems} semaine="2026-S37" />);
    const ban = document.querySelector('.batch-banner');
    expect(ban).toHaveTextContent(/Pensées pour le rituel/);
    expect(ban?.textContent).not.toContain('€');
  });

  it('affiche le marqueur rituel et la note sur les items concernés', () => {
    const itemsMarques = [
      { id: 'courses:p:poulet', rayon: 'proteines', label: 'Poulet — 1 kg', rituel: true },
      {
        id: 'courses:p:saumon',
        rayon: 'proteines',
        label: 'Pavés de saumon — 2',
        note: 'poisson frais : vendredi, pas avant',
      },
    ];
    render(<ShoppingList items={itemsMarques} semaine="2026-S37" />);
    expect(document.querySelector('.item-rituel')).toHaveTextContent('rituel');
    expect(document.querySelector('.item-note')).toHaveTextContent('poisson frais : vendredi, pas avant');
  });

  it('Mode magasin masque les items cochés ; Tout revoir les remontre', async () => {
    const user = userEvent.setup();
    render(<ShoppingList items={courseItems} semaine="2026-S37" />);
    await user.click(screen.getAllByRole('checkbox')[0]!);
    const cochesAvant = screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked);
    expect(cochesAvant.length).toBe(1);
    await user.click(screen.getByRole('button', { name: /Mode magasin/ }));
    expect(screen.getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    await user.click(screen.getByRole('button', { name: /Tout revoir/ }));
    expect(screen.getAllByRole('checkbox').length).toBe(courseItems.length);
  });

  it('Mode magasin : tout coché affiche le message de fin, décocher un item le retire', async () => {
    const user = userEvent.setup();
    render(<ShoppingList items={courseItems} semaine="2026-S37" />);
    for (const nom of ['Poulet', 'Œufs', 'Yaourts', 'Tofu']) {
      await user.click(screen.getByRole('checkbox', { name: nom }));
    }
    await user.click(screen.getByRole('button', { name: /Mode magasin/ }));
    expect(screen.getByText('Tout est coché — bonne course 👋')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tout revoir/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Poulet' }));
    expect(screen.queryByText('Tout est coché — bonne course 👋')).not.toBeInTheDocument();
  });

  it('Mode magasin : un rayon entièrement coché disparaît, les autres restent', async () => {
    const user = userEvent.setup();
    render(<ShoppingList items={courseItems} semaine="2026-S37" />);
    for (const nom of ['Poulet', 'Œufs', 'Tofu']) {
      await user.click(screen.getByRole('checkbox', { name: nom }));
    }
    await user.click(screen.getByRole('button', { name: /Mode magasin/ }));
    expect(screen.queryByRole('heading', { name: 'Proteines' })).toBeNull();
    expect(screen.queryByAltText('Proteines')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Laitiers' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Yaourts' })).toBeInTheDocument();
  });

  it('Mode magasin : l’état coché survit à « Tout revoir »', async () => {
    const user = userEvent.setup();
    render(<ShoppingList items={courseItems} semaine="2026-S37" />);
    await user.click(screen.getByRole('checkbox', { name: 'Poulet' }));
    await user.click(screen.getByRole('button', { name: /Mode magasin/ }));
    await user.click(screen.getByRole('button', { name: /Tout revoir/ }));
    expect(screen.getByRole('checkbox', { name: 'Poulet' })).toBeChecked();
    expect(screen.getByText('1/4 cochés')).toBeInTheDocument();
  });
});

describe('CuisineView — sous-onglets', () => {
  const data: WeeklyData = {
    meta: { semaine: 'S40', menu: 'A', du: '2026-09-28', au: '2026-10-04' },
    courses: [],
    menu: [
      { jour: 'Lundi', dejeunerMarc: "Flocons d'avoine" },
      { jour: 'Mardi', dinerFamille: 'Poulet rôti' },
    ],
    batch: [],
    profiles: { marc: { cibles: [], seances: [], rappels: [] }, melanie: { cibles: [], seances: [], rappels: [] } },
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche 3 onglets texte seul (sans emoji) et met le premier en actif', () => {
    render(<CuisineView data={data} profile={profileV2('marc')} />);
    expect(screen.getByRole('button', { name: 'Courses' })).toHaveClass('tab', 'active');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveClass('tab');
    expect(screen.getByRole('button', { name: 'Mon Rituel' })).toHaveClass('tab');
    expect(screen.queryByRole('button', { name: /🛒/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /📅/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /📦/ })).not.toBeInTheDocument();
  });

  it('bascule la classe active au clic et change de section', async () => {
    const user = userEvent.setup();
    render(<CuisineView data={data} profile={profileV2('marc')} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveClass('tab', 'active');
    expect(screen.getByRole('button', { name: 'Courses' })).not.toHaveClass('active');
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0); // cartes menu v2
  });

  it('affiche la carte Budget courses au-dessus de la liste (tab courses)', () => {
    render(
      <CuisineView
        data={{ ...data, budget: '≈ 35 €' }}
        profile={profileV2('marc', { magasin: 'Lidl', budgetMax: 40 })}
      />,
    );

    expect(screen.getByText('Budget courses')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Courses' })).toBeInTheDocument();
  });

  it('le bouton Total payé ouvre le panneau dépenses à la place de la liste', async () => {
    const user = userEvent.setup();
    render(
      <CuisineView
        data={{ ...data, budget: '≈ 35 €' }}
        profile={profileV2('marc', { magasin: 'Lidl', budgetMax: 40 })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Total payé/ }));
    expect(screen.getByRole('heading', { name: /Mes dépenses réelles/ })).toBeInTheDocument();
    expect(screen.queryByText('Budget courses')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(screen.getByText('Budget courses')).toBeInTheDocument();
  });

  it('sans aucune donnée budget : pas de carte, la liste de courses reste seule', () => {
    render(<CuisineView data={data} profile={profileV2('marc')} />);

    expect(screen.queryByText('Budget courses')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Courses' })).toBeInTheDocument();
  });
});

describe('MenuView v3 — onglets par recette', () => {
  const RECETTE: Recette = {
    id: 'r1',
    nom: 'Poulet au four + riz',
    temps: '45 min · four 200°',
    kcal: 680,
    score: 7,
    fraicheur: 'batch dimanche → boîte frigo',
    pour: '6-8 cuisses · 250 g riz',
    bases: ['b4'],
    etapes: ['Four 200°.', 'Rôtir 40 min.'],
    portions: { marc: '1 poignée de riz (~150 g) · 2 cuisses', melanie: 'poulet ×2 (sans riz)' },
    mel: 'KETO-RECETTE-INFO',
    batch: 'BATCH-RECETTE-INFO',
  };
  const MENU: MenuDay[] = [
    {
      jour: 'Lundi',
      dejeunerMarc: 'Boîte poulet-riz',
      dejeunerMelanie: 'Restes poulet',
      dinerFamille: 'Poulet au four + riz',
      dinerMelanie: 'Poulet + légumes (sans riz)',
      batch: 'Double riz → boîte mardi',
      recetteRefs: { dinerFamille: 'R1', dejeunerMarc: 'R1', dejeunerMelanie: 'R1' },
    },
    { jour: 'Mardi', dejeunerMarc: 'Boîte poulet-riz (lun)', recetteRefs: { dejeunerMarc: 'R1' } },
    { jour: 'Mercredi', dinerFamille: 'Omelette + salade' },
    { jour: 'Jeudi', dejeunerMarc: 'Restes ou wrap' },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('barre : pills de recettes sans jours + onglet Déjeuners, actif = jour courant, progression Dîners/Boxes', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // mercredi
    const { container } = render(
      <MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />,
    );
    const pills = container.querySelectorAll('.rtab');
    expect(pills).toHaveLength(3); // 2 recettes (mardi/jeudi sans dîner) + 🍱 Déjeuners
    expect(pills[0].textContent).toContain('Poulet au four');
    expect(pills[0].textContent).not.toMatch(/lundi/i);
    expect(pills[2].textContent).toContain('Déjeuners');
    expect(container.querySelector('.rtab.active')).toHaveTextContent('Omelette');
    expect(document.querySelector('.menu-progress')).toHaveTextContent('Dîners 0/2');
    expect(document.querySelector('.menu-progress')).toHaveTextContent('Boxes 0/3');
  });

  it('onglet recette : meta, qui mange quoi, portions, préparation, batch associé — sans duplication recette', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    const { container } = render(
      <MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />,
    );
    await user.click(screen.getByRole('tab', { name: /Poulet au four/ }));
    expect(screen.getByText('Qui mange quoi')).toBeInTheDocument();
    expect(screen.getByText('Poulet + légumes (sans riz)')).toBeInTheDocument();
    expect(screen.getByText('Portions — par personne')).toBeInTheDocument();
    expect(screen.getByText(/1 poignée de riz \(~150 g\) · 2 cuisses/)).toBeInTheDocument();
    expect(screen.getByText('Préparation')).toBeInTheDocument();
    expect(screen.getByText('Four 200°.')).toBeInTheDocument();
    expect(screen.getByText('Batch associé')).toBeInTheDocument();
    expect(screen.getByText('Double riz → boîte mardi')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('680 kcal')).toBeInTheDocument();
    expect(screen.getByText(/Score 7\/10/)).toBeInTheDocument();
    expect(screen.getByText(/batch dimanche → boîte frigo/)).toBeInTheDocument();
    // Anti-duplication : les lignes mel:/batch: de la recette sont masquées
    // (le menu du jour est prioritaire).
    expect(screen.queryByText('KETO-RECETTE-INFO')).not.toBeInTheDocument();
    expect(screen.queryByText('BATCH-RECETTE-INFO')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.rtab')[0].textContent).not.toMatch(/lundi/i);
  });

  it('coche unique du dîner : CTA, pill grisée barrée, persistance, annulable', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    const { container } = render(
      <MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />,
    );
    await user.click(screen.getByRole('tab', { name: /Poulet au four/ }));
    await user.click(screen.getByRole('button', { name: /C'est fait — dîner fini/ }));
    expect(
      JSON.parse(localStorage.getItem('sportapp:checks:2026-S40')!)['menu:lundi:dinerFamille'],
    ).toBe(true);
    expect(container.querySelectorAll('.rtab')[0]).toHaveClass('fait');
    const onglet = document.querySelector('.onglet-recette');
    expect(onglet).toHaveClass('fait');
    await user.click(screen.getByRole('button', { name: /Dîner fait ✓ — annuler/ }));
    expect(onglet).not.toHaveClass('fait');
    expect(container.querySelectorAll('.rtab')[0]).not.toHaveClass('fait');
    expect(
      JSON.parse(localStorage.getItem('sportapp:checks:2026-S40')!)['menu:lundi:dinerFamille'],
    ).toBe(false);
  });

  it('coches existantes (v2) : la pill de la recette arrive déjà fait, sans aucune action', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // mercredi
    localStorage.setItem(
      'sportapp:checks:2026-S40',
      JSON.stringify({ 'menu:lundi:dinerFamille': true }),
    );
    const { container } = render(
      <MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />,
    );
    expect(container.querySelectorAll('.rtab')[0]).toHaveClass('fait');
    expect(document.querySelector('.menu-progress')).toHaveTextContent('Dîners 1/2');
  });

  it('file déjeuners : verrouillée avec note, prête après le dîner, coche paire = 2 ids, mangées barrées', async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    render(<MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />);
    await user.click(screen.getByRole('tab', { name: /Déjeuners/ }));

    // R1 pas fait : lundi + mardi verrouillées, jeudi (sans ref) prête.
    expect(screen.getByText('À venir')).toBeInTheDocument();
    // La note est segmentée par le <b> de la recette + espaces insécables :
    // matcher fonctionnel sur les .lock-note (textContent complet).
    expect(
      screen.getAllByText((_, el) =>
        el?.classList.contains('lock-note') === true &&
        /débloquée quand\s+Poulet au four\s+est fait/.test(el.textContent ?? ''),
      ),
    ).toHaveLength(2);
    expect(screen.getByText('Prêtes à emporter')).toBeInTheDocument();
    expect(screen.getByText('Restes ou wrap')).toBeInTheDocument();

    // On coche le dîner R1 → les paires lundi/mardi deviennent prêtes.
    await user.click(screen.getByRole('tab', { name: /Poulet au four/ }));
    await user.click(screen.getByRole('button', { name: /C'est fait — dîner fini/ }));
    await user.click(screen.getByRole('tab', { name: /Déjeuners/ }));
    expect(screen.queryAllByText(/débloquée quand/)).toHaveLength(0);

    // Coche de la première paire prête (lundi) : les 2 ids partent en storage.
    await user.click(screen.getAllByRole('button', { name: /Boxes faites/ })[0]);
    const checks = JSON.parse(localStorage.getItem('sportapp:checks:2026-S40')!);
    expect(checks['menu:lundi:dejeunerMarc']).toBe(true);
    expect(checks['menu:lundi:dejeunerMelanie']).toBe(true);
    expect(checks['menu:mardi:dejeunerMarc']).toBeUndefined();
    expect(document.querySelector('.menu-progress')).toHaveTextContent('Boxes 1/3');
    expect(screen.getByText('Mangées')).toBeInTheDocument();
    expect(document.querySelector('.box-pair.mangees')).not.toBeNull();
  });

  it('paire sans ref jamais verrouillée, paire à une ligne cochable seule', async () => {
    const user = userEvent.setup();
    render(<MenuView menu={MENU} recettes={[RECETTE]} bases={[]} semaine="2026-S40" />);
    await user.click(screen.getByRole('tab', { name: /Déjeuners/ }));
    expect(screen.getByText('Restes ou wrap')).toBeInTheDocument(); // jeudi : prête d'emblée
    await user.click(screen.getByRole('button', { name: /Boxes faites/ }));
    const checks = JSON.parse(localStorage.getItem('sportapp:checks:2026-S40')!);
    expect(checks['menu:jeudi:dejeunerMarc']).toBe(true); // coche seule, pas de melanie
  });

  it('menu vide : état vide', () => {
    render(<MenuView menu={[]} recettes={[]} semaine="2026-S40" />);
    expect(screen.getByText('Aucun menu pour cette semaine.')).toBeInTheDocument();
  });
});

describe('BatchView v2 — rituel et micro-batch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Les 5 étapes réelles de la semaine d'exemple (src/assets/semaine-exemple.md, § Rituel dimanche).
  const RITUEL = [
    { id: 'batch:rituel:four-a-180', creneau: '0-5 min', label: 'Four à 180°', detail: 'egg muffins ×10 lancés, on fait le reste' },
    { id: 'batch:rituel:cuissons', creneau: '5-30 min', label: 'Cuissons en double', detail: 'dîner ×2 + féculent ×2' },
    { id: 'batch:rituel:oeufs-durs', creneau: '30-35 min', label: 'Œufs durs ×6-8', detail: 'boxes de la semaine pour Mél' },
    { id: 'batch:rituel:legumes', creneau: '35-50 min', label: 'Légumes + vinaigrette', detail: 'laver, couper, ranger' },
    { id: 'batch:rituel:montage', creneau: '50-60 min', label: 'Montage des boxes', detail: 'boîte lundi Marc + 1 box keto Mél' },
  ];
  const MICRO = [
    { jour: 'lundi', quoi: 'doubler le plat' },
    { jour: 'mardi', quoi: 'doubler la sauce' },
  ];

  const RECETTE_BATCH: Recette = {
    id: 'r7-roti-de-dinde-gratin-courgettes-quinoa',
    nom: 'R7 · Rôti de dinde + gratin courgettes + quinoa',
    temps: '60 min · four 180°',
    pour: 'rôti de dinde ~800 g · 4 courgettes · 15 cl crème + 80 g râpé · 300 g quinoa',
    etapes: [
      'Four 180°. Rôti : huile + herbes + sel, 50-55 min.',
      'Gratin : courgettes précuites + crème + fromage, 25 min.',
      'Quinoa 15 min — en double.',
    ],
  };
  const RITUEL_AVEC_REF = [{ ...RITUEL[0], ref: 'r7' }, ...RITUEL.slice(1)];

  it('affiche le rituel en timeline avec créneaux, détails et badge de durée', () => {
    render(<BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />);
    expect(screen.getByText('Rituel dimanche')).toBeInTheDocument();
    expect(screen.getByText('≈ 1 h')).toBeInTheDocument();
    expect(screen.getByText('0-5 min')).toBeInTheDocument();
    expect(screen.getByText('Four à 180°')).toBeInTheDocument();
    expect(screen.getByText('egg muffins ×10 lancés, on fait le reste')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  });

  it('affiche le micro-batch en carrousel premium : badge jour + points de pagination', () => {
    const { container } = render(
      <BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />,
    );
    expect(screen.getByText('Micro-batch en semaine')).toBeInTheDocument();
    const badge = screen.getByText('Lundi');
    expect(badge).toHaveClass('micro-jour-nom');
    expect(screen.getByText('doubler la sauce')).toBeInTheDocument();
    // seuls les étapes du rituel sont cochables
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    const dots = container.querySelectorAll('.micro-dots i');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveClass('on');
    expect(dots[1]).not.toHaveClass('on');
  });

  it('micro-batch enrichi : pills durée/quantité + chip recette', () => {
    render(
      <BatchView
        rituel={RITUEL}
        recettes={[RECETTE_BATCH]}
        microBatch={[{ jour: 'mardi', quoi: 'précuire brocolis', duree: '10 min', quantite: '2 boîtes', ref: 'r7' }]}
        semaine="2026-S39"
      />,
    );
    expect(document.querySelectorAll('.micro-pill')).toHaveLength(2);
    expect(screen.getByText('10 min')).toBeInTheDocument();
    expect(screen.getByText('2 boîtes')).toBeInTheDocument();
    expect(document.querySelector('.micro-ref')).toHaveTextContent('Rôti de dinde');
    expect(document.querySelector('.micro-jour-detail')).toBeNull();
  });

  it('micro-batch avec ref cassée : la ref brute s affiche (repli)', () => {
    render(
      <BatchView
        rituel={RITUEL}
        microBatch={[{ jour: 'lundi', quoi: 'X', ref: 'r99' }]}
        semaine="2026-S39"
      />,
    );
    expect(document.querySelector('.micro-ref')).toHaveTextContent('r99');
  });

  it('cocher une étape du rituel persiste sous l’id batch:rituel:*', async () => {
    const user = userEvent.setup();
    render(<BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />);
    await user.click(screen.getByRole('checkbox', { name: 'Four à 180° (0-5 min)' }));
    expect(getChecks('2026-S39')).toEqual({ 'batch:rituel:four-a-180': true });
    expect(screen.getByRole('checkbox', { name: 'Four à 180° (0-5 min)' })).toBeChecked();
  });

  it('affiche la timeline au-dessus du micro-batch, sans checklist', () => {
    const { container } = render(
      <BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />,
    );
    const timeline = container.querySelector('.rituel-timeline');
    const micro = container.querySelector('.micro-batch');
    expect(timeline).not.toBeNull();
    expect(micro).not.toBeNull();
    expect(container.querySelector('ul.checklist')).toBeNull();
    expect(timeline!.compareDocumentPosition(micro!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('affiche la bannière Ce soir uniquement quand le micro-batch contient aujourd’hui', () => {
    vi.setSystemTime(new Date('2026-09-07T10:00:00')); // lundi — micro-batch lundi ✓
    render(<BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />);
    const ban = document.querySelector('.batch-banner.ce-soir');
    expect(ban).toHaveTextContent('Ce soir (lundi)');
    expect(ban).toHaveTextContent('doubler le plat');
    vi.useRealTimers();
  });

  it('pas de bannière Ce soir les autres jours', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // mercredi
    render(<BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />);
    expect(document.querySelector('.batch-banner.ce-soir')).toBeNull();
    vi.useRealTimers();
  });

  it('mode guidé : Lancer le rituel → étape par étape → écran terminé → retour aperçu (sans cocher)', async () => {
    const user = userEvent.setup();
    render(<BatchView rituel={RITUEL} microBatch={[]} semaine="2026-S39" />);
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    expect(document.querySelector('.guide-etape-num')).toHaveTextContent('Étape 1/5');
    expect(document.querySelector('.guide-titre')).toHaveTextContent('Four à 180°');
    await user.click(screen.getByRole('button', { name: 'Étape terminée →' }));
    expect(document.querySelector('.guide-etape-num')).toHaveTextContent('Étape 2/5');
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Étape terminée →' }));
    await user.click(screen.getByRole('button', { name: /Terminer le rituel/ }));
    expect(screen.getByText('Rituel terminé !')).toBeInTheDocument();
    // présentation pure : aucune coche de timeline posée
    expect(screen.queryByRole('checkbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Revoir l'aperçu/ }));
    expect(document.querySelector('.rituel-timeline')).not.toBeNull();
    expect(screen.getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(true);
  });

  it('garde anti-crash : rituel plus court pendant un run → retour aperçu (render-phase reset)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BatchView rituel={RITUEL} microBatch={[]} semaine="2026-S39" />);
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    await user.click(screen.getByRole('button', { name: 'Étape terminée →' }));
    await user.click(screen.getByRole('button', { name: 'Étape terminée →' }));
    await user.click(screen.getByRole('button', { name: 'Étape terminée →' }));
    expect(document.querySelector('.guide-etape-num')).toHaveTextContent('Étape 4/5');
    // changement de semaine : le nouveau rituel n'a qu'une étape (idx 3 hors bornes)
    rerender(<BatchView rituel={[RITUEL[0]]} microBatch={[]} semaine="2026-S40" />);
    expect(screen.getByRole('button', { name: /Lancer le rituel/ })).toBeInTheDocument();
    expect(screen.queryByText(/Étape /)).not.toBeInTheDocument();
  });

  it('sans rituel ni micro-batch : message muted seul', () => {
    const { container } = render(<BatchView semaine="2026-S39" />);
    expect(screen.getByText('Aucun rituel prévu cette semaine.')).toBeInTheDocument();
    expect(container.querySelector('.batch-banner')).toBeNull();
    expect(container.querySelector('.rituel-timeline')).toBeNull();
    expect(container.querySelector('.micro-batch')).toBeNull();
  });

  it('rendu v1 identique : rien à batcher → message muted, ni timeline ni bannière', () => {
    const { container } = render(
      <BatchView rituel={[]} microBatch={[]} semaine="2026-S39" />,
    );
    expect(screen.getByText('Aucun rituel prévu cette semaine.')).toBeInTheDocument();
    expect(container.querySelector('.batch-banner')).toBeNull();
    expect(container.querySelector('.rituel-timeline')).toBeNull();
    expect(container.querySelector('.micro-batch')).toBeNull();
  });

  it('resynchronise la timeline quand la semaine change (render-phase reset)', () => {
    const { rerender } = render(
      <BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />,
    );
    setCheck('2026-S39', 'batch:rituel:four-a-180', true);
    rerender(<BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S40" />);

    expect(screen.getByRole('checkbox', { name: 'Four à 180° (0-5 min)' })).not.toBeChecked();
    expect(getChecks('2026-S39')).toEqual({ 'batch:rituel:four-a-180': true });
    expect(getChecks('2026-S40')).toEqual({});
  });

  it('badge absent si aucun créneau parsable', () => {
    render(
      <BatchView
        rituel={[{ id: 'batch:rituel:x', creneau: 'à définir', label: 'X' }]}
        microBatch={[]}
        semaine="2026-S39"
      />,
    );
    expect(document.querySelector('.rituel-badge')).toBeNull();
  });

  it('affiche la ligne production sous le titre', () => {
    render(
      <BatchView
        rituel={RITUEL}
        microBatch={[]}
        production="2 boîtes frigo · 6 œufs durs"
        semaine="2026-S39"
      />,
    );
    expect(document.querySelector('.rituel-production')).toHaveTextContent('2 boîtes frigo');
  });

  it('le micro-batch affiche le détail en 3e ligne quand présent', () => {
    render(
      <BatchView
        rituel={RITUEL}
        microBatch={[{ jour: 'lundi', quoi: 'doubler le plat', detail: '10 min · la boîte de mardi passe au frigo' }]}
        semaine="2026-S39"
      />,
    );
    expect(document.querySelector('.micro-jour-detail')).toHaveTextContent('10 min');
  });

  it('affiche la réserve après le micro-batch avec les icônes déduites', () => {
    const { container } = render(
      <BatchView
        rituel={RITUEL}
        microBatch={MICRO}
        reserve={[
          { cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' },
          { cle: 'jeudi', plat: 'Poulet-riz', conservation: 'congelé dimanche · sortie mercredi soir' },
          { cle: 'mercredi', plat: 'Pâtes-tomate (famille)', conservation: 'cuites le soir' },
          { cle: 'mel', plat: 'Boîte keto saumon-asperges', conservation: 'à part' },
        ]}
        semaine="2026-S39"
      />,
    );
    const reserve = container.querySelector('.reserve-list');
    expect(reserve).not.toBeNull();
    expect(reserve!.querySelectorAll('.reserve-ligne')).toHaveLength(4);
    expect(screen.getByText('Mél — Boîte keto saumon-asperges')).toBeInTheDocument();
    expect(screen.getByText('Lundi — Poulet-riz')).toBeInTheDocument();
    // ordre DOM : micro-batch avant la réserve
    const micro = container.querySelector('.micro-batch');
    expect(micro!.compareDocumentPosition(reserve!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('l’état final du mode guidé utilise termine et « Revoir l’aperçu »', async () => {
    const user = userEvent.setup();
    render(
      <BatchView
        rituel={[{ id: 'batch:rituel:x', creneau: '0-5 min', label: 'X' }]}
        microBatch={[]}
        termine="4 boîtes prêtes — la semaine est servie."
        semaine="2026-S39"
      />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    await user.click(screen.getByRole('button', { name: /Terminer le rituel/ }));
    expect(screen.getByText('4 boîtes prêtes — la semaine est servie.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Revoir l'aperçu/ }));
    expect(document.querySelector('.rituel-timeline')).not.toBeNull();
  });

  it('sans termine : texte par défaut à l’état final', async () => {
    const user = userEvent.setup();
    render(<BatchView rituel={[{ id: 'batch:rituel:x', creneau: '0-5 min', label: 'X' }]} microBatch={[]} semaine="2026-S39" />);
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    await user.click(screen.getByRole('button', { name: /Terminer le rituel/ }));
    expect(screen.getByText('Tout est prêt pour la semaine.')).toBeInTheDocument();
  });

  it('réserve seule (sans rituel ni micro) : la réserve s’affiche, pas de message vide', () => {
    const { container } = render(
      <BatchView
        reserve={[{ cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' }]}
        semaine="2026-S39"
      />,
    );
    expect(container.querySelector('.reserve-list')).not.toBeNull();
    expect(screen.queryByText('Aucun rituel prévu cette semaine.')).toBeNull();
  });

  it('réserve : état disponible/consommé persisté sous reserve:{cle}:{plat}', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BatchView
        rituel={RITUEL}
        microBatch={[]}
        reserve={[{ cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' }]}
        semaine="2026-S39"
      />,
    );
    const ligne = container.querySelector('.reserve-ligne')!;
    expect(ligne).not.toHaveClass('consomme');
    expect(ligne.querySelector('.reserve-etat')).toHaveTextContent('Disponible');
    await user.click(screen.getByRole('checkbox', { name: 'Poulet-riz — marquer consommé' }));
    expect(getChecks('2026-S39')).toEqual({ 'reserve:lundi:poulet-riz': true });
    expect(ligne.querySelector('.reserve-etat')).toHaveTextContent('Consommé');
    expect(ligne).toHaveClass('consomme');
  });

  it('la réserve porte l explication d une ligne', () => {
    render(
      <BatchView
        reserve={[{ cle: 'mel', plat: 'Box keto', conservation: 'à part' }]}
        semaine="2026-S39"
      />,
    );
    expect(screen.getByText('Les plats d’avance qui attendent leur soir.')).toBeInTheDocument();
  });

  it('réserve : resynchronise l état au changement de semaine (render-phase reset)', () => {
    const { rerender } = render(
      <BatchView
        rituel={RITUEL}
        microBatch={[]}
        reserve={[{ cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' }]}
        semaine="2026-S39"
      />,
    );
    setCheck('2026-S39', 'reserve:lundi:poulet-riz', true);
    rerender(
      <BatchView
        rituel={RITUEL}
        microBatch={[]}
        reserve={[{ cle: 'lundi', plat: 'Poulet-riz', conservation: 'frigo, 2 j max' }]}
        semaine="2026-S40"
      />,
    );
    expect(document.querySelector('.reserve-etat')).toHaveTextContent('Disponible');
  });

  it('« Lancer le rituel » est un bouton pleine largeur sous la timeline (plus de pilule dans le head)', () => {
    const { container } = render(<BatchView rituel={RITUEL} microBatch={MICRO} semaine="2026-S39" />);
    expect(container.querySelector('.lancer-wrap')).toBeNull();
    const btn = screen.getByRole('button', { name: /Lancer le rituel/ });
    expect(btn).toHaveClass('lancer-btn');
    const section = container.querySelector('.batch-section')!;
    expect(section.contains(btn)).toBe(true);
    const timeline = container.querySelector('.rituel-timeline')!;
    expect(timeline.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mode guidé : une étape avec ref affiche la fiche recette dépliable', async () => {
    const user = userEvent.setup();
    render(
      <BatchView rituel={RITUEL_AVEC_REF} recettes={[RECETTE_BATCH]} microBatch={[]} semaine="2026-S39" />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    const btn = screen.getByRole('button', { name: 'Voir la fiche recette' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('60 min · four 180°')).toBeInTheDocument();
    expect(screen.getByText('Gratin : courgettes précuites + crème + fromage, 25 min.')).toBeInTheDocument();
    expect(screen.getByText('Ingrédients')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Masquer la fiche' }));
    expect(screen.queryByText('60 min · four 180°')).toBeNull();
  });

  it('deux étapes avec ref : la fiche repart fermée à chaque étape', async () => {
    const user = userEvent.setup();
    const RITUEL_DEUX_REFS = [{ ...RITUEL[0], ref: 'r7' }, { ...RITUEL[1], ref: 'r7' }, ...RITUEL.slice(2)];
    render(
      <BatchView rituel={RITUEL_DEUX_REFS} recettes={[RECETTE_BATCH]} microBatch={[]} semaine="2026-S39" />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    await user.click(screen.getByRole('button', { name: 'Voir la fiche recette' }));
    await user.click(screen.getByRole('button', { name: 'Étape terminée →' }));
    expect(screen.getByRole('button', { name: 'Voir la fiche recette' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('étape sans ref : pas de fiche recette', async () => {
    const user = userEvent.setup();
    render(
      <BatchView rituel={RITUEL_AVEC_REF} recettes={[RECETTE_BATCH]} microBatch={[]} semaine="2026-S39" />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    await user.click(screen.getByRole('button', { name: 'Étape terminée →' }));
    expect(screen.queryByRole('button', { name: /fiche recette/ })).toBeNull();
  });

  it('ref cassée : repli silencieux (pas de fiche, pas de crash)', async () => {
    const user = userEvent.setup();
    render(
      <BatchView
        rituel={[{ ...RITUEL[0], ref: 'r99' }]}
        recettes={[RECETTE_BATCH]}
        microBatch={[]}
        semaine="2026-S39"
      />,
    );
    await user.click(screen.getByRole('button', { name: /Lancer le rituel/ }));
    expect(screen.queryByRole('button', { name: /fiche recette/ })).toBeNull();
    expect(document.querySelector('.guide-titre')).toHaveTextContent('Four à 180°');
  });
});

describe('SuiviHero — carte héro objectif', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('perte avec pesées : anneau, kg restants, cible, échéance', () => {
    addWeight('marc', '2026-08-12', 82.8);
    addWeight('marc', '2026-09-07', 79.1);
    addWeight('marc', '2026-09-09', 78.4);
    render(<SuiviHero profile={profileV2('marc', { poidsObjectif: 74 })} />);

    expect(
      screen.getByRole('img', { name: "Progression : 50 % de l'objectif" }),
    ).toBeInTheDocument();
    expect(screen.getByText('4,4')).toBeInTheDocument();
    expect(screen.getByText('kg restants')).toBeInTheDocument();
    expect(screen.getByText(/Cible 74,0 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Échéance :/)).toHaveTextContent('15 déc. · dans 97 jours');
  });

  it('échéance dépassée : mention « dépassée » et classe late', () => {
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 74, objectif: { type: 'perte', echeance: '2026-06-15' } })}
      />,
    );
    expect(screen.getByText(/dépassée/)).toBeInTheDocument();
    expect(document.querySelector('.suivi-hero-echeance')).toHaveClass('late');
  });

  it('échéance aujourd’hui : mention du jour, pas de classe late', () => {
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 74, objectif: { type: 'perte', echeance: '2026-09-09' } })}
      />,
    );
    expect(screen.getByText(/Échéance :/)).toHaveTextContent('aujourd’hui');
    expect(document.querySelector('.suivi-hero-echeance')).not.toHaveClass('late');
  });

  it('sans échéance, pas de ligne échéance', () => {
    render(
      <SuiviHero profile={profileV2('marc', { poidsObjectif: 74, objectif: { type: 'perte' } })} />,
    );
    expect(screen.queryByText(/Échéance :/)).not.toBeInTheDocument();
  });

  it('masse : kg à prendre', () => {
    addWeight('marc', '2026-08-12', 74);
    addWeight('marc', '2026-09-09', 75.8);
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 82, objectif: { type: 'masse' } })}
      />,
    );
    expect(screen.getByText(/6,2/)).toBeInTheDocument();
    expect(screen.getByText('kg à prendre')).toBeInTheDocument();
  });

  it('maintien avec cible : anneau quand même', () => {
    addWeight('marc', '2026-08-12', 82.8);
    addWeight('marc', '2026-09-09', 78.4);
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 74, objectif: { type: 'maintien' } })}
      />,
    );
    expect(
      screen.getByRole('img', { name: "Progression : 50 % de l'objectif" }),
    ).toBeInTheDocument();
    expect(screen.getByText('4,4')).toBeInTheDocument();
    expect(screen.getByText('kg restants')).toBeInTheDocument();
  });

  it('maintien sans cible : cercle balance', () => {
    addWeight('marc', '2026-09-09', 78.4);
    render(<SuiviHero profile={profileV2('marc', { objectif: { type: 'maintien' } })} />);
    expect(screen.queryByRole('img', { name: /Progression/ })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Poids actuel' })).toBeInTheDocument();
    expect(screen.getByText('78,4')).toBeInTheDocument();
  });

  it('affiner avec cible : anneau', () => {
    addWeight('marc', '2026-08-12', 82.8);
    addWeight('marc', '2026-09-09', 78.4);
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 74, objectif: { type: 'affiner' } })}
      />,
    );
    expect(
      screen.getByRole('img', { name: "Progression : 50 % de l'objectif" }),
    ).toBeInTheDocument();
    expect(screen.getByText('4,4')).toBeInTheDocument();
    expect(screen.getByText('kg restants')).toBeInTheDocument();
  });

  it('cible au-dessus du départ : kg à prendre', () => {
    addWeight('marc', '2026-08-12', 74);
    addWeight('marc', '2026-09-09', 75.8);
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 82, objectif: { type: 'affiner' } })}
      />,
    );
    expect(screen.getByRole('img', { name: /Progression/ })).toBeInTheDocument();
    expect(screen.getByText('6,2')).toBeInTheDocument();
    expect(screen.getByText('kg à prendre')).toBeInTheDocument();
  });

  it('sans pesée : tiret, aucun crash', () => {
    render(<SuiviHero profile={profileV2('melanie')} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('perte avec cible sans pesée : tiret, cible affichée, pas d’anneau', () => {
    render(<SuiviHero profile={profileV2('marc', { poidsObjectif: 74 })} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/Cible 74,0 kg/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Progression/ })).not.toBeInTheDocument();
  });

  it('masse avec cible sans pesée : tiret, cible affichée, pas d’anneau', () => {
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 82, objectif: { type: 'masse' } })}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/Cible 82,0 kg/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Progression/ })).not.toBeInTheDocument();
  });

  it('delta 7 j : bon dans le sens de l objectif, alerte à contre-sens, neutre sans cible', () => {
    addWeight('marc', '2026-09-02', 78);
    addWeight('marc', '2026-09-08', 77.4);
    const { unmount } = render(<SuiviHero profile={profileV2('marc', { poidsObjectif: 70 })} />);
    expect(screen.getByText(/-0,6 kg/)).toHaveClass('stat-delta-bon');
    unmount();

    addWeight('marc', '2026-09-02', 78);
    addWeight('marc', '2026-09-08', 78.5);
    const { unmount: unmount2 } = render(
      <SuiviHero profile={profileV2('marc', { poidsObjectif: 70 })} />,
    );
    expect(screen.getByText(/\+0,5 kg/)).toHaveClass('stat-delta-alerte');
    unmount2();

    // addWeight fait un upsert par date : on ré-tablit l'état du 1er bloc
    // (78 → 77,4) pour le cas sans cible.
    addWeight('marc', '2026-09-02', 78);
    addWeight('marc', '2026-09-08', 77.4);
    render(<SuiviHero profile={profileV2('marc')} />);
    expect(screen.getByText(/-0,6 kg/)).toHaveClass('stat-delta-neutre');
  });

  it('chips : régime (sauf aucun) + compteur de compléments', () => {
    const { unmount } = render(
      <SuiviHero profile={profileV2('marc', { complements: ['Whey', 'Zinc'], regime: 'keto' })} />,
    );
    expect(screen.getByText('Keto')).toBeInTheDocument();
    expect(screen.getByText('2 compléments')).toBeInTheDocument();
    unmount();

    render(<SuiviHero profile={profileV2('melanie', { regime: 'aucun' })} />);
    expect(screen.queryByText(/Aucun/)).not.toBeInTheDocument();
    expect(screen.queryByText(/complément/)).not.toBeInTheDocument();
  });
});

const profileData: ProfileData = {
  cibles: ['Objectif 10 000 pas / jour', 'Protéines à chaque repas'],
  seances: [
    { id: 'seance-fullbody-a', label: 'Full body A' },
    { id: 'seance-cardio-30', label: 'Cardio 30 min' },
  ],
  rappels: ['Pesée chaque matin', '3 L d’eau par jour'],
};

describe('ProfileView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the title matching the profile', () => {
    const { unmount } = render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Marc — Diet & Sport' })).toBeInTheDocument();
    unmount();
    render(<ProfileView profile={profileV2('melanie')} data={profileData} semaine="S39" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Mélanie — Keto & Sport' })).toBeInTheDocument();
  });

  it('renders cibles and rappels as list items with the exact strings', () => {
    const { container } = render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    const cibles = Array.from(container.querySelectorAll('ul.target-list > li')).map((li) => li.textContent);
    expect(cibles).toEqual(profileData.cibles);
    const rappels = Array.from(container.querySelectorAll('ul.rappel-list > li')).map((li) => li.textContent);
    expect(rappels).toEqual(profileData.rappels);
  });

  it('renders the seances checklist and persists a toggle', async () => {
    const user = userEvent.setup();
    render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Full body A' });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(getChecks('S39')).toEqual({ 'seance-fullbody-a': true });
  });

  it('séances : le préfixe jour devient une pastille « conseillé », le reste est la liste', () => {
    const data: ProfileData = {
      cibles: [],
      seances: [
        { id: 's-lun', label: 'Lundi — Muscu libre 10h30' },
        { id: 's-libre', label: 'Course ou repos' },
      ],
      rappels: [],
    };
    render(<ProfileView profile={profileV2('marc')} data={data} semaine="S40" />);

    expect(screen.getByText('Muscu libre 10h30')).toBeInTheDocument();
    expect(screen.getByText('conseillé lun.')).toBeInTheDocument();
    expect(screen.getByText('Course ou repos')).toBeInTheDocument();
    // pas de pastille sans préfixe jour
    expect(screen.getAllByText(/conseillé/)).toHaveLength(1);
    // le titre porte le compte
    expect(screen.getByText(/Séances de la semaine · 0\/2/)).toBeInTheDocument();
  });

  it('séances : le compte du titre se met à jour au cochage', async () => {
    const user = userEvent.setup();
    render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S40" />);
    await user.click(screen.getByRole('checkbox', { name: 'Full body A' }));

    expect(screen.getByText(/Séances de la semaine · 1\/2/)).toBeInTheDocument();
  });

  it('adds a weight, shows it newest-first in the history and stores it', () => {
    addWeight('marc', '2026-09-05', 77.4);
    const { container } = render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    const dateInput = container.querySelector('input[name="date"]') as HTMLInputElement;
    const kgInput = container.querySelector('input[name="kg"]') as HTMLInputElement;
    expect(dateInput.value).toBe(todayISO());

    fireEvent.change(dateInput, { target: { value: '2026-09-07' } });
    fireEvent.change(kgInput, { target: { value: '76.8' } });
    // userEvent.click sur le bouton submit ne déclenche pas onSubmit sous happy-dom.
    fireEvent.submit(container.querySelector('form')!);

    const lis = Array.from(container.querySelectorAll('ul.weight-list > li')).map((li) => li.textContent);
    expect(lis).toEqual(['07/09 — 76.8 kg', '05/09 — 77.4 kg']);
    expect(getWeights('marc')).toEqual([
      { date: '2026-09-05', kg: 77.4 },
      { date: '2026-09-07', kg: 76.8 },
    ]);
    expect(kgInput.value).toBe('');
    expect(dateInput.value).toBe('2026-09-07');
  });

  it.each(['', 'abc', '-1'])('rejects invalid weight %j and stores nothing', (raw) => {
    const { container } = render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    const kgInput = container.querySelector('input[name="kg"]') as HTMLInputElement;
    fireEvent.change(kgInput, { target: { value: raw } });
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Poids invalide.');
    expect(getWeights('marc')).toEqual([]);
  });

  it('replaces the entry when the same date is submitted twice', () => {
    const { container } = render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    const dateInput = container.querySelector('input[name="date"]') as HTMLInputElement;
    const kgInput = container.querySelector('input[name="kg"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-07' } });

    const form = container.querySelector('form')!;
    fireEvent.change(kgInput, { target: { value: '76.8' } });
    fireEvent.submit(form);
    fireEvent.change(kgInput, { target: { value: '77.2' } });
    fireEvent.submit(form);

    const lis = Array.from(container.querySelectorAll('ul.weight-list > li')).map((li) => li.textContent);
    expect(lis).toEqual(['07/09 — 77.2 kg']);
    expect(getWeights('marc')).toEqual([{ date: '2026-09-07', kg: 77.2 }]);
  });

  it('re-syncs per-profile state when profile changes without remount', () => {
    addWeight('marc', '2026-09-05', 77.4);
    const { container, rerender } = render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    fireEvent.submit(container.querySelector('form')!); // kg vide -> erreur
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<ProfileView profile={profileV2('melanie')} data={profileData} semaine="S39" />);
    expect(container.querySelectorAll('ul.weight-list > li')).toHaveLength(0);
    expect(screen.queryByText('05/09 — 77.4 kg')).not.toBeInTheDocument();
    expect(screen.getByText('Ajoutez au moins 2 pesées pour voir la courbe.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    const lis = Array.from(container.querySelectorAll('ul.weight-list > li')).map((li) => li.textContent);
    expect(lis).toEqual(['05/09 — 77.4 kg']);
  });

  it('clears the error when the kg input changes', () => {
    const { container } = render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    fireEvent.submit(container.querySelector('form')!); // kg vide -> erreur
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(container.querySelector('input[name="kg"]')!, { target: { value: '76.8' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('exposes the date and kg inputs with dedicated classes and aria-labels', () => {
    const { container } = render(<ProfileView profile={profileV2('marc')} data={profileData} semaine="S39" />);
    const dateInput = container.querySelector('input[name="date"]')!;
    expect(dateInput).toHaveClass('weight-date');
    expect(dateInput).toHaveAttribute('aria-label', 'Date de la pesée');
    const kgInput = container.querySelector('input[name="kg"]')!;
    expect(kgInput).toHaveAttribute('aria-label', 'Poids (kg)');
    expect(container.querySelector('form')).toHaveClass('weight-form');
  });

  it('shows the weight chart hint when there are fewer than 2 entries', () => {
    const { container } = render(<ProfileView profile={profileV2('melanie')} data={profileData} semaine="S39" />);
    expect(screen.getByText('Ajoutez au moins 2 pesées pour voir la courbe.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders the weight curve (WeightChart) once there are 2+ entries', () => {
    addWeight('melanie', '2026-09-06', 64.2);
    addWeight('melanie', '2026-09-07', 63.8);
    const { container } = render(<ProfileView profile={profileV2('melanie')} data={profileData} semaine="S39" />);
    expect(
      screen.getByRole('img', { name: 'Courbe de poids de 64.2 à 63.8 kg' }),
    ).toBeInTheDocument();
    expect(container.querySelector('svg path.weight-ligne')).not.toBeNull();
  });

  it('todayISO returns the local calendar date as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    // Utiliser la forme `T10:00:00` (parse en heure locale), pas la forme date-only (parse en UTC).
    vi.setSystemTime(new Date('2026-09-07T23:30:00'));
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    expect(todayISO()).toBe(expected);
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe('WeekBanner', () => {
  const meta = { semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' };

  it('titre court « Semaine 39 » + dates courtes + pill cycle', () => {
    render(<WeekBanner meta={meta} onSwitcher={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 39');
    expect(screen.getByText('21 → 27 sept.')).toBeInTheDocument();
    expect(screen.getByText('Cycle 3')).toHaveClass('cycle-pill');
  });

  it('id sans numéro de semaine : pas de pill cycle', () => {
    render(<WeekBanner meta={{ ...meta, semaine: 'bizarr' }} />);
    expect(screen.queryByText(/Cycle/)).not.toBeInTheDocument();
  });

  it('chevrons toujours visibles, désactivés aux bornes', () => {
    render(<WeekBanner meta={meta} />);
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toBeDisabled();
  });

  it('navigue par chevrons quand les bornes le permettent', async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<WeekBanner meta={meta} onPrev={onPrev} onNext={onNext} hasPrev={false} hasNext />);
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled();
    const next = screen.getByRole('button', { name: 'Semaine suivante' });
    expect(next).toBeEnabled();
    await user.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('tap sur le titre ouvre le changeur de semaine', async () => {
    const user = userEvent.setup();
    const onSwitcher = vi.fn();
    render(<WeekBanner meta={meta} onSwitcher={onSwitcher} />);
    await user.click(screen.getByRole('button', { name: 'Semaine 39 — changer de semaine' }));
    expect(onSwitcher).toHaveBeenCalledTimes(1);
  });

  it('chip sync : « Local » hors foyer (tap = profil), « Duo » connecté (tap = resync)', async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    const onSyncTap = vi.fn();
    const { rerender } = render(
      <WeekBanner meta={meta} syncEtat="off" onOpenProfile={onOpenProfile} onSyncTap={onSyncTap} />,
    );
    const chip = screen.getByRole('button', { name: 'Hors foyer — ouvrir le profil pour connecter' });
    expect(chip).toHaveTextContent('Local');
    await user.click(chip);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
    expect(onSyncTap).not.toHaveBeenCalled();

    rerender(
      <WeekBanner meta={meta} syncEtat="sync" onOpenProfile={onOpenProfile} onSyncTap={onSyncTap} />,
    );
    const duo = screen.getByRole('button', { name: 'Duo — synchronisé, appuyer pour resynchroniser' });
    expect(duo).toHaveTextContent('Duo');
    await user.click(duo);
    expect(onSyncTap).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });
});

describe('SemaineSwitcher', () => {
  const semaine = (id: string, du: string, au: string, menu = 'A') => {
    const raw = mdSemaine(id, du, au, menu);
    return { raw, data: parseWeeklyFile(raw).data, importedAt: '' };
  };
  const semaines = [
    semaine('2026-S37', '2026-09-07', '2026-09-13', 'A'),
    semaine('2026-S38', '2026-09-14', '2026-09-20', 'B'),
  ];

  it('liste les semaines, marque l\u2019active, sélectionne au clic', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SemaineSwitcher semaines={semaines} active="2026-S38" onSelect={onSelect} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Choisir une semaine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Semaine 37/ })).toBeInTheDocument();
    const active = screen.getByRole('button', { name: /Semaine 38/ });
    expect(active).toHaveClass('actif');
    expect(active).toHaveAttribute('aria-current', 'true');
    await user.click(active);
    expect(onSelect).toHaveBeenCalledWith('2026-S38');
  });

  it('tap sur le voile ferme, tap sur la sheet non', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <SemaineSwitcher semaines={semaines} active="2026-S38" onSelect={vi.fn()} onClose={onClose} />,
    );
    const veil = container.querySelector('.switcher-veil');
    expect(veil).not.toBeNull();
    await user.click(veil as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    await user.click(screen.getByRole('dialog', { name: 'Choisir une semaine' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape ferme la sheet', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SemaineSwitcher semaines={semaines} active="2026-S38" onSelect={vi.fn()} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ImportButton', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const fichier = (nom: string, contenu: string) =>
    new File([contenu], nom, { type: 'text/markdown' });

  // happy-dom 20 ne livre qu'un seul fichier via user.upload (FileList non
  // simulable) et window.confirm n'existe pas : exception fireEvent documentée
  // comme fireEvent.submit (cf. AGENTS.md).
  const uploader = async (input: HTMLInputElement, ...files: File[]) => {
    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });
  };

  it('importe plusieurs fichiers en une fois et résume', async () => {
    const onImported = vi.fn();
    const { container } = render(<ImportButton onImported={onImported} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await uploader(
      input,
      fichier('2026-S38-menu-b.md', mdSemaine('2026-S38', '2026-09-14', '2026-09-20', 'B', 'Chili')),
      fichier('2026-S39-menu-c.md', mdSemaine('2026-S39', '2026-09-21', '2026-09-27', 'C', 'Basquaise')),
    );
    expect(Object.keys(loadWeeks()).sort()).toEqual(['2026-S38', '2026-S39']);
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/2 semaine\(s\) importée\(s\)/);
  });

  it('un fichier invalide n\u2019empêche pas les autres (erreur nominative)', async () => {
    const { container } = render(<ImportButton onImported={() => {}} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await uploader(
      input,
      fichier('casse.md', 'pas de frontmatter'),
      fichier('ok.md', mdSemaine('2026-S38', '2026-09-14', '2026-09-20')),
    );
    expect(Object.keys(loadWeeks())).toEqual(['2026-S38']);
    expect(screen.getByRole('alert')).toHaveTextContent(/casse\.md/);
  });

  it('demande confirmation avant de remplacer une semaine existante', async () => {
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirmMock);
    const { data } = parseWeeklyFile(mdSemaine('2026-S38', '2026-09-14', '2026-09-20'));
    upsertWeek('ancien', data);
    const { container } = render(<ImportButton onImported={() => {}} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await uploader(
      input,
      fichier('2026-S38-menu-b.md', mdSemaine('2026-S38', '2026-09-14', '2026-09-20')),
    );
    expect(confirmMock).toHaveBeenCalledOnce();
    expect(loadWeeks()['2026-S38'].raw).toBe('ancien');
    confirmMock.mockReturnValue(true);
    await uploader(
      input,
      fichier('2026-S38-menu-b.md', mdSemaine('2026-S38', '2026-09-14', '2026-09-20')),
    );
    expect(loadWeeks()['2026-S38'].raw).not.toBe('ancien');
    vi.unstubAllGlobals();
  });
});

describe('Icon', () => {
  const NAMES = [
    'cart', 'target', 'chev', 'chev-left', 'chev-right', 'pot', 'scale', 'moon',
    'box', 'snow', 'fish', 'leaf', 'wheat', 'bowl', 'meat', 'check', 'clock',
    'flame', 'drop', 'plus', 'play', 'pasta',
  ] as const;

  it('rend un svg 24×24 stroke currentColor à la taille demandée', () => {
    render(<Icon name="cart" size={15} />);
    const svg = document.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('width', '15');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('accepte un strokeWidth custom (check géant)', () => {
    render(<Icon name="check" size={24} strokeWidth={2.5} />);
    expect(document.querySelector('svg')).toHaveAttribute('stroke-width', '2.5');
  });

  it('couvre les 22 noms du design system sans crash', () => {
    for (const name of NAMES) {
      const { unmount } = render(<Icon name={name} />);
      expect(document.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('trait adaptatif : 2,5 sous 16 px, 2 au-delà — la prop explicite gagne', () => {
    const { unmount } = render(<Icon name="cart" size={14} />);
    expect(document.querySelector('svg')).toHaveAttribute('stroke-width', '2.5');
    unmount();
    const { unmount: u2 } = render(<Icon name="cart" size={16} />);
    expect(document.querySelector('svg')).toHaveAttribute('stroke-width', '2');
    u2();
    render(<Icon name="check" size={38} strokeWidth={2.5} />);
    expect(document.querySelector('svg')).toHaveAttribute('stroke-width', '2.5');
  });
});

describe('CoursesBudget — carte budget (citron)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche le payé en héros, la phrase secondaire (estimé + max) et le pourcentage', () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    render(
      <CoursesBudget
        data={dataAvecBudget('≈ 35 €')}
        profile={profileV2('marc', { magasin: 'Lidl', budgetMax: 40 })}
        onOuvrirDepenses={() => {}}
      />,
    );

    expect(screen.getByText('Budget courses')).toBeInTheDocument();
    expect(screen.getByText('Payé cette semaine')).toBeInTheDocument();
    expect(screen.getByText('38,20 €')).toBeInTheDocument();
    expect(screen.getByText(/≈ 35 €/)).toBeInTheDocument();
    expect(screen.getByText(/40,00 €/)).toBeInTheDocument();
    expect(screen.getByText('96 % du budget')).toBeInTheDocument();
    expect(screen.getByText('Lidl')).toBeInTheDocument(); // pill magasin
  });

  it('passe en rouge et annonce le dépassement au-delà du budget max', () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 43.8 }]);
    render(
      <CoursesBudget
        data={dataAvecBudget('≈ 35 €')}
        profile={profileV2('marc', { budgetMax: 40 })}
        onOuvrirDepenses={() => {}}
      />,
    );

    expect(screen.getByText('43,80 €')).toBeInTheDocument();
    expect(screen.getByText('dépassé de 10 %')).toBeInTheDocument();
    expect(document.querySelector('.bud-bar.alerte')).not.toBeNull();
    expect(document.querySelector('.bud-pct.alerte')).not.toBeNull();
    expect(document.querySelector('.bud-hero.alerte')).not.toBeNull();
  });

  it('somme uniquement les dépenses de la semaine affichée', () => {
    seedDepenses([
      { date: '2026-09-09', magasin: 'Lidl', total: 38.2 },
      { date: '2026-09-02', magasin: 'Lidl', total: 10 }, // semaine précédente (du = 2026-09-07)
      { date: '2026-09-14', magasin: 'Lidl', total: 5 }, // semaine suivante
    ]);
    render(
      <CoursesBudget
        data={dataAvecBudget()}
        profile={profileV2('marc', { budgetMax: 40 })}
        onOuvrirDepenses={() => {}}
      />,
    );

    expect(screen.getByText('38,20 €')).toBeInTheDocument();
    expect(screen.queryByText('48,20 €')).not.toBeInTheDocument();
  });

  it('sans budget max : phrase sans max, pas de barre ni de pourcentage', () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    render(
      <CoursesBudget data={dataAvecBudget('≈ 35 €')} profile={profileV2('marc')} onOuvrirDepenses={() => {}} />,
    );

    expect(screen.getByText(/≈ 35 €/)).toBeInTheDocument();
    expect(screen.queryByText(/max/)).not.toBeInTheDocument();
    expect(document.querySelector('.bud-bar')).toBeNull();
  });

  it('estimé absent du .md : la phrase ne porte que le max', () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    render(
      <CoursesBudget data={dataAvecBudget()} profile={profileV2('marc', { budgetMax: 40 })} onOuvrirDepenses={() => {}} />,
    );

    expect(screen.getByText(/max/)).toBeInTheDocument();
    expect(screen.queryByText(/estimés/)).not.toBeInTheDocument();
  });

  it('rien de saisi : « Payé » vaut —, pas de barre', () => {
    render(
      <CoursesBudget data={dataAvecBudget('≈ 35 €')} profile={profileV2('marc', { budgetMax: 40 })} onOuvrirDepenses={() => {}} />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(document.querySelector('.bud-bar')).toBeNull();
  });

  it('aucune donnée du tout : la carte ne rend rien', () => {
    const { container } = render(
      <CoursesBudget data={dataAvecBudget()} profile={profileV2('marc')} onOuvrirDepenses={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('deux actions en pills : « Total payé » et « Voir mes dépenses réelles »', async () => {
    const onOuvrir = vi.fn();
    const user = userEvent.setup();
    render(
      <CoursesBudget
        data={dataAvecBudget('≈ 35 €')}
        profile={profileV2('marc', { budgetMax: 40 })}
        onOuvrirDepenses={onOuvrir}
      />,
    );

    const total = screen.getByRole('button', { name: /Total payé/ });
    const voir = screen.getByRole('button', { name: /Voir mes dépenses réelles/ });
    expect(total).toHaveClass('bsoft');
    expect(voir).toHaveClass('bsoft');
    await user.click(total);
    expect(onOuvrir).toHaveBeenCalledWith(true);
    await user.click(voir);
    expect(onOuvrir).toHaveBeenCalledWith(false);
  });
});

describe('DepensesPanel — saisie, par magasin, historique', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const rendrePanel = (profile = profileV2('marc', { magasin: 'Lidl' }), focusTotal = false) =>
    render(<DepensesPanel profile={profile} focusTotal={focusTotal} onRetour={() => {}} />);

  it('préremplit la date du jour et le magasin du profil', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    rendrePanel();

    expect(screen.getByLabelText('Date')).toHaveValue('2026-09-09');
    expect(screen.getByLabelText('Magasin')).toHaveValue('Lidl');
  });

  it('enregistre une dépense (virgule acceptée) et la montre dans l historique', async () => {
    const user = userEvent.setup();
    rendrePanel();

    await user.type(screen.getByLabelText('Total (€)'), '38,20');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    expect(getDepenses()).toEqual([
      { date: expect.any(String), magasin: 'Lidl', total: 38.2 },
    ]);
    expect(screen.getAllByText('38,20 €').length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent(/Enregistré/);
  });

  it('refuse un total invalide ou une date future (rien n est sauvé)', async () => {
    const user = userEvent.setup();
    rendrePanel();

    await user.type(screen.getByLabelText('Total (€)'), '0');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Total invalide/i);
    expect(getDepenses()).toEqual([]);

    await user.clear(screen.getByLabelText('Total (€)'));
    await user.type(screen.getByLabelText('Total (€)'), '38,20');
    // input[type=date] : user-event v14 ne sait pas le remplir au clavier —
    // fireEvent.change, cas documenté comme l'upload multi-fichiers (AGENTS.md).
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2999-01-01' } });
    });
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/futur/i);
    expect(getDepenses()).toEqual([]);
  });

  it('refuse une date vide (rien n est sauvé)', async () => {
    const user = userEvent.setup();
    rendrePanel();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    });
    await user.type(screen.getByLabelText('Total (€)'), '38,20');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/date/i);
    expect(getDepenses()).toEqual([]);
  });

  it('upsert : ressaisir la même paire (date, magasin) remplace le total', async () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    const user = userEvent.setup();
    rendrePanel();

    // La date est préremplie à aujourd'hui : on la ramène à celle de la ligne
    // existante pour tester la paire (date, magasin) — sans quoi le test
    // dépendrait du jour réel.
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-09' } });
    });
    await user.clear(screen.getByLabelText('Magasin'));
    await user.type(screen.getByLabelText('Magasin'), 'Lidl');
    await user.clear(screen.getByLabelText('Total (€)'));
    await user.type(screen.getByLabelText('Total (€)'), '40');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    expect(getDepenses()).toEqual([{ date: '2026-09-09', magasin: 'Lidl', total: 40 }]);
  });

  it('prévient (sans succès) quand la re-saisie est ignorée pour une autre graphie', async () => {
    seedDepenses([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
    const user = userEvent.setup();
    rendrePanel();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-09' } });
    });
    await user.clear(screen.getByLabelText('Magasin'));
    await user.type(screen.getByLabelText('Magasin'), 'lidl');
    await user.clear(screen.getByLabelText('Total (€)'));
    await user.type(screen.getByLabelText('Total (€)'), '41,5');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/graphie/i);
    expect(screen.queryByRole('status')).toBeNull();
    expect(getDepenses()).toEqual([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]);
  });

  it('regroupe par magasin (casse ignorée) avec total et moyenne', () => {
    seedDepenses([
      { date: '2026-09-09', magasin: 'Lidl', total: 38.2 },
      { date: '2026-09-02', magasin: 'lidl', total: 35.1 },
      { date: '2026-08-26', magasin: 'Intermarché', total: 41.3 },
    ]);
    rendrePanel();

    // Scopé au résumé : « Lidl » apparaît aussi dans l'historique (et le span
    // .nm matche via son texte direct).
    const sum = within(document.querySelector('.dep-sum') as HTMLElement);
    expect(sum.getByText('Lidl')).toBeInTheDocument();
    expect(sum.getByText('2 sessions')).toBeInTheDocument();
    expect(sum.getByText('73,30 €')).toBeInTheDocument();
    expect(sum.getByText('≈ 36,65 € / session')).toBeInTheDocument();
    expect(sum.getByText('Intermarché')).toBeInTheDocument();
    expect(sum.getByText('1 session')).toBeInTheDocument();
  });

  it('supprime une ligne depuis l historique', async () => {
    seedDepenses([
      { date: '2026-09-09', magasin: 'Lidl', total: 38.2 },
      { date: '2026-09-02', magasin: 'Lidl', total: 35.1 },
    ]);
    const user = userEvent.setup();
    rendrePanel();

    await user.click(screen.getByRole('button', { name: 'Supprimer 09/09 Lidl' }));
    expect(getDepenses()).toEqual([{ date: '2026-09-02', magasin: 'Lidl', total: 35.1 }]);
  });

  it('les champs magasin proposent le datalist des magasins connus', () => {
    rendrePanel();

    expect(screen.getByLabelText('Magasin')).toHaveAttribute('list', 'dep-magasins');
    // <option value="…"/> n'a pas de texte : on vérifie les valeurs du datalist.
    const valeurs = [...document.querySelectorAll('#dep-magasins option')].map((o) =>
      o.getAttribute('value'),
    );
    expect(valeurs).toContain('Intermarché');
    expect(valeurs.length).toBeGreaterThan(1);
  });

  it('Annuler et Retour ferment le panneau', async () => {
    const onRetour = vi.fn();
    const user = userEvent.setup();
    render(<DepensesPanel profile={profileV2('marc')} focusTotal={false} onRetour={onRetour} />);

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onRetour).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(onRetour).toHaveBeenCalledTimes(2);
  });
});

describe('ProgressRing', () => {
  it('50 % : arc à mi-course, bourgeon en bas de l’anneau', () => {
    const { container } = render(
      <ProgressRing progress={0.5} ariaLabel="Progression : 50 % de l'objectif">
        <b>-4,2</b>
      </ProgressRing>,
    );
    expect(screen.getByRole('img', { name: "Progression : 50 % de l'objectif" })).toBeInTheDocument();
    const arc = container.querySelector('.ring-arc') as SVGCircleElement;
    expect(arc.getAttribute('stroke-dasharray')).toMatch(/^150\.79/);
    const bud = container.querySelector('.ring-bud') as SVGCircleElement;
    expect(bud.getAttribute('cy')).toBe('108'); // 60 + 48 (bas de l'anneau)
    expect(screen.getByText('-4,2')).toBeInTheDocument();
  });

  it('clamp 0-1 ; boucle fermée (≥ 98,5 %) : plus de bourgeon', () => {
    const { container } = render(
      <ProgressRing progress={2} ariaLabel="Progression : 100 % de l'objectif" />,
    );
    const arc = container.querySelector('.ring-arc') as SVGCircleElement;
    expect(arc.getAttribute('stroke-dasharray')).toMatch(/^301\.59/);
    expect(container.querySelector('.ring-bud')).toBeNull();
  });
});
