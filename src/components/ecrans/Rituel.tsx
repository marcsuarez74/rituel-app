import { useState } from 'react';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { prenomMembre, trouverRecette } from '../../lib/cycle/menu';
import { idCocheMicro, idCocheMise, idCocheReserve, idCocheRituel } from '../../lib/cycle/rituel';
import { JOURS, LETTRES } from '../../lib/cycle/types';
import type { Jour } from '../../lib/cycle/types';
import { capitalize } from '../../lib/text';
import { Icon } from '../Icon';
import { useCoches } from '../useCoches';

export type VueRituel = 'jour' | 'semaine' | 'reserve';

// Onglet Rituel (spec v2 §3, écran 5) : le rituel du jour (résumé, avant de
// commencer, déroulé dépliable), le micro-batch de la semaine, la réserve.
export function Rituel({
  actif,
  foyer,
  semaine,
  syncVersion,
  vue,
  onVue,
  onGuide,
  onOuvrirRecette,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  semaine: number;
  syncVersion: number;
  vue: VueRituel;
  onVue: (v: VueRituel) => void;
  onGuide: () => void;
  onOuvrirRecette: (recetteId: string) => void;
}) {
  const lettre = LETTRES[semaine];
  const { rituel } = actif.cycle;
  const menu = actif.cycle.menus.find((m) => m.lettre === lettre)!;
  const { coches, basculer } = useCoches(semaineCoches(actif.id, semaine), syncVersion);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const onglets: Array<[VueRituel, string]> = [
    ['jour', capitalize(foyer.jourRituel)],
    ['semaine', 'En semaine'],
    ['reserve', 'Réserve'],
  ];
  const lienRecette = (id?: string) => {
    const r = trouverRecette(actif.cycle, id);
    return (
      r && (
        <button type="button" className="lien" onClick={() => onOuvrirRecette(r.id)}>
          Fiche : {r.nom} ›
        </button>
      )
    );
  };
  const faites = rituel.etapes.filter((e) => coches[idCocheRituel(lettre, e.id)]).length;
  const prets = rituel.avantDeCommencer.filter((_, i) => coches[idCocheMise(lettre, i)]).length;

  return (
    <>
      <div className="segment" role="tablist" aria-label="Sections du rituel">
        {onglets.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={vue === id} onClick={() => onVue(id)}>
            {label}
          </button>
        ))}
      </div>

      {vue === 'jour' && (
        <>
          <section className="action-du-jour" aria-label="Résumé du rituel">
            <p className="anticipe-titre">
              {capitalize(foyer.jourRituel)} · {rituel.dureeMin} min · {rituel.etapes.length} étapes
            </p>
            <ul className="production">
              {rituel.production.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <button type="button" className="bouton-plein" onClick={onGuide}>
              <Icon name="play" size={18} /> Lancer le mode guidé
            </button>
          </section>

          {menu.rappelsRituel && menu.rappelsRituel.length > 0 && (
            <details className="profile-section placard">
              <summary>
                Cette semaine aussi <span className="muted">· {menu.rappelsRituel.length}</span>
              </summary>
              <ul>
                {menu.rappelsRituel.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          )}

          <details className="profile-section placard">
            <summary>
              Avant de commencer
              <span className="muted">
                · {prets}/{rituel.avantDeCommencer.length}
              </span>
            </summary>
            {rituel.avantDeCommencer.map((m, i) => (
              <button
                key={m.nom}
                type="button"
                className="ligne-cochable"
                aria-pressed={!!coches[idCocheMise(lettre, i)]}
                onClick={() => basculer(idCocheMise(lettre, i))}
              >
                <span className="case" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
                <span className="ligne-nom">{m.nom}</span>
                <span className="ligne-qte">{m.quantite}</span>
              </button>
            ))}
          </details>

          <div className="menu-jour-tete">
            <h2>Le déroulé</h2>
            <p className="muted">
              {faites}/{rituel.etapes.length}
            </p>
          </div>
          {rituel.etapes.map((e) => {
            const id = idCocheRituel(lettre, e.id);
            const ouvert = ouverte === e.id;
            return (
              <article key={e.id} className={coches[id] ? 'carte-repas fait' : 'carte-repas'}>
                <div className="carte-repas-tete">
                  <button
                    type="button"
                    className="coche"
                    aria-pressed={!!coches[id]}
                    aria-label={`${e.label} : ${coches[id] ? 'fait, annuler' : 'marquer comme fait'}`}
                    onClick={() => basculer(id)}
                  >
                    <Icon name="check" size={20} />
                  </button>
                  <button
                    type="button"
                    className="carte-repas-corps"
                    aria-expanded={ouvert}
                    onClick={() => setOuverte(ouvert ? null : e.id)}
                  >
                    <span className="carte-repas-moment">{e.creneau}</span>
                    <span className="carte-repas-titre">{e.label}</span>
                  </button>
                  <Icon name="chev" size={18} />
                </div>
                {ouvert && (
                  <div className="etape-detail">
                    <p>{e.detail}</p>
                    {e.enParallele && (
                      <p className="muted">
                        <b>En parallèle :</b> {e.enParallele}
                      </p>
                    )}
                    {lienRecette(e.recette)}
                  </div>
                )}
              </article>
            );
          })}
        </>
      )}

      {vue === 'semaine' && (
        <>
          <p className="muted">Quelques minutes le soir pour alléger les jours suivants.</p>
          {menu.microBatch.length === 0 && <p className="muted">Rien à anticiper cette semaine.</p>}
          {[...menu.microBatch]
            .sort((a, b) => JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour))
            .map((m) => {
              const id = idCocheMicro(lettre, m.id);
              return (
                <article key={m.id} className={coches[id] ? 'carte-repas fait' : 'carte-repas'}>
                  <div className="carte-repas-tete">
                    <div className="carte-repas-corps">
                      <span className="carte-repas-moment">
                        {capitalize(m.jour)} · {m.dureeMin} min{m.quantite && ` · ${m.quantite}`}
                      </span>
                      <span className="carte-repas-titre">{m.quoi}</span>
                      {m.detail && <span className="carte-repas-meta">{m.detail}</span>}
                    </div>
                    <button
                      type="button"
                      className="coche"
                      aria-pressed={!!coches[id]}
                      aria-label={`${m.quoi} : ${coches[id] ? 'fait, annuler' : 'marquer comme fait'}`}
                      onClick={() => basculer(id)}
                    >
                      <Icon name="check" size={20} />
                    </button>
                  </div>
                  {lienRecette(m.recette)}
                </article>
              );
            })}
        </>
      )}

      {vue === 'reserve' && (
        <>
          <p className="muted">Les plats d'avance et le jour où ils servent. Touche pour marquer « mangé ».</p>
          {menu.reserve.length === 0 && <p className="muted">Pas de réserve cette semaine.</p>}
          {menu.reserve.map((r) => {
            const id = idCocheReserve(lettre, r.plat);
            const pour = (JOURS as readonly string[]).includes(r.pour)
              ? capitalize(r.pour as Jour)
              : prenomMembre(foyer.membres, r.pour);
            return (
              <button
                key={id}
                type="button"
                className="ligne-reserve"
                aria-pressed={!!coches[id]}
                onClick={() => basculer(id)}
              >
                <span className="pastille">{pour}</span>
                <span className="ligne-nom">
                  <b>{r.plat}</b>
                  <span className="muted">{r.conservation}</span>
                </span>
                <span className="ligne-qte">{coches[id] ? 'Mangé' : 'Au frigo'}</span>
              </button>
            );
          })}
        </>
      )}
    </>
  );
}
