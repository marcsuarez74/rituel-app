import { useState } from 'react';
import { ajouterJours, positionCycle, prochainCycle, prochainJour } from '../../lib/cycle/calendrier';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { saveCycle, saveFoyer } from '../../lib/cycle/etat';
import { ajouterPause, changerDebut, generationOuverte, relancer } from '../../lib/cycle/monCycle';
import { LETTRES } from '../../lib/cycle/types';
import { formatJourMoisCourt, periodeCourte } from '../../lib/dates';
import { Icon } from '../Icon';
import { ChampDebut } from './ChampDebut';

type Vue = 'etat' | 'pret';

// Écran « Mes menus » (spec refonte §4.6/§7) : où en sont les menus (position,
// pause, date de début) et la relance. La GÉNÉRATION vit dans l'assistant
// (ProchainsMenus) : ce fichier n'a plus ni prompt, ni import, ni aperçu.
export function MonCycle({
  stocke,
  foyer,
  aujourdhui,
  onRetour,
  onCycle,
  onFoyer,
  onVoirCourses,
  onOuvrirAssistant,
}: {
  stocke: CycleActif | null;
  foyer: ReglagesFoyer;
  aujourdhui: string;
  onRetour: () => void;
  onCycle: (c: CycleActif) => void;
  onFoyer: (f: ReglagesFoyer) => void;
  onVoirCourses: () => void;
  onOuvrirAssistant: () => void;
}) {
  const [vue, setVue] = useState<Vue>('etat');
  const [nouveauDebut, setNouveauDebut] = useState<string | null>(null); // édition en cours
  const ouverte = generationOuverte(stocke, aujourdhui);
  const position = stocke ? positionCycle(stocke, aujourdhui) : null;

  const enregistrer = (c: CycleActif) => {
    saveCycle(c);
    onCycle(c);
  };
  // Menus + jour des courses du foyer alignés sur la date de début.
  const enregistrerAvecDebut = (c: CycleActif, d: string) => {
    const { actif, foyer: f } = changerDebut(c, foyer, d);
    enregistrer(actif);
    if (f !== foyer) {
      saveFoyer(f);
      onFoyer(f);
    }
  };

  return (
    <div className="mon-cycle">
      <button type="button" className="profil-back" onClick={onRetour}>
        <Icon name="chev-left" size={16} /> Moi
      </button>
      <h1>Mes menus</h1>

      {vue === 'etat' && (
        <>
          {!stocke && (
            <section className="profile-section">
              <h2>Menus d'exemple</h2>
              <p>Tu utilises les menus d'exemple. Prépare les tiens avec une IA, à partir de vos profils et de votre semaine type.</p>
              <button type="button" className="bouton-plein" onClick={onOuvrirAssistant}>
                Créer mes premiers menus
              </button>
            </section>
          )}
          {stocke && position && position.etat !== 'termine' && (
            <>
              <section className="profile-section">
                <p className="anticipe-titre">
                  Menus n° {stocke.numero} · {periodeCourte(stocke.debut, ajouterJours(prochainCycle(stocke), -1))}
                </p>
                {nouveauDebut === null ? (
                  <button type="button" className="lien" onClick={() => setNouveauDebut(stocke.debut)}>
                    Changer la date de début
                  </button>
                ) : (
                  <div className="ticket">
                    <ChampDebut valeur={nouveauDebut} jourCourses={foyer.jourCourses} onChange={setNouveauDebut} />
                    <button type="button" className="bouton-contour" onClick={() => setNouveauDebut(null)}>
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="bouton-plein"
                      disabled={!nouveauDebut}
                      onClick={() => {
                        enregistrerAvecDebut(stocke, nouveauDebut);
                        setNouveauDebut(null);
                      }}
                    >
                      Enregistrer
                    </button>
                  </div>
                )}
                <h2>
                  {position.etat === 'semaine'
                    ? `Semaine ${position.index + 1} sur 4`
                    : position.etat === 'pause'
                      ? 'Semaine de pause'
                      : `Démarre le ${formatJourMoisCourt(position.debut)}`}
                </h2>
                <div className="semaines-cycle">
                  {LETTRES.map((l, i) => {
                    const etat =
                      position.etat === 'avant'
                        ? 'à venir'
                        : position.etat === 'semaine'
                          ? i < position.index
                            ? 'faite'
                            : i === position.index
                              ? 'en cours'
                              : 'à venir'
                          : i <= position.apres
                            ? 'faite'
                            : 'à venir';
                    return (
                      <p key={l} className={`semaine-cycle ${etat === 'en cours' ? 'courant' : etat === 'faite' ? 'fait' : ''}`}>
                        <b>{l}</b>
                        {etat}
                      </p>
                    );
                  })}
                </div>
              </section>
              <section className="lie-rituel">
                <p className="anticipe-titre">
                  <Icon name="lock" size={16} /> Prochains menus le {formatJourMoisCourt(prochainCycle(stocke))}
                </p>
                <p>La routine d'abord : de nouveaux menus se débloquent quand les 4 semaines sont passées.</p>
              </section>
              {position.etat === 'semaine' && position.index < 3 && (
                <section className="profile-section">
                  <h2>Une semaine qui saute ?</h2>
                  <p>
                    Vacances, déplacement : on met les menus en pause une semaine après celle-ci. Le menu{' '}
                    {LETTRES[position.index + 1]} reprend ensuite.
                  </p>
                  {stocke.pauses.includes(position.index) ? (
                    <p className="muted">Pause prévue après cette semaine.</p>
                  ) : (
                    <button
                      type="button"
                      className="bouton-contour"
                      onClick={() => enregistrer(ajouterPause(stocke, position.index))}
                    >
                      Faire une pause après cette semaine
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          {stocke && ouverte && (
            <>
              <section className="profile-section">
                <p className="anticipe-titre">Menus n° {stocke.numero} terminés</p>
                <h2>4 semaines bouclées, bravo.</h2>
              </section>
              <section className="action-du-jour">
                <p className="anticipe-titre">Recommandé</p>
                <h2>Relancer les mêmes menus</h2>
                <p>Les 4 mêmes menus A → D, à partir du {formatJourMoisCourt(prochainJour(aujourdhui, foyer.jourCourses))}.</p>
                <button
                  type="button"
                  className="bouton-plein"
                  onClick={() => {
                    enregistrer(relancer(stocke, aujourdhui, foyer.jourCourses, crypto.randomUUID(), foyer.semaine));
                    setVue('pret');
                  }}
                >
                  Relancer les menus
                </button>
              </section>
              <section className="profile-section">
                <h2>Nouveaux menus avec une IA</h2>
                <p>4 nouveaux menus selon vos profils, environ 5 minutes avec ton abonnement.</p>
                <button type="button" className="bouton-contour" onClick={onOuvrirAssistant}>
                  Préparer de nouveaux menus
                </button>
              </section>
            </>
          )}
        </>
      )}

      {vue === 'pret' && stocke && (
        <section className="action-du-jour">
          <h2>Menus n° {stocke.numero} prêts</h2>
          <p>Il démarre le {formatJourMoisCourt(stocke.debut)} avec le menu A.</p>
          <button type="button" className="bouton-plein" onClick={onVoirCourses}>
            Voir la liste de courses
          </button>
        </section>
      )}
    </div>
  );
}
