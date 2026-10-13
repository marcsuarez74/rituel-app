import type { RangeLigne } from '../../lib/cycle/rituel';
import { couleurPlat } from '../../lib/cycle/couleurs';
import type { Rituel } from '../../lib/cycle/types';
import { capitalize } from '../../lib/text';
import { Icon } from '../Icon';
import { Bocal, Congelateur, Frigo, IlluBox } from '../illustrations/Illustrations';

// Zones de rangement (maquette : Frigo / Congélateur / Box). Deux modes :
// « aperçu » (écran Rituel en semaine — ce qui reste, où, à manger avant
// quand) et « ranger » (dernière étape du mode guidé — coche chaque boîte,
// ids range:{L}:{clé} via onBasculer).
export function Zones({
  lignes,
  rituel,
  ranger,
  coches = {},
  onBasculer,
}: {
  lignes: RangeLigne[];
  rituel: Rituel;
  ranger?: boolean;
  coches?: Readonly<Record<string, boolean>>;
  onBasculer?: (cle: string) => void;
}) {
  const zone = (z: RangeLigne['zone']) => lignes.filter((l) => l.zone === z);
  const frigo = zone('frigo');
  const congel = zone('congel');
  const box = zone('box');

  const contenant = (l: RangeLigne) => {
    const coche = !!coches[l.id];
    const couleur = couleurPlat(l.recetteId, rituel);
    const interieur = (
      <>
        {ranger && (
          <span className="case" aria-hidden="true">
            <Icon name="check" size={20} />
          </span>
        )}
        <Bocal vive={couleur.vive ?? 'var(--accent)'} claire={couleur.claire ?? 'var(--accent-clair)'} />
        <span className="contenant-txt">
          <b>{l.nom}</b>
          <span>
            {l.zone === 'congel'
              ? 'Sors-le la veille'
              : l.aMangerAvant
                ? `À manger avant ${formatJourLong(l.aMangerAvant)}`
                : l.nom}
          </span>
        </span>
      </>
    );
    if (ranger) {
      return (
        <button key={l.id} type="button" className="contenant" aria-pressed={coche} onClick={() => onBasculer?.(l.id)}>
          {interieur}
        </button>
      );
    }
    return (
      <div key={l.id} className="contenant">
        {interieur}
      </div>
    );
  };

  const boite = (l: RangeLigne) => {
    const coche = !!coches[l.id];
    const couleur = couleurPlat(l.recetteId, rituel);
    const jour = l.jour ? capitalize(l.jour) : '';
    const vars = { ['--c' as string]: couleur.vive ?? '#e08a1e', ['--t' as string]: couleur.claire ?? '#fde0c2' };
    const interieur = (
      <>
        <IlluBox vive={couleur.vive ?? '#e08a1e'} claire={couleur.claire ?? '#fde0c2'} jour={jour ? jour.slice(0, 3) : undefined} />
        <b>{jour ? `Box du ${jour.toLowerCase()}` : 'Box'}</b>
        <span>{l.nom}</span>
      </>
    );
    if (ranger) {
      return (
        <button
          key={l.id}
          type="button"
          className="boite"
          style={vars}
          aria-pressed={coche}
          aria-label={`Box ${jour ? `du ${jour.toLowerCase()}` : ''}, ${l.nom}${coche ? ', rangée' : ''}`}
          onClick={() => onBasculer?.(l.id)}
        >
          {interieur}
        </button>
      );
    }
    return (
      <div key={l.id} className="boite" style={vars}>
        {interieur}
      </div>
    );
  };

  return (
    <>
      {frigo.length > 0 && (
        <section className="zone frigo" aria-label="Frigo">
          <div className="zone-tete">
            <Frigo taille={48} />
            <h3>Frigo</h3>
            <p>{frigo.length} plats</p>
          </div>
          {frigo.map(contenant)}
        </section>
      )}
      {congel.length > 0 && (
        <section className="zone congel" aria-label="Congélateur">
          <div className="zone-tete">
            <Congelateur taille={48} />
            <h3>Congélateur</h3>
            <p>{congel.length} plats</p>
          </div>
          {congel.map(contenant)}
        </section>
      )}
      {box.length > 0 && (
        <section className="zone box" aria-label="Box à emporter">
          <div className="zone-tete">
            <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <rect x="6" y="18" width="36" height="22" rx="6" fill="#fbe2c0" stroke="var(--encre)" strokeWidth="2.5" />
              <rect x="4" y="13" width="40" height="8" rx="4" fill="#e08a1e" stroke="var(--encre)" strokeWidth="2.5" />
            </svg>
            <h3>Box</h3>
            <p>{box.length} box</p>
          </div>
          <div className="boxes">{box.map(boite)}</div>
        </section>
      )}
    </>
  );
}

function formatJourLong(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
