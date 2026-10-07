import { fireEvent, render, screen } from '@testing-library/react';
import type { UserProfile } from '../src/lib/model';
import { addWeight, getWeights } from '../src/lib/storage';
import { todayISO } from '../src/lib/dates';
import { SuiviHero } from '../src/components/SuiviHero';
import { WeightChart } from '../src/components/WeightChart';
import { ProgressRing } from '../src/components/ProgressRing';
import { Pesees } from '../src/components/Pesees';
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

describe('Pesees', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds a weight, shows it newest-first in the history and stores it', () => {
    addWeight('marc', '2026-09-05', 77.4);
    const { container } = render(<Pesees profile={profileV2('marc')} />);
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
    const { container } = render(<Pesees profile={profileV2('marc')} />);
    const kgInput = container.querySelector('input[name="kg"]') as HTMLInputElement;
    fireEvent.change(kgInput, { target: { value: raw } });
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Poids invalide.');
    expect(getWeights('marc')).toEqual([]);
  });

  it('replaces the entry when the same date is submitted twice', () => {
    const { container } = render(<Pesees profile={profileV2('marc')} />);
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
    const { container, rerender } = render(<Pesees profile={profileV2('marc')} />);
    fireEvent.submit(container.querySelector('form')!); // kg vide -> erreur
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<Pesees profile={profileV2('melanie')} />);
    expect(container.querySelectorAll('ul.weight-list > li')).toHaveLength(0);
    expect(screen.queryByText('05/09 — 77.4 kg')).not.toBeInTheDocument();
    expect(screen.getByText('Ajoutez au moins 2 pesées pour voir la courbe.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<Pesees profile={profileV2('marc')} />);
    const lis = Array.from(container.querySelectorAll('ul.weight-list > li')).map((li) => li.textContent);
    expect(lis).toEqual(['05/09 — 77.4 kg']);
  });

  it('clears the error when the kg input changes', () => {
    const { container } = render(<Pesees profile={profileV2('marc')} />);
    fireEvent.submit(container.querySelector('form')!); // kg vide -> erreur
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(container.querySelector('input[name="kg"]')!, { target: { value: '76.8' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('exposes the date and kg inputs with dedicated classes and aria-labels', () => {
    const { container } = render(<Pesees profile={profileV2('marc')} />);
    const dateInput = container.querySelector('input[name="date"]')!;
    expect(dateInput).toHaveClass('weight-date');
    expect(dateInput).toHaveAttribute('aria-label', 'Date de la pesée');
    const kgInput = container.querySelector('input[name="kg"]')!;
    expect(kgInput).toHaveAttribute('aria-label', 'Poids (kg)');
    expect(container.querySelector('form')).toHaveClass('weight-form');
  });

  it('shows the weight chart hint when there are fewer than 2 entries', () => {
    const { container } = render(<Pesees profile={profileV2('melanie')} />);
    expect(screen.getByText('Ajoutez au moins 2 pesées pour voir la courbe.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders the weight curve (WeightChart) once there are 2+ entries', () => {
    addWeight('melanie', '2026-09-06', 64.2);
    addWeight('melanie', '2026-09-07', 63.8);
    const { container } = render(<Pesees profile={profileV2('melanie')} />);
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

  it('couvre les icônes d\'origine sans crash (lock, user et les ajouts hub ont leur test dédié)', () => {
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

  it('icônes du hub : info, home, copy, refresh', () => {
    for (const name of ['info', 'home', 'copy', 'refresh'] as const) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).toBeInTheDocument();
      expect(svg?.childElementCount, `${name} : glyphe présent`).toBeGreaterThan(0);
      unmount();
    }
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
