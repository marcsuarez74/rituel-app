import { ajouterJours, debutSemaine, type CalendrierCycle } from '../../lib/cycle/calendrier';
import { LETTRES } from '../../lib/cycle/types';
import { periodeCourte } from '../../lib/dates';
import { Icon } from '../Icon';

// Ligne semaine (Menu, Courses, Rituel) : ‹ Sem. 2 · 10–16 oct. · Menu B ›.
// Navigue dans les 4 semaines du cycle ; chevrons grisés aux bornes.
export function LigneSemaine({
  cal,
  index,
  onChange,
}: {
  cal: CalendrierCycle;
  index: number;
  onChange: (index: number) => void;
}) {
  const du = debutSemaine(cal, index);
  return (
    <div className="ligne-semaine">
      <button
        type="button"
        aria-label="Semaine précédente"
        disabled={index <= 0}
        onClick={() => onChange(index - 1)}
      >
        <Icon name="chev-left" size={20} />
      </button>
      <p>
        Sem. {index + 1} · {periodeCourte(du, ajouterJours(du, 6))} ·{' '}
        <span className="ligne-semaine-menu">Menu {LETTRES[index]}</span>
      </p>
      <button
        type="button"
        aria-label="Semaine suivante"
        disabled={index >= LETTRES.length - 1}
        onClick={() => onChange(index + 1)}
      >
        <Icon name="chev-right" size={20} />
      </button>
    </div>
  );
}
