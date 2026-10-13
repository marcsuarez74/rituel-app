import { Fragment, useState } from 'react';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { couleurPlat } from '../../lib/cycle/couleurs';
import { titreRepas } from '../../lib/cycle/menu';
import {
  auFrigo,
  dernierJourRituel,
  etapesGuidees,
  grilleDimanche,
  idCocheRituel,
  platsDuDimanche,
} from '../../lib/cycle/rituel';
import type { CelluleGrille, PlatDuDimanche, RangeLigne } from '../../lib/cycle/rituel';
import type { Cycle, Rituel as RituelJson } from '../../lib/cycle/types';
import { JOURS, LETTRES } from '../../lib/cycle/types';
import { capitalize } from '../../lib/text';
import { loadExplique, saveExplique } from '../../lib/storage';
import { FrigoGrand, IlluCasserole, MicroOndes } from '../illustrations/Illustrations';
import { Zones } from '../rituel/Zones';
import { useCoches } from '../useCoches';

// Onglet Rituel (spec refonte §5.1) : page unique. Le jour du rituel : ce
// que tu prépares (résumé, grille, plats) et le pied « Commencer ». Les
// autres jours : « Au frigo cette semaine », puis l'aperçu du prochain
// dimanche. À la première visite, une feuille de 3 vignettes explique le
// principe (relisible via « C'est quoi le rituel ? »).

const MOMENTS_FR: Record<string, string> = { dejeuner: 'midi', diner: 'soir', collation: 'collation' };
const JOURS_COURTS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

const formatDuree = (min: number): string =>
  min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;

export function Rituel({
  actif,
  foyer,
  semaine,
  syncVersion,
  aujourdhui,
  onGuide,
  onOuvrirRecette,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  semaine: number;
  syncVersion: number;
  aujourdhui: string;
  onGuide: (etape: number) => void;
  onOuvrirRecette: (id: string) => void;
}) {
  const lettre = LETTRES[semaine];
  const cycle = actif.cycle;
  const { coches } = useCoches(semaineCoches(actif.id, semaine), syncVersion);
  const [vu, setVu] = useState(loadExplique);
  const [feuille, setFeuille] = useState(false);

  const dateJour = new Date(`${aujourdhui}T12:00:00`); // midi local : évite les bords de DST
  const jourRituel = JOURS.indexOf(foyer.jourRituel);
  const cEstLeJour = (dateJour.getDay() + 6) % 7 === jourRituel;
  // Le rituel le plus récent (aujourd'hui ou avant) : base des dates de rangement.
  const dernierRituel = dernierJourRituel(dateJour, foyer.jourRituel);

  const grille = grilleDimanche(cycle, semaine);
  const plats = platsDuDimanche(cycle, semaine);
  const lignes = auFrigo(cycle, semaine, dernierRituel, coches);
  const etapes = etapesGuidees(cycle.rituel);
  const premiereNonFait = etapes.findIndex((e) => !coches[idCocheRituel(lettre, e.id)]);
  const prets = grille.filter((c) => c.prepareDimanche).length;

  const dimanche = (
    <>
      <h2 className="titre-pousse">Ce dimanche, tu prépares</h2>
      <p>
        {plats.length} plat{plats.length > 1 ? 's' : ''} en {formatDuree(cycle.rituel.dureeMin)} environ, pour{' '}
        {prets} repas de la semaine.
      </p>
      <div className="grille" role="group" aria-label="La semaine des repas">
        <span />
        {JOURS_COURTS.map((j) => (
          <span key={j} className="gl">
            {j}
          </span>
        ))}
        {(['dejeuner', 'diner'] as const).map((moment) => (
          <Fragment key={moment}>
            <span className="gr">{moment === 'dejeuner' ? 'Midi' : 'Soir'}</span>
            {grille
              .filter((c) => c.moment === moment)
              .map((c) => (
                <Cellule key={`${c.jour}-${moment}`} cellule={c} cycle={cycle} rituel={cycle.rituel} />
              ))}
          </Fragment>
        ))}
      </div>
      <p className="legende">
        <span>
          <i />
          Cuisiné dimanche
        </span>
        <span>
          <i className="p" />
          Fait le jour même
        </span>
      </p>
      <h2 className="titre-section">À cuisiner dimanche</h2>
      <div className="plats">
        {plats.map((p) => (
          <CartePlat key={p.recette.id} plat={p} cycle={cycle} lignes={lignes} onOuvrir={onOuvrirRecette} />
        ))}
      </div>
      <button type="button" className="lien c-quoi" onClick={() => setFeuille(true)}>
        C'est quoi le rituel ?
      </button>
    </>
  );

  return (
    <>
      {cEstLeJour ? (
        dimanche
      ) : (
        <>
          <h2 className="titre-pousse">Au frigo cette semaine</h2>
          <p>Tout ce que tu as préparé dimanche. Ça se vide au fil des repas.</p>
          <Zones lignes={lignes} rituel={cycle.rituel} />
          {dimanche}
        </>
      )}
      {cEstLeJour && (
        <div className="pied-recette">
          <button
            type="button"
            className="bouton-plein"
            onClick={() => onGuide(Math.max(0, premiereNonFait))}
          >
            {premiereNonFait <= 0 ? 'Commencer' : `Reprendre, étape ${premiereNonFait + 1}`}
          </button>
        </div>
      )}
      {(feuille || !vu) && (
        <div className="voile" onClick={() => setFeuille(false)}>
          <section
            className="feuille"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-explic"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="titre-explic">Le rituel, c'est quoi ?</h2>
            <div className="vignettes">
              <div className="vignette">
                <IlluCasserole taille={76} />
                <p>
                  <b>1. Le dimanche</b>Tu cuisines environ {formatDuree(cycle.rituel.dureeMin)}, plusieurs plats à
                  la fois.
                </p>
              </div>
              <div className="vignette">
                <FrigoGrand taille={76} />
                <p>
                  <b>2. Tu ranges</b>Au frigo, au congélateur et dans les box.
                </p>
              </div>
              <div className="vignette">
                <MicroOndes taille={76} />
                <p>
                  <b>3. La semaine</b>Tu n'as plus qu'à réchauffer.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="bouton-plein large"
              onClick={() => {
                saveExplique(true);
                setVu(true);
                setFeuille(false);
              }}
            >
              J'ai compris
            </button>
          </section>
        </div>
      )}
    </>
  );
}

// Une case de la grille : pleine (préparée dimanche), pointillés (fait le
// jour même), vide (pas de repas). La couleur du plat n'est jamais la seule
// information : libellé accessible + légende.
function Cellule({ cellule, cycle, rituel }: { cellule: CelluleGrille; cycle: Cycle; rituel: RituelJson }) {
  const momentFr = MOMENTS_FR[cellule.moment];
  const quand = `${capitalize(cellule.jour)} ${momentFr}`;
  if (!cellule.repas || cellule.repas.exception) {
    return <span className="cel dehors" role="img" aria-label={`${quand} : dehors`} />;
  }
  const couleur = couleurPlat(cellule.recetteId, rituel);
  const etat = cellule.prepareDimanche ? 'rit' : 'surplace';
  const label = `${quand} : ${titreRepas(cycle, cellule.repas)}, ${
    cellule.prepareDimanche ? 'préparée dimanche' : 'fait le jour même'
  }`;
  return (
    <span
      className={`cel ${etat}`}
      role="img"
      aria-label={label}
      style={{ ['--c' as string]: couleur.vive ?? 'var(--papier-2)', ['--t' as string]: couleur.claire ?? 'var(--papier-2)' }}
    />
  );
}

// Carte « À cuisiner dimanche » : pastille couleur, nom, repas couverts
// (« Pour mardi soir ») + portions congelées le cas échéant.
function CartePlat({
  plat,
  cycle,
  lignes,
  onOuvrir,
}: {
  plat: PlatDuDimanche;
  cycle: Cycle;
  lignes: RangeLigne[];
  onOuvrir: (id: string) => void;
}) {
  const couleur = couleurPlat(plat.recette.id, cycle.rituel);
  const quand = plat.repas
    .map((c) => `${c.jour} ${MOMENTS_FR[c.repas.moment] ?? c.repas.moment}`)
    .join(', ');
  const congel = lignes.filter((l) => l.zone === 'congel' && l.recetteId === plat.recette.id).length;
  const libelle = `Pour ${quand}${congel > 0 ? ` + ${congel} portion${congel > 1 ? 's' : ''} au congélateur` : ''}`;
  return (
    <button
      type="button"
      className="plat"
      style={{ ['--c' as string]: couleur.vive ?? 'var(--accent)', ['--t' as string]: couleur.claire ?? 'var(--accent-clair)' }}
      onClick={() => onOuvrir(plat.recette.id)}
    >
      <span className="pastille" />
      <span className="plat-txt">
        <span className="plat-nom">{plat.recette.nom}</span>
        <span className="plat-quand">{plat.repas.length > 0 ? libelle : 'Pour la semaine'}</span>
      </span>
    </button>
  );
}
