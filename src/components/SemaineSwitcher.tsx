import { useEffect } from 'react';
import type { ImportedWeek } from '../lib/model';
import { formatDayMonth, libelleSemaineCourt } from '../lib/dates';

// Changeur de semaine (bannière compacte) : bottom sheet listant les semaines
// du stock, la courante marquée. Tap sur le voile = fermer.
export function SemaineSwitcher({
  semaines,
  active,
  onSelect,
  onClose,
}: {
  semaines: ImportedWeek[];
  active: string;
  onSelect: (semaine: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="switcher-veil" onClick={onClose}>
      <div
        className="switcher-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Choisir une semaine"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="switcher-titre">Choisir une semaine</p>
        <ul className="switcher-list">
          {semaines.map((s) => {
            const id = s.data.meta.semaine;
            return (
              <li key={id}>
                <button
                  type="button"
                  className={id === active ? 'switcher-item actif' : 'switcher-item'}
                  aria-current={id === active ? 'true' : undefined}
                  onClick={() => onSelect(id)}
                >
                  <b>{libelleSemaineCourt(id)}</b>
                  <span className="switcher-dates">
                    {formatDayMonth(s.data.meta.du)} → {formatDayMonth(s.data.meta.au)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
