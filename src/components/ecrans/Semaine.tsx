import { dateDuJour, ordreJours } from '../../lib/cycle/calendrier';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { microBatchDuJour } from '../../lib/cycle/menu';
import { repasAvecReports } from '../../lib/cycle/reports';
import { changementsEnAttente } from '../../lib/cycle/semaineType';
import type { Jour, MembreId } from '../../lib/cycle/types';
import { LETTRES } from '../../lib/cycle/types';
import { capitalize } from '../../lib/text';
import { BandeauProchainsMenus } from '../BandeauProchainsMenus';
import { Icon } from '../Icon';
import { RepasDuJour } from '../menu/RepasDuJour';
import { LigneSemaine } from '../shell/LigneSemaine';
import { useCoches } from '../useCoches';
import { useReports } from '../useReports';

// Onglet Semaine (spec refonte §4.3) : navigation entre les 4 semaines
// (reprise de LigneSemaine, seule ici), bande des 7 jours à partir du jour
// des courses (point = journée faite), repas du jour du membre, micro-batch
// du soir, liens vers la semaine type et l'assistant.
export function Semaine({
  actif,
  foyer,
  semaine,
  moi,
  aujourdhui,
  syncVersion,
  jourVu,
  onJour,
  onSemaine,
  onSemaineType,
  onProchainsMenus,
  onOuvrirRecette,
  instantane,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  semaine: number;
  moi: MembreId;
  aujourdhui: string;
  syncVersion: number;
  jourVu: Jour | null; // null = aujourd'hui s'il est dans la semaine, sinon le 1er jour
  /** Instantané de la semaine type au lancement des menus (option B §6). */
  instantane?: unknown;
  onJour: (j: Jour) => void;
  onSemaine: (n: number) => void;
  onSemaineType: () => void;
  onProchainsMenus: () => void;
  onOuvrirRecette: (recetteId: string, coche: string) => void;
}) {
  const lettre = LETTRES[semaine];
  const jours = ordreJours(foyer.jourCourses).map((jour) => ({
    jour,
    date: dateDuJour(actif, semaine, jour, foyer.jourCourses),
  }));
  const jour = jourVu ?? (jours.find((j) => j.date === aujourdhui) ?? jours[0]).jour;

  const { coches, basculer } = useCoches(semaineCoches(actif.id, semaine), syncVersion);
  const { reports, enregistrer } = useReports(actif.id, syncVersion);
  const repas = repasAvecReports(actif.cycle, semaine, jour, moi, reports);
  const faits = repas.filter((x) => coches[x.id]).length;
  const date = jours.find((j) => j.jour === jour)!.date;

  return (
    <>
      <LigneSemaine cal={actif} index={semaine} onChange={onSemaine} />
      <BandeauProchainsMenus k={changementsEnAttente(foyer, instantane).length} onOuvrir={onProchainsMenus} />
      <div className="bande-jours" role="tablist" aria-label="Jours">
        {jours.map((j) => {
          const liste = repasAvecReports(actif.cycle, semaine, j.jour, moi, reports);
          const complet = liste.length > 0 && liste.every((x) => coches[x.id]);
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
      <RepasDuJour
        actif={actif}
        foyer={foyer}
        semaine={semaine}
        jour={jour}
        moi={moi}
        coches={coches}
        reports={reports}
        onReports={enregistrer}
        onBasculer={basculer}
        onOuvrir={onOuvrirRecette}
      />
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
      <div className="semaine-liens">
        <button type="button" className="bouton-contour" onClick={onSemaineType}>
          Ma semaine type
        </button>
        {/* Dernière semaine des menus : l'assistant prend le relais (spec §4.3). */}
        {semaine === 3 && (
          <button type="button" className="bouton-plein" onClick={onProchainsMenus}>
            Prépare tes prochains menus
          </button>
        )}
      </div>
    </>
  );
}
