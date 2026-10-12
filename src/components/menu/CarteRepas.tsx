import type { CSSProperties } from 'react';
import type { Membre } from '../../lib/cycle/etat';
import { couleurPlat } from '../../lib/cycle/couleurs';
import { prenomMembre, titreRepas, trouverRecette } from '../../lib/cycle/menu';
import type { Cycle, MembreId, Repas } from '../../lib/cycle/types';
import { Icon } from '../Icon';

const DIFFICULTE = { facile: 'Facile', moyen: 'Moyen', exigeant: 'Exigeant' } as const;

const libelleMoment = (r: Repas): string =>
  r.moment === 'dejeuner' ? 'Déjeuner' : r.moment === 'collation' ? 'Collation' : r.pour === 'famille' ? 'Dîner famille' : 'Dîner';

// Provenance du repas (§4.2.2) : une box préparée au rituel, sinon à cuisiner.
const provenance = (repas: Repas, tempsMin?: number): string =>
  repas.boite ? 'Box, au frigo' : tempsMin != null ? `À cuisiner, ${tempsMin} min` : 'À cuisiner';

// Un repas (Semaine, Aujourd'hui) : ouvre la fiche recette, se coche d'un tap,
// montre les versions des autres membres, l'exception et la boîte du rituel ;
// liseré de la couleur du plat + étiquette kraft de provenance.
export function CarteRepas({
  cycle,
  repas,
  membres,
  moi,
  fait,
  origine,
  onBasculer,
  onOuvrir,
  onReporter,
}: {
  cycle: Cycle;
  repas: Repas;
  membres: Membre[];
  moi: MembreId;
  fait: boolean;
  origine?: string; // jour d'origine d'un repas reporté
  onBasculer: () => void;
  onOuvrir: (recetteId: string) => void;
  onReporter?: () => void;
}) {
  const recette = trouverRecette(cycle, repas.recette);
  const titre = titreRepas(cycle, repas);
  const couleur = couleurPlat(repas.recette, cycle.rituel);
  const kcal = recette?.macros[moi]?.kcal;
  // Le temps de préparation vit dans l'étiquette kraft : pas de doublon.
  const meta = recette
    ? [DIFFICULTE[recette.difficulte], kcal != null ? `${kcal} kcal` : null].filter(Boolean).join(' · ')
    : null;
  const corps = (
    <>
      <span className="carte-repas-moment">
        {libelleMoment(repas)}
        {origine && ` · reporté de ${origine}`}
      </span>
      <span className="carte-repas-titre">{titre}</span>
      {meta && <span className="carte-repas-meta">{meta}</span>}
    </>
  );
  return (
    <article
      className={fait ? 'carte-repas fait' : 'carte-repas'}
      style={{ '--plat-vive': couleur.vive ?? undefined, '--plat-claire': couleur.claire ?? undefined } as CSSProperties}
    >
      <div className="carte-repas-tete">
        {recette ? (
          <button type="button" className="carte-repas-corps" onClick={() => onOuvrir(recette.id)}>
            {corps}
          </button>
        ) : (
          <div className="carte-repas-corps">{corps}</div>
        )}
        {recette && <span className="kraft">{provenance(repas, recette.tempsMin)}</span>}
        <button
          type="button"
          className="coche"
          aria-pressed={fait}
          aria-label={fait ? `${titre} : fait, annuler` : `${titre} : marquer comme fait`}
          onClick={onBasculer}
        >
          <Icon name="check" size={20} />
        </button>
      </div>
      {Object.entries(recette?.variantes ?? {}).map(([id, texte]) => (
        <p key={id} className="carte-repas-ligne">
          <b>{id === moi ? 'Ta version' : prenomMembre(membres, id)}</b> {texte}
        </p>
      ))}
      {repas.exception && (
        <p className="carte-repas-ligne">
          <b>{repas.exception.quand}</b> {repas.exception.pour.map((id) => prenomMembre(membres, id)).join(', ')} :{' '}
          {repas.exception.texte}
        </p>
      )}
      {onReporter && !fait && (
        <button type="button" className="lien reporter" onClick={onReporter}>
          Pas ce soir : reporter
        </button>
      )}
      {repas.boite && (
        <p className="carte-repas-ligne">
          <Icon name="box" size={16} /> Boîte du rituel · frigo {repas.boite.frigoJours} j max
        </p>
      )}
    </article>
  );
}
