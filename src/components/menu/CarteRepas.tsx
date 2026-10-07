import type { Membre } from '../../lib/cycle/etat';
import { prenomMembre, titreRepas, trouverRecette } from '../../lib/cycle/menu';
import type { Cycle, MembreId, Repas } from '../../lib/cycle/types';
import { Icon } from '../Icon';

const DIFFICULTE = { facile: 'Facile', moyen: 'Moyen', exigeant: 'Exigeant' } as const;

const libelleMoment = (r: Repas): string =>
  r.moment === 'dejeuner' ? 'Déjeuner' : r.moment === 'collation' ? 'Collation' : r.pour === 'famille' ? 'Dîner famille' : 'Dîner';

// Un repas (Menu, Aujourd'hui) : ouvre la fiche recette, se coche d'un tap,
// montre les versions des autres membres, l'exception et la boîte du rituel.
export function CarteRepas({
  cycle,
  repas,
  membres,
  moi,
  fait,
  onBasculer,
  onOuvrir,
}: {
  cycle: Cycle;
  repas: Repas;
  membres: Membre[];
  moi: MembreId;
  fait: boolean;
  onBasculer: () => void;
  onOuvrir: (recetteId: string) => void;
}) {
  const recette = trouverRecette(cycle, repas.recette);
  const titre = titreRepas(cycle, repas);
  const kcal = recette?.macros[moi]?.kcal;
  const meta = recette
    ? [`${recette.tempsMin} min`, DIFFICULTE[recette.difficulte], kcal != null ? `${kcal} kcal` : null].filter(Boolean).join(' · ')
    : null;
  const corps = (
    <>
      <span className="carte-repas-moment">{libelleMoment(repas)}</span>
      <span className="carte-repas-titre">{titre}</span>
      {meta && <span className="carte-repas-meta">{meta}</span>}
    </>
  );
  return (
    <article className={fait ? 'carte-repas fait' : 'carte-repas'}>
      <div className="carte-repas-tete">
        {recette ? (
          <button type="button" className="carte-repas-corps" onClick={() => onOuvrir(recette.id)}>
            {corps}
          </button>
        ) : (
          <div className="carte-repas-corps">{corps}</div>
        )}
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
      {repas.boite && (
        <p className="carte-repas-ligne">
          <Icon name="box" size={16} /> Boîte du rituel · frigo {repas.boite.frigoJours} j max
        </p>
      )}
    </article>
  );
}
