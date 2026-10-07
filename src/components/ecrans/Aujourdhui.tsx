import type { PositionCycle } from '../../lib/cycle/calendrier';
import { ajouterJours } from '../../lib/cycle/calendrier';
import { estimerSemaine } from '../../lib/cycle/budget';
import { listeCourses } from '../../lib/cycle/courses';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { compteRepasSemaine, jourDeDate } from '../../lib/cycle/menu';
import { repasAvecReports } from '../../lib/cycle/reports';
import type { Lettre, MembreId } from '../../lib/cycle/types';
import { formatJourMoisCourt } from '../../lib/dates';
import { formatEuro } from '../../lib/prix';
import { Icon } from '../Icon';
import { RepasDuJour } from '../menu/RepasDuJour';
import type { Onglet } from '../shell/onglets';
import { useCoches } from '../useCoches';
import { useReports } from '../useReports';

const dateLongue = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const etatHorsSemaine = (numero: number, p: Exclude<PositionCycle, { etat: 'semaine' }>): string =>
  p.etat === 'pause'
    ? `Semaine de pause · reprise le ${formatJourMoisCourt(ajouterJours(p.au, 1))}`
    : p.etat === 'avant'
      ? `Cycle ${numero} · démarre le ${formatJourMoisCourt(p.debut)}`
      : `Cycle ${numero} terminé`;

function Jauge({ label, faits, total, onClick }: { label: string; faits: number; total: number; onClick: () => void }) {
  return (
    <button type="button" className="jauge" onClick={onClick}>
      <span>{label}</span>
      <b>
        {faits}/{total}
      </b>
      <progress max={total || 1} value={faits} aria-label={`${label} : ${faits} sur ${total}`} />
    </button>
  );
}

// Écran « maintenant » (spec v2 §3, écran 1) : la semaine en un coup d'œil,
// la prochaine action du jour (rituel, courses), les repas du jour cochables.
export function Aujourdhui({
  actif,
  foyer,
  moi,
  prenom,
  aujourdhui,
  position,
  exemple,
  syncVersion,
  onOuvrirRecette,
  onAller,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  moi: MembreId;
  prenom: string;
  aujourdhui: string;
  position: PositionCycle;
  exemple: boolean;
  syncVersion: number;
  onOuvrirRecette: (recetteId: string, coche: string) => void;
  onAller: (o: Onglet) => void;
}) {
  const index = position.etat === 'semaine' ? position.index : 0;
  const { coches, basculer } = useCoches(semaineCoches(actif.id, index), syncVersion);
  const { reports, enregistrer } = useReports(actif.id, syncVersion);
  const tete = (
    <>
      <p className="greeting">Salut {prenom} 👋</p>
      <p className="muted aujourdhui-date">{dateLongue(aujourdhui)}</p>
    </>
  );
  if (position.etat !== 'semaine') {
    return (
      <>
        {tete}
        <section className="profile-section">
          <h2>{etatHorsSemaine(actif.numero, position)}</h2>
        </section>
      </>
    );
  }

  const lettre: Lettre = position.lettre;
  const jour = jourDeDate(aujourdhui);
  const repas = compteRepasSemaine(actif.cycle, lettre, moi, coches);
  const courses = listeCourses(actif.cycle, lettre, index).lignes;
  const achetes = courses.filter((l) => coches[l.id]).length;
  const duJour = repasAvecReports(actif.cycle, index, jour, moi, reports);
  const rituel = actif.cycle.rituel;

  return (
    <>
      {tete}
      <section className="profile-section semaine-carte" aria-label="Ma semaine">
        <p className="semaine-carte-titre">
          Cycle {actif.numero} · semaine {index + 1} sur 4 · Menu {lettre}
        </p>
        {exemple && <p className="muted">Cycle d'exemple : il te montre l'app en attendant ton premier cycle.</p>}
        <div className="jauges">
          <Jauge label="Repas" faits={repas.faits} total={repas.total} onClick={() => onAller('menu')} />
          <Jauge label="Courses" faits={achetes} total={courses.length} onClick={() => onAller('courses')} />
        </div>
      </section>

      {jour === foyer.jourRituel && (
        <section className="action-du-jour" aria-label="À faire aujourd'hui">
          <p className="anticipe-titre">
            <Icon name="pot" size={16} /> À faire aujourd'hui
          </p>
          <h2>Rituel du {foyer.jourRituel}</h2>
          <p>
            {rituel.dureeMin} min · {rituel.etapes.length} étapes · {rituel.production.length} préparations
          </p>
          <button type="button" className="bouton-plein" onClick={() => onAller('rituel')}>
            Voir le rituel
          </button>
        </section>
      )}
      {jour === foyer.jourCourses && (
        <section className="action-du-jour" aria-label="À faire aujourd'hui">
          <p className="anticipe-titre">
            <Icon name="cart" size={16} /> À faire aujourd'hui
          </p>
          <h2>Jour des courses</h2>
          <p>
            {courses.length} articles · ≈ {formatEuro(estimerSemaine(actif.cycle, lettre).total)}
          </p>
          <button type="button" className="bouton-plein" onClick={() => onAller('courses')}>
            Voir la liste
          </button>
        </section>
      )}

      <div className="menu-jour-tete">
        <h2>Au menu aujourd'hui</h2>
        <button type="button" className="lien" onClick={() => onAller('menu')}>
          Toute la semaine
        </button>
      </div>
      {duJour.length === 0 && <p className="muted">Rien de prévu pour toi aujourd'hui.</p>}
      <RepasDuJour
        actif={actif}
        foyer={foyer}
        semaine={index}
        jour={jour}
        moi={moi}
        coches={coches}
        reports={reports}
        onReports={enregistrer}
        onBasculer={basculer}
        onOuvrir={onOuvrirRecette}
      />
    </>
  );
}
