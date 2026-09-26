import { describe, expect, it, vi } from 'vitest';
import { creerLimiteur } from '../src/rate-limit.js';

describe('server: rate-limit', () => {
  it('laisse passer max requêtes puis refuse dans la fenêtre, réautorise après', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00'));
    const limite = creerLimiteur({ max: 3, fenetreMs: 100 });
    expect([limite('ip1'), limite('ip1'), limite('ip1')]).toEqual([true, true, true]);
    expect(limite('ip1')).toBe(false);          // 4ᵉ refusée
    expect(limite('ip2')).toBe(true);           // autre clef : indépendante
    vi.advanceTimersByTime(120);                 // fenêtre écoulée
    expect(limite('ip1')).toBe(true);
    vi.useRealTimers();
  });
});

