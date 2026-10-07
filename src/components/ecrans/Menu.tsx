import { dateDuJour, ordreJours } from '../../lib/cycle/calendrier';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { idCocheRepas, microBatchDuJour, repasDuJour } from '../../lib/cycle/menu';
import type { Jour, MembreId } from '../../lib/cycle/types';
import { LETTRES } from '../../lib/cycle/types';
import { capitalize } from '../../lib/text';
import { Icon } from '../Icon';
import { CarteRepas } from '../menu/CarteRepas';
import { useCoches } from '../useCoches';

// Onglet Menu (spec v2 §3, écran 2) : bande des 7 jours à partir du jour des
// courses (point = journée faite), repas du jour du membre, micro-batch du soir.
export function Menu({
  actif,
  foyer,
  semaine,
  moi,
  aujourdhui,
  syncVersion,
  jourVu,
  onJour,
  onOuvrirRecette,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  semaine: number;
  moi: MembreId;
  aujourdhui: string;
  syncVersion: number;
  jourVu: Jour | null; // null = aujourd'hui s'il est dans la semaine, sinon le 1er jour
  onJour: (j: Jour) => void;
  onOuvrirRecette: (recetteId: string, coche: string) => void;
}) {
  const lettre = LETTRES[semaine];
  const jours = ordreJours(foyer.jourCourses).map((jour) => ({
    jour,
    date: dateDuJour(actif, semaine, jour, foyer.jourCourses),
  }));
  const jour = jourVu ?? (jours.find((j) => j.date === aujourdhui) ?? jours[0]).jour;

  const { coches, basculer } = useCoches(semaineCoches(actif.id, semaine), syncVersion);
  const repas = repasDuJour(actif.cycle, lettre, jour, moi);
  const faits = repas.filter((r) => coches[idCocheRepas(lettre, jour, r)]).length;
  const date = jours.find((j) => j.jour === jour)!.date;

  return (
    <>
      <div className="bande-jours" role="tablist" aria-label="Jours">
        {jours.map((j) => {
          const liste = repasDuJour(actif.cycle, lettre, j.jour, moi);
          const complet = liste.length > 0 && liste.every((r) => coches[idCocheRepas(lettre, j.jour, r)]);
          return (
            <button
              key={j.jour}
              type="button"
              role="tab"
              aria-selected={j.jour === jour}
              aria-label={capitalize(j.jour)}
              className={j.date === aujourdhui ? 'jour aujourdhui' : 'jour'}
              onClick={() => onJour(j.jour)}
            >
              <span>{capitalize(j.jour.slice(0, 3))}</span>
              <b>{Number(j.date.slice(8))}</b>
              <span aria-hidden="true" className={complet ? 'point plein' : 'point'} />
            </button>
          );
        })}
      </div>
      <div className="menu-jour-tete">
        <h2>
          {capitalize(jour)} {Number(date.slice(8))}
        </h2>
        <p className="muted">
          {faits}/{repas.length} fait{faits > 1 ? 's' : ''}
        </p>
      </div>
      {repas.length === 0 && <p className="muted">Rien de prévu pour toi ce jour-là.</p>}
      {repas.map((r) => {
        const id = idCocheRepas(lettre, jour, r);
        return (
          <CarteRepas
            key={r.id}
            cycle={actif.cycle}
            repas={r}
            membres={foyer.membres}
            moi={moi}
            fait={!!coches[id]}
            onBasculer={() => basculer(id)}
            onOuvrir={(recetteId) => onOuvrirRecette(recetteId, id)}
          />
        );
      })}
      {microBatchDuJour(actif.cycle, lettre, jour).map((m) => (
        <section key={m.id} className="anticipe">
          <Icon name="clock" size={20} />
          <div>
            <p className="anticipe-titre">Ce soir, j'anticipe · {m.dureeMin} min</p>
            <p>{m.quoi}</p>
            {m.detail && <p className="muted">{m.detail}</p>}
          </div>
        </section>
      ))}
    </>
  );
}
