import type { PositionCycle } from '../../lib/cycle/calendrier';
import { ajouterJours } from '../../lib/cycle/calendrier';
import { formatJourMoisCourt } from '../../lib/dates';

const dateLongue = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const etatCycle = (numero: number, p: PositionCycle): string => {
  switch (p.etat) {
    case 'semaine':
      return `Cycle ${numero} · semaine ${p.index + 1} sur 4 · Menu ${p.lettre}`;
    case 'pause':
      return `Semaine de pause · reprise le ${formatJourMoisCourt(ajouterJours(p.au, 1))}`;
    case 'avant':
      return `Cycle ${numero} · démarre le ${formatJourMoisCourt(p.debut)}`;
    case 'termine':
      return `Cycle ${numero} terminé`;
  }
};

// Écran « maintenant » (spec v2 §3, écran 1). Squelette du shell : salut,
// date et état du cycle ; repas du jour et prochaine action arrivent ensuite.
export function Aujourdhui({
  prenom,
  aujourdhui,
  numero,
  position,
  exemple,
}: {
  prenom: string;
  aujourdhui: string;
  numero: number;
  position: PositionCycle;
  exemple: boolean;
}) {
  return (
    <>
      <p className="greeting">Salut {prenom} 👋</p>
      <p className="muted aujourdhui-date">{dateLongue(aujourdhui)}</p>
      <section className="profile-section">
        <h2>{etatCycle(numero, position)}</h2>
        {exemple && <p className="muted">Cycle d'exemple : il te montre l'app en attendant ton premier cycle.</p>}
      </section>
    </>
  );
}
