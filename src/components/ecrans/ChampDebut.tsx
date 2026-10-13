import type { Jour } from '../../lib/cycle/types';
import { jourDe } from '../../lib/cycle/calendrier';

// Début des menus : passé autorisé (« courses faites samedi dernier ») ; le
// jour des courses du foyer suit la date choisie (changerDebut). Partagé par
// « Mes menus » (changement de début) et l'assistant (étape 3).
export function ChampDebut({ valeur, jourCourses, onChange }: { valeur: string; jourCourses: Jour; onChange: (v: string) => void }) {
  return (
    <label className="debut-cycle">
      Début des menus (jour des courses de la semaine 1)
      <input type="date" value={valeur} onChange={(e) => onChange(e.target.value)} />
      {valeur && jourDe(valeur) !== jourCourses && (
        <span className="muted">Le jour des courses passe au {jourDe(valeur)}.</span>
      )}
    </label>
  );
}
