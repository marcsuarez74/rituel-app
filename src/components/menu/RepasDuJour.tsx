import { useEffect, useState } from 'react';
import { ajouterJours, dateDuJour, debutSemaine, ordreJours } from '../../lib/cycle/calendrier';
import type { CycleActif, Report, ReglagesFoyer } from '../../lib/cycle/etat';
import { titreRepas, trouverRecette } from '../../lib/cycle/menu';
import { aPlacer, avecReport, fraicheur, repasAvecReports, type RepasAffiche } from '../../lib/cycle/reports';
import type { Jour, MembreId } from '../../lib/cycle/types';
import { LETTRES } from '../../lib/cycle/types';
import { CarteRepas } from './CarteRepas';

interface Option {
  label: string;
  detail?: string;
  vers: Report['vers'];
}

// Repas d'un jour avec le report (spec v2 §8, écran 9) : « Pas ce soir :
// reporter » ouvre une feuille (demain · semaine prochaine · on ne le fera
// pas), un toast permet d'annuler 5 s ; l'encadré « reporté de la semaine
// dernière » pose un plat en attente sur le jour affiché.
export function RepasDuJour({
  actif,
  foyer,
  semaine,
  jour,
  moi,
  coches,
  reports,
  onReports,
  onBasculer,
  onOuvrir,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  semaine: number;
  jour: Jour;
  moi: MembreId;
  coches: Record<string, boolean>;
  reports: Report[];
  onReports: (r: Report[]) => void;
  onBasculer: (id: string) => void;
  onOuvrir: (recetteId: string, coche: string) => void;
}) {
  const [feuille, setFeuille] = useState<RepasAffiche | null>(null);
  const [toast, setToast] = useState<{ texte: string; avant: Report[] } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const { cycle } = actif;
  const jours = ordreJours(foyer.jourCourses);
  const repas = repasAvecReports(cycle, semaine, jour, moi, reports);
  const enAttente = aPlacer(cycle, semaine, moi, reports);

  const reporter = (x: RepasAffiche, vers: Report['vers'], texte: string) => {
    onReports(avecReport(reports, { repas: x.id, vers, cree: new Date().toISOString() }));
    setToast({ texte, avant: reports });
    setFeuille(null);
  };

  const options = (x: RepasAffiche): Option[] => {
    const recette = trouverRecette(cycle, x.repas.recette);
    const achat = debutSemaine(actif, LETTRES.indexOf(x.id.split(':')[1] as (typeof LETTRES)[number]));
    const alerte = (cible: string) => (recette ? fraicheur(recette, achat, cible).join(' · ') || undefined : undefined);
    const i = jours.indexOf(jour);
    const o: Option[] = [];
    if (i < 6) {
      const demain = jours[i + 1];
      o.push({ label: `Demain, ${demain}`, detail: alerte(dateDuJour(actif, semaine, demain, foyer.jourCourses)), vers: { semaine, jour: demain } });
    } else if (semaine < 3) {
      o.push({ label: `Demain, ${jours[0]}`, detail: alerte(debutSemaine(actif, semaine + 1)), vers: { semaine: semaine + 1, jour: jours[0] } });
    }
    if (semaine < 3)
      o.push({ label: 'Semaine prochaine', detail: alerte(ajouterJours(debutSemaine(actif, semaine + 1), 1)), vers: { semaine: semaine + 1 } });
    o.push({ label: 'On ne le fera pas', vers: 'abandon' });
    return o;
  };

  return (
    <>
      {enAttente.length > 0 && (
        <section className="action-du-jour" aria-label="Reporté de la semaine dernière">
          <p className="anticipe-titre">Reporté de la semaine dernière</p>
          {enAttente.map((x) => (
            <div key={x.id} className="a-placer">
              <p>
                <b>{titreRepas(cycle, x.repas)}</b>
              </p>
              <div className="budget-actions">
                <button type="button" className="bouton-plein" onClick={() => reporter(x, { semaine, jour }, `Prévu ${jour}`)}>
                  Le {jour}
                </button>
                <button type="button" className="bouton-contour" onClick={() => reporter(x, 'abandon', 'Retiré du menu')}>
                  On ne le fera pas
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {repas.map((x) => (
        <CarteRepas
          key={x.id}
          cycle={cycle}
          repas={x.repas}
          membres={foyer.membres}
          moi={moi}
          fait={!!coches[x.id]}
          origine={x.origine}
          onBasculer={() => onBasculer(x.id)}
          onOuvrir={(recetteId) => onOuvrir(recetteId, x.id)}
          onReporter={() => setFeuille(x)}
        />
      ))}

      {feuille && (
        <div className="voile" onClick={() => setFeuille(null)}>
          <section
            className="feuille"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-feuille"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="titre-feuille">Reporter « {titreRepas(cycle, feuille.repas)} »</h2>
            {options(feuille).map((o) => (
              <button
                key={o.label}
                type="button"
                className="option-report"
                onClick={() =>
                  reporter(feuille, o.vers, o.vers === 'abandon' ? 'Retiré du menu' : `Reporté : ${o.label.toLowerCase()}`)
                }
              >
                <b>{o.label}</b>
                {o.detail && <span>{o.detail}</span>}
              </button>
            ))}
            <button type="button" className="lien" onClick={() => setFeuille(null)}>
              Fermer
            </button>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast.texte}
          <button
            type="button"
            onClick={() => {
              onReports(toast.avant);
              setToast(null);
            }}
          >
            Annuler
          </button>
        </div>
      )}
    </>
  );
}
