import type { PositionCycle } from '../../lib/cycle/calendrier';
import { ajouterJours } from '../../lib/cycle/calendrier';
import { couleurPlat, platsDuRituel } from '../../lib/cycle/couleurs';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { jourDeDate, prochainRepasDuJour, titreRepas, trouverRecette } from '../../lib/cycle/menu';
import { repasAvecReports } from '../../lib/cycle/reports';
import type { MembreId, Repas } from '../../lib/cycle/types';
import { formatJourMoisCourt } from '../../lib/dates';
import { getWeights } from '../../lib/storage';
import { capitalize, fmtKg } from '../../lib/text';
import { Icon } from '../Icon';
import { IlluBox, IlluCasserole } from '../illustrations/Illustrations';
import { RepasDuJour } from '../menu/RepasDuJour';
import type { Onglet } from '../shell/onglets';
import { useCoches } from '../useCoches';
import { useReports } from '../useReports';

const etatHorsSemaine = (numero: number, p: Exclude<PositionCycle, { etat: 'semaine' }>): string =>
  p.etat === 'pause'
    ? `Semaine de pause · reprise le ${formatJourMoisCourt(ajouterJours(p.au, 1))}`
    : p.etat === 'avant'
      ? `Menus n° ${numero} · démarre le ${formatJourMoisCourt(p.debut)}`
      : `Menus n° ${numero} terminés`;

const formatDuree = (min: number): string =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ''}`;

// L'ardoise du repas qui vient (§4.2.1) : quoi, où il est, un seul bouton.
function ArdoiseRepas({
  cycle,
  repas,
  jourRituel,
  onBasculer,
}: {
  cycle: CycleActif['cycle'];
  repas: Repas;
  jourRituel: string;
  onBasculer: () => void;
}) {
  const recette = repas.recette ? trouverRecette(cycle, repas.recette) : undefined;
  const titre = titreRepas(cycle, repas);
  const couleur = couleurPlat(repas.recette, cycle.rituel);
  return (
    <section className="ardoise" aria-label="Maintenant">
      <p className="quand">{repas.moment === 'dejeuner' ? 'Ce midi' : 'Ce soir'}</p>
      <h2>{repas.boite ? 'Ta box, au frigo' : `À cuisiner : ${titre}`}</h2>
      <div className="ardoise-scene">
        {repas.boite && couleur.vive && couleur.claire ? (
          <IlluBox vive={couleur.vive} claire={couleur.claire} jour={capitalize(jourRituel)} />
        ) : (
          <IlluCasserole />
        )}
        <p>
          {repas.boite
            ? `${titre}. ${recette?.conservation.rechauffage ?? 'Elle attend au frigo.'}`
            : `${titre}. Prévois ${recette?.tempsMin ?? 20} min en cuisine.`}
        </p>
      </div>
      <button type="button" className="bouton-plein large" onClick={onBasculer}>
        {repas.boite ? "J'ai pris ma box" : "C'est mangé"}
      </button>
    </section>
  );
}

// Écran « maintenant » (spec refonte §4.2) : l'ardoise dit quoi faire et
// d'où sortir le plat (le jour du rituel, elle appelle à commencer), les
// repas du jour cochables, la carte Suivi si suivi actif.
export function Aujourdhui({
  actif,
  foyer,
  moi,
  aujourdhui,
  position,
  exemple,
  suivi,
  syncVersion,
  onOuvrirRecette,
  onAller,
  onSuivi,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  moi: MembreId;
  aujourdhui: string;
  position: PositionCycle;
  exemple: boolean;
  suivi: boolean;
  syncVersion: number;
  onOuvrirRecette: (recetteId: string, coche: string) => void;
  onAller: (o: Onglet) => void;
  onSuivi: () => void;
}) {
  const index = position.etat === 'semaine' ? position.index : 0;
  const { coches, basculer } = useCoches(semaineCoches(actif.id, index), syncVersion);
  const { reports, enregistrer } = useReports(actif.id, syncVersion);
  if (position.etat !== 'semaine') {
    return (
      <section className="profile-section">
        <h2>{etatHorsSemaine(actif.numero, position)}</h2>
      </section>
    );
  }

  const jour = jourDeDate(aujourdhui);
  const duJour = repasAvecReports(actif.cycle, index, jour, moi, reports);
  const quiVient = prochainRepasDuJour(duJour, coches, new Date());
  const rituel = actif.cycle.rituel;
  const derniere = suivi ? getWeights(moi).at(-1) : null;
  const jourRituel = jour === foyer.jourRituel;

  return (
    <>
      {jourRituel ? (
        <section className="ardoise" aria-label="Maintenant">
          <p className="quand">Aujourd'hui</p>
          <h2>C'est {capitalize(foyer.jourRituel)}, jour de rituel</h2>
          <div className="ardoise-scene">
            <IlluCasserole />
            <p>
              {platsDuRituel(rituel).length} plats en {formatDuree(rituel.dureeMin)} environ. Ensuite, tout est prêt
              pour la semaine.
            </p>
          </div>
          <button type="button" className="bouton-plein large" onClick={() => onAller('rituel')}>
            Commencer le rituel
          </button>
        </section>
      ) : quiVient ? (
        <ArdoiseRepas
          cycle={actif.cycle}
          repas={quiVient.repas}
          jourRituel={foyer.jourRituel}
          onBasculer={() => basculer(quiVient.id)}
        />
      ) : (
        <section className="ardoise" aria-label="Maintenant">
          <p className="quand">Aujourd'hui</p>
          <h2>C'est mangé pour aujourd'hui</h2>
          <p>Belle journée !</p>
        </section>
      )}

      {exemple && <p className="muted exemple-note">Menus d'exemple : ils te montrent l'app en attendant tes menus.</p>}

      <div className="menu-jour-tete">
        <h2>Au menu aujourd'hui</h2>
        <button type="button" className="lien" onClick={() => onAller('semaine')}>
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
      {suivi && (
        <section className="carte-suivi" aria-label="Suivi">
          <Icon name="courbe" size={24} />
          <p className="carte-suivi-valeur">
            {derniere ? `Mon suivi : ${fmtKg(derniere.kg)} kg` : 'Mon suivi'}
          </p>
          <button type="button" className="bouton-contour" onClick={onSuivi}>
            Ajouter une pesée
          </button>
        </section>
      )}
    </>
  );
}
