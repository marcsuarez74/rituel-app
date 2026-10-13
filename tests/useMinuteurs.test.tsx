import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMinuteurs } from '../src/components/useMinuteurs';
import type { MinuteursRetour } from '../src/components/useMinuteurs';

// Harness minimal : le hook est testé à travers ce qu'il rend, pas par
// introspection. Les minuteurs vivent dans App (survivent aux écrans) ;
// ici on vérifie la mécanique tic/persistance/vibration. Le stockage est lu
// directement dans localStorage (la persistance passe par un effet, le rendu
// de la valeur lue montrerait toujours la version d'avant).

const stocke = (): unknown => JSON.parse(localStorage.getItem('sportapp:rituel:minuteurs') ?? 'null');

function Tampon() {
  const h = useMinuteurs();
  return (
    <div>
      <div data-testid="liste">{h.minuteurs.map((m) => `${m.id}:${h.restant(m)}`).join('|')}</div>
      <div data-testid="sonnes">{h.sonnes.map((m) => m.id).join(',')}</div>
      <button type="button" onClick={() => h.lance('Lentilles', 1, 'lentilles-vertes-batch')}>
        lancer
      </button>
      <button type="button" onClick={() => h.oter(h.minuteurs[0]?.id ?? '')}>
        oter
      </button>
    </div>
  );
}

describe('useMinuteurs (tic 1 s, persistance, vibration)', () => {
  let vibrer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vibrer = vi.fn();
    Object.defineProperty(window.navigator, 'vibrate', { value: vibrer, configurable: true, writable: true });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const avance = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('lancer : le minuteur tourne et est persisté dans sportapp:rituel:minuteurs', () => {
    render(<Tampon />);
    expect(screen.getByTestId('liste').textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'lancer' }));
    expect(screen.getByTestId('liste').textContent).toMatch(/:60$/); // 1 min → 60 s
    expect(stocke()).toEqual([
      { id: expect.any(String), nom: 'Lentilles', recette: 'lentilles-vertes-batch', fin: expect.any(Number) },
    ]);
  });

  it("à l'échéance : sonné, vibration une seule fois, reste jusqu'au OK", () => {
    render(<Tampon />);
    fireEvent.click(screen.getByRole('button', { name: 'lancer' }));
    avance(59_000);
    expect(screen.getByTestId('sonnes').textContent).toBe('');
    expect(vibrer).not.toHaveBeenCalled();
    avance(2_000); // 61 s : la fin est passée
    expect(screen.getByTestId('sonnes').textContent).not.toBe('');
    expect(vibrer).toHaveBeenCalledWith([300, 150, 300]);
    const fois = vibrer.mock.calls.length;
    avance(5_000);
    expect(vibrer.mock.calls.length).toBe(fois); // pas de vibration en boucle
  });

  it("oter : le minuteur disparaît de l'état et du stockage", () => {
    render(<Tampon />);
    fireEvent.click(screen.getByRole('button', { name: 'lancer' }));
    fireEvent.click(screen.getByRole('button', { name: 'oter' }));
    expect(screen.getByTestId('liste').textContent).toBe('');
    expect(stocke()).toEqual([]);
  });

  it("au remontage, les minuteurs persistés sont repris (survit au changement d'écran)", () => {
    const { unmount } = render(<Tampon />);
    fireEvent.click(screen.getByRole('button', { name: 'lancer' }));
    const fin = (stocke() as { fin: number }[])[0].fin;
    unmount();
    // Le téléphone dort 30 s : à l'horloge simulée près, la fin est conservée.
    avance(30_000);
    render(<Tampon />);
    expect(screen.getByTestId('liste').textContent).toMatch(/:3[01]$/);
    expect((stocke() as { fin: number }[])[0].fin).toBe(fin);
  });

  it('le type MinuteursRetour est exporté pour les écrans (contrat de props)', () => {
    const h: MinuteursRetour | null = null;
    expect(h).toBeNull();
  });
});
