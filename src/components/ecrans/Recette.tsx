import { useEffect, useState } from 'react';
import { formatQuantite } from '../../lib/cycle/courses';
import type { Membre } from '../../lib/cycle/etat';
import { etapesRituelDe, prenomMembre, trouverRecette } from '../../lib/cycle/menu';
import type { Cycle, MembreId } from '../../lib/cycle/types';
import { Icon } from '../Icon';
import { Minuteur } from '../Minuteur';
import { useCoches } from '../useCoches';

const DIFFICULTE = { facile: 'Facile', moyen: 'Moyen', exigeant: 'Exigeant' } as const;

// Fiche recette (écran poussé, spec v2 §3 écran 3) : macros et portion du
// membre choisi, ingrédients du foyer et étapes cochables (mise en place, non
// persistée), minuteurs, conservation, lien au rituel. Pied : « Garder l’écran allumé »
// (Wake Lock si dispo) et « C'est fait » quand on vient d'un repas.
export function Recette({
  cycle,
  recetteId,
  membres,
  moi,
  coche,
  syncVersion,
  onRetour,
}: {
  cycle: Cycle;
  recetteId: string;
  membres: Membre[];
  moi: MembreId;
  coche?: { semaine: string; id: string };
  syncVersion: number;
  onRetour: () => void;
}) {
  const recette = trouverRecette(cycle, recetteId);
  const suivis = Object.keys(recette?.macros ?? {});
  const [pour, setPour] = useState(suivis.includes(moi) ? moi : (suivis[0] ?? moi));
  const [prets, setPrets] = useState<Set<number>>(new Set());
  const [faites, setFaites] = useState<Set<number>>(new Set());
  const { coches, basculer } = useCoches(coche?.semaine ?? '', syncVersion);
  const [verrou, setVerrou] = useState<WakeLockSentinel | null>(null);
  useEffect(() => () => void verrou?.release(), [verrou]);

  if (!recette) {
    return (
      <div className="recette">
        <button type="button" className="profil-back" onClick={onRetour}>
          <Icon name="chev-left" size={16} /> Retour
        </button>
        <p className="muted">Recette introuvable.</p>
      </div>
    );
  }

  const basculerDans = (set: Set<number>, maj: (s: Set<number>) => void, i: number) => {
    const s = new Set(set);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    maj(s);
  };
  const macros = pour ? recette.macros[pour] : undefined;
  const fait = coche ? !!coches[coche.id] : false;
  const ecranAllume = async () => {
    if (verrou) {
      await verrou.release();
      setVerrou(null);
      return;
    }
    try {
      const v = await navigator.wakeLock.request('screen');
      // Le navigateur relâche le verrou quand l'app passe en arrière-plan :
      // l'interrupteur doit le refléter.
      v.addEventListener('release', () => setVerrou(null));
      setVerrou(v);
    } catch {
      /* refusé (batterie faible, onglet caché) : rien à faire */
    }
  };
  const rituel = etapesRituelDe(cycle, recette.id);

  return (
    <div className="recette">
      <button type="button" className="profil-back" onClick={onRetour}>
        <Icon name="chev-left" size={16} /> Retour
      </button>
      <section className="recette-tete">
        <h1>{recette.nom}</h1>
        <div className="pastilles">
          <span className="pastille">
            <Icon name="clock" size={16} /> {recette.tempsMin} min
            {recette.tempsActifMin != null && ` · ${recette.tempsActifMin} actives`}
          </span>
          <span className="pastille">{DIFFICULTE[recette.difficulte]}</span>
        </div>
      </section>

      {macros && (
        <section className="profile-section" aria-labelledby="h-macros">
          <h2 id="h-macros">Par portion{pour !== moi && ` · ${prenomMembre(membres, pour)}`}</h2>
          <div className="macros">
            <div className="macro kcal">
              <b>{macros.kcal}</b>kcal
            </div>
            <div className="macro">
              <b>{macros.proteines} g</b>Protéines
            </div>
            <div className="macro">
              <b>{macros.glucides} g</b>Glucides
            </div>
            <div className="macro">
              <b>{macros.lipides} g</b>Lipides
            </div>
          </div>
        </section>
      )}

      <section className="profile-section" aria-labelledby="h-portion">
        <h2 id="h-portion">Ma portion</h2>
        {suivis.length > 1 && (
          <div className="segment" role="radiogroup" aria-label="Pour qui">
            {suivis.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={id === pour} onClick={() => setPour(id)}>
                {prenomMembre(membres, id)}
              </button>
            ))}
          </div>
        )}
        <p>{recette.portions[pour] ?? '—'}</p>
        {recette.variantes?.[pour] && (
          <p className="variante">
            <b>Version de {prenomMembre(membres, pour)}</b> {recette.variantes[pour]}
          </p>
        )}
      </section>

      <section className="profile-section" aria-labelledby="h-ingr">
        <h2 id="h-ingr">
          Ingrédients · pour le foyer{' '}
          <span className="muted">
            {prets.size}/{recette.ingredients.length}
          </span>
        </h2>
        {recette.ingredients.map((g, i) => (
          <button
            key={g.nom}
            type="button"
            className="ligne-cochable"
            aria-pressed={prets.has(i)}
            onClick={() => basculerDans(prets, setPrets, i)}
          >
            <span className="case" aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
            <span>
              <b>{formatQuantite(g.quantite, g.unite)}</b> {g.nom}
              {g.placard && <span className="muted"> · placard</span>}
            </span>
          </button>
        ))}
      </section>

      <section aria-labelledby="h-etapes">
        <h2 id="h-etapes">Préparation</h2>
        <ol className="etapes">
          {recette.etapes.map((e, i) => (
            <li key={i} className={faites.has(i) ? 'etape faite' : 'etape'}>
              <button
                type="button"
                className="etape-num"
                aria-pressed={faites.has(i)}
                aria-label={`Étape ${i + 1} ${faites.has(i) ? 'faite' : 'à faire'}`}
                onClick={() => basculerDans(faites, setFaites, i)}
              >
                {i + 1}
              </button>
              <div>
                <p>{e.texte}</p>
                {e.minuteurMin != null && <Minuteur minutes={e.minuteurMin} />}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="profile-section" aria-labelledby="h-conserv">
        <h2 id="h-conserv">Conservation</h2>
        <p>
          Frigo {recette.conservation.frigoJours} j · {recette.conservation.congelable ? 'se congèle' : 'ne se congèle pas'}
        </p>
        <p className="muted">{recette.conservation.rechauffage}</p>
        {recette.notes?.map((n) => (
          <p key={n} className="muted">
            {n}
          </p>
        ))}
      </section>

      {rituel.length > 0 && (
        <section className="lie-rituel">
          <p className="anticipe-titre">
            <Icon name="pot" size={16} /> Lié au rituel
          </p>
          {rituel.map((e) => (
            <p key={e.id}>
              {e.creneau} · {e.label}
            </p>
          ))}
        </section>
      )}

      <div className="pied-recette">
        {'wakeLock' in navigator && (
          <label className="interrupteur ecran-allume">
            <input type="checkbox" role="switch" checked={!!verrou} onChange={() => void ecranAllume()} />
            <span>
              Garder l'écran allumé
              <span className="muted">évite la mise en veille pendant que tu cuisines</span>
            </span>
          </label>
        )}
        {coche && (
          <button type="button" className="bouton-plein" aria-pressed={fait} onClick={() => basculer(coche.id)}>
            {fait ? 'Fait ✓' : "C'est fait"}
          </button>
        )}
      </div>
    </div>
  );
}
