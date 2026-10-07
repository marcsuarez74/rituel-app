import { useEffect, useState } from 'react';
import type { CycleActif } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { trouverRecette } from '../../lib/cycle/menu';
import { idCocheRituel, sousEtapes } from '../../lib/cycle/rituel';
import { LETTRES } from '../../lib/cycle/types';
import { Icon } from '../Icon';
import { Minuteur } from '../Minuteur';
import { useCoches } from '../useCoches';

// Mode guidé du rituel (spec v2 §3, écran 6) : plein écran, écran maintenu
// allumé (Wake Lock si dispo, sinon rien), une étape par écran avec ses
// sous-étapes cochables, minuteur, « en parallèle », fiche liée ; « Suivant »
// coche l'étape. `etape` = index courant, gardé par App (retour de fiche).
export function Guide({
  actif,
  semaine,
  etape,
  syncVersion,
  onEtape,
  onQuitter,
  onReserve,
  onOuvrirRecette,
}: {
  actif: CycleActif;
  semaine: number;
  etape: number;
  syncVersion: number;
  onEtape: (n: number) => void;
  onQuitter: () => void;
  onReserve: () => void;
  onOuvrirRecette: (recetteId: string) => void;
}) {
  const lettre = LETTRES[semaine];
  const { rituel } = actif.cycle;
  const rappels = actif.cycle.menus.find((m) => m.lettre === lettre)?.rappelsRituel ?? [];
  const { coches, basculer } = useCoches(semaineCoches(actif.id, semaine), syncVersion);
  const [faites, setFaites] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let verrou: WakeLockSentinel | null = null;
    let actifEffet = true;
    navigator.wakeLock
      ?.request('screen')
      .then((v) => {
        if (actifEffet) verrou = v;
        else void v.release();
      })
      .catch(() => {});
    return () => {
      actifEffet = false;
      void verrou?.release();
    };
  }, []);

  const fini = etape >= rituel.etapes.length;
  const e = rituel.etapes[Math.min(etape, rituel.etapes.length - 1)];
  const suivant = () => {
    const id = idCocheRituel(lettre, e.id);
    if (!coches[id]) basculer(id);
    onEtape(etape + 1);
  };
  const recette = trouverRecette(actif.cycle, e?.recette);

  return (
    <div className="guide">
      <header className="guide-tete">
        <div>
          <p className="anticipe-titre">Rituel · l'écran reste allumé</p>
          <p className="muted">{fini ? 'Terminé' : `Étape ${etape + 1} sur ${rituel.etapes.length}`}</p>
        </div>
        <button type="button" className="avatar quitter" aria-label="Quitter le mode guidé" onClick={onQuitter}>
          <Icon name="croix" size={20} />
        </button>
      </header>
      <div className="guide-progres" aria-hidden="true">
        {rituel.etapes.map((x, i) => (
          <span key={x.id} className={i < etape ? 'fait' : i === etape ? 'courant' : undefined} />
        ))}
      </div>

      {fini ? (
        <main className="guide-fin">
          <h1>Rituel terminé !</h1>
          <p>{rituel.termine}</p>
          <button type="button" className="bouton-plein" onClick={onReserve}>
            Voir la réserve
          </button>
        </main>
      ) : (
        <>
          <main>
            {etape === 0 && rappels.length > 0 && (
              <section className="variante" aria-label="Cette semaine aussi">
                <b>Cette semaine aussi</b>
                <ul>
                  {rappels.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            )}
            <p className="carte-repas-moment">{e.creneau}</p>
            <h1>{e.label}</h1>
            <p>{e.detail}</p>
            {e.enParallele && (
              <p className="anticipe">
                <b>En parallèle :</b> {e.enParallele}
              </p>
            )}
            {sousEtapes(actif.cycle, e).length > 0 && (
              <section aria-label="Sous-étapes">
                {sousEtapes(actif.cycle, e).map((s, i) => {
                  const cle = `${e.id}:${i}`;
                  return (
                    <button
                      key={cle}
                      type="button"
                      className="ligne-cochable"
                      aria-pressed={!!faites[cle]}
                      onClick={() => setFaites({ ...faites, [cle]: !faites[cle] })}
                    >
                      <span className="case" aria-hidden="true">
                        <Icon name="check" size={16} />
                      </span>
                      <span className="ligne-nom">{s}</span>
                    </button>
                  );
                })}
              </section>
            )}
            {e.minuteurMin != null && <Minuteur key={e.id} minutes={e.minuteurMin} />}
            {recette && (
              <button type="button" className="lien" onClick={() => onOuvrirRecette(recette.id)}>
                Fiche : {recette.nom} ›
              </button>
            )}
          </main>
          <div className="pied-recette">
            <button type="button" className="bouton-contour" disabled={etape === 0} onClick={() => onEtape(etape - 1)}>
              Précédent
            </button>
            <button type="button" className="bouton-plein" onClick={suivant}>
              {etape === rituel.etapes.length - 1 ? 'Terminer' : 'Suivant'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
