import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Recette } from '../src/components/ecrans/Recette';
import type { Membre } from '../src/lib/cycle/etat';
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
