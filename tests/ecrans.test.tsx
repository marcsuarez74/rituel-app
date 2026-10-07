import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Courses } from '../src/components/ecrans/Courses';
import { Recette } from '../src/components/ecrans/Recette';
import { type CycleActif, type Membre, type ReglagesFoyer, foyerParDefaut } from '../src/lib/cycle/etat';
import { getChecks, getDepenses } from '../src/lib/storage';
import { importerCycle } from '../src/lib/cycle/valider';
import { enFichiers, quatreFichiers } from './lib/cycle/fabrique';

const MEMBRES: Membre[] = [
  { id: 'alex', prenom: 'Alex', type: 'adulte', suivi: true },
  { id: 'sam', prenom: 'Sam', type: 'adulte', suivi: true, regime: 'keto' },
];

const cycle = () => {
  const fs = quatreFichiers();
  fs[0].rituel!.etapes[0].recette = 'diner-a-lundi';
  return importerCycle(enFichiers(fs)).cycle!;
};

const fiche = (moi = 'alex') => (
  <Recette cycle={cycle()} recetteId="diner-a-lundi" membres={MEMBRES} moi={moi} syncVersion={0} onRetour={() => {}} />
);

describe('Recette', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('macros et portion du membre actif, bascule vers la version d’un autre membre', async () => {
    const user = userEvent.setup();
    render(fiche());
    expect(screen.getByRole('heading', { level: 1, name: 'Recette diner-a-lundi' })).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument(); // kcal d'Alex
    expect(screen.queryByText('Version de Sam')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Sam' }));
    expect(screen.getByRole('heading', { name: 'Par portion · Sam' })).toBeInTheDocument();
    expect(screen.getByText('450')).toBeInTheDocument();
    expect(screen.getByText('Version de Sam')).toBeInTheDocument();
    expect(screen.getByText('Sans féculent')).toBeInTheDocument();
  });

  it('ingrédients pour le foyer cochables, quantités formatées, placard signalé ; lien au rituel', async () => {
    const user = userEvent.setup();
    render(fiche());
    const oeufs = screen.getByRole('button', { name: /×6 Œufs/ });
    expect(screen.getByText(/· placard/)).toBeInTheDocument();
    await user.click(oeufs);
    expect(oeufs).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: /Ingrédients · pour le foyer 1\/2/ })).toBeInTheDocument();
    expect(screen.getByText('Lié au rituel')).toBeInTheDocument();
    expect(screen.getByText('0-20 min · Muffins')).toBeInTheDocument();
  });

  it('étape avec minuteur : décompte, puis « Terminé »', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(fiche());
    await user.click(screen.getByRole('button', { name: /Minuteur 10 min/ }));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByRole('button', { name: /08:59 · Arrêter/ })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(9 * 60_000);
    });
    expect(screen.getByRole('button', { name: /Terminé/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('sans repas d’origine : pas de « C’est fait »', () => {
    render(fiche());
    expect(screen.queryByRole('button', { name: "C'est fait" })).not.toBeInTheDocument();
  });
});

describe('Courses', () => {
  const foyer = (budgetMax?: number): ReglagesFoyer => ({ ...foyerParDefaut(null), ...(budgetMax ? { budgetMax } : {}) });
  const actif = (): CycleActif => ({ id: 'c1', numero: 1, debut: '2026-10-03', pauses: [], cycle: cycle() });
  const ecran = (budgetMax?: number) => (
    <Courses actif={actif()} foyer={foyer(budgetMax)} semaine={0} aujourdhui="2026-10-03" syncVersion={0} />
  );

  beforeEach(() => {
    localStorage.clear();
  });

  it('carte Estimé / Payé / Max, détail keto + fixes, alerte au-dessus du plafond', () => {
    const { unmount } = render(ecran(30));
    expect(screen.getByText('Estimé').nextSibling).toHaveTextContent('≈ 20 €'); // 7 dîners (le rituel reprend celui de lundi) + fixes
    expect(screen.getByText('Max').nextSibling).toHaveTextContent('30 €');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();
    render(ecran(15));
    expect(screen.getByText('Estimé').parentElement).toHaveClass('alerte');
    expect(screen.getByRole('status')).toHaveTextContent('≈ 5 € au-dessus de ton plafond.');
  });

  it('rayons dans l’ordre, badge rituel, coche persistée, placard à part', async () => {
    const user = userEvent.setup();
    render(ecran());
    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titres).toEqual(['Protéines', 'Laitiers', 'Épicerie']);
    const oeufs = screen.getByRole('button', { name: /Œufs/ });
    expect(oeufs).toHaveTextContent('rituel');
    await user.click(oeufs);
    expect(getChecks('cycle:c1:0')).toEqual({ 'courses:A:proteines:oeuf': true });
    expect(screen.getByText(/Dans le chariot/)).toHaveTextContent('1 / 3');
    expect(screen.getByText(/À vérifier au placard · 1/)).toBeInTheDocument();
  });

  it('mode magasin : masque le coché ; « J’ai payé… » enregistre la dépense de la semaine', async () => {
    const user = userEvent.setup();
    render(ecran());
    await user.click(screen.getByRole('button', { name: /Œufs/ }));
    await user.click(screen.getByRole('button', { name: /Mode magasin/ }));
    expect(screen.queryByRole('button', { name: /Œufs/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Protéines' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /J'ai payé/ }));
    await user.type(screen.getByLabelText('Total du ticket (€)'), '54,30');
    fireEvent.submit(document.querySelector('.ticket')!);
    expect(getDepenses()).toEqual([{ date: '2026-10-03', magasin: 'Courses', total: 54.3 }]);
    expect(screen.getByText('Payé').nextSibling).toHaveTextContent('54,30');
  });
});
