import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { estimerSemaine } from '../../lib/cycle/budget';
import { ajouterJours, jourDe, positionCycle, prochainCycle, prochainJour } from '../../lib/cycle/calendrier';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { loadPrecedent, saveCycle, saveFoyer, savePrecedent } from '../../lib/cycle/etat';
import { ajouterPause, changerDebut, demarrer, generationOuverte, messagePourClaude, relancer } from '../../lib/cycle/monCycle';
import { type Jour, LETTRES } from '../../lib/cycle/types';
import { importerCycle, type ResultatImport } from '../../lib/cycle/valider';
import { formatJourMoisCourt, periodeCourte } from '../../lib/dates';
import type { UserProfile } from '../../lib/model';
import { assemblePromptIa } from '../../lib/promptIa';
import { getWeights, loadProfilsFoyer } from '../../lib/storage';
import { Icon } from '../Icon';

type Vue = 'etat' | 'generer' | 'apercu' | 'pret';

// Début du cycle : passé autorisé (« courses faites samedi dernier ») ; le
// jour des courses du foyer suit la date choisie (changerDebut).
function ChampDebut({ valeur, jourCourses, onChange }: { valeur: string; jourCourses: Jour; onChange: (v: string) => void }) {
  return (
    <label className="debut-cycle">
      Début du cycle (jour des courses de la semaine 1)
      <input type="date" value={valeur} onChange={(e) => onChange(e.target.value)} />
      {valeur && jourDe(valeur) !== jourCourses && (
        <span className="muted">Le jour des courses passe au {jourDe(valeur)}.</span>
      )}
    </label>
  );
}

const copier = async (texte: string) => {
  try {
    await navigator.clipboard.writeText(texte);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texte;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
};

// Écran Mon cycle (spec v2 §6-7, écran 8) : où en est le cycle, verrou tant
// que les 4 semaines ne sont pas passées, pause d'une semaine, relance ;
// génération en 3 étapes (prompt → Claude → import) avec aperçu et alertes.
export function MonCycle({
  stocke,
  foyer,
  profil,
  aujourdhui,
  onRetour,
  onCycle,
  onFoyer,
  onVoirCourses,
}: {
  stocke: CycleActif | null;
  foyer: ReglagesFoyer;
  profil: UserProfile;
  aujourdhui: string;
  onRetour: () => void;
  onCycle: (c: CycleActif) => void;
  onFoyer: (f: ReglagesFoyer) => void;
  onVoirCourses: () => void;
}) {
  const [vue, setVue] = useState<Vue>('etat');
  const [copie, setCopie] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [debut, setDebut] = useState(() => prochainJour(aujourdhui, foyer.jourCourses));
  const ouverte = generationOuverte(stocke, aujourdhui);
  const position = stocke ? positionCycle(stocke, aujourdhui) : null;

  const [nouveauDebut, setNouveauDebut] = useState<string | null>(null); // édition en cours

  const enregistrer = (c: CycleActif) => {
    saveCycle(c);
    onCycle(c);
  };
  // Cycle + jour des courses du foyer alignés sur la date de début.
  const enregistrerAvecDebut = (c: CycleActif, d: string) => {
    const { actif, foyer: f } = changerDebut(c, foyer, d);
    enregistrer(actif);
    if (f !== foyer) {
      saveFoyer(f);
      onFoyer(f);
    }
  };
  const copierEt = async (texte: string, quoi: string) => {
    await copier(texte);
    setCopie(quoi);
  };
  const importer = async (e: ChangeEvent<HTMLInputElement>) => {
    const fichiers = await Promise.all(
      [...(e.target.files ?? [])].map(async (f) => ({ nom: f.name, contenu: await f.text() })),
    );
    e.target.value = '';
    if (fichiers.length === 0) return;
    setResultat(
      importerCycle(fichiers, {
        membres: foyer.membres.map((m) => ({ id: m.id, suivi: m.suivi, ...(m.regime ? { regime: m.regime } : {}) })),
        budgetMax: foyer.budgetMax,
        recettesPrecedentes: loadPrecedent(),
      }),
    );
    setCopie(null);
    setVue('apercu');
  };
  const lancer = () => {
    if (!resultat?.cycle) return;
    if (stocke) savePrecedent(stocke.cycle.recettes.map((r) => r.id));
    enregistrerAvecDebut(demarrer(resultat.cycle, stocke, debut, crypto.randomUUID()), debut);
    setVue('pret');
  };

  const estimes = resultat?.cycle ? LETTRES.map((l) => estimerSemaine(resultat.cycle!, l).total) : [];
  const plusCher = Math.max(0, ...estimes);
  const retour = vue === 'etat' ? onRetour : () => setVue('etat');

  return (
    <div className="mon-cycle">
      <button type="button" className="profil-back" onClick={retour}>
        <Icon name="chev-left" size={16} /> {vue === 'etat' ? 'Profil' : 'Mon cycle'}
      </button>
      <h1>Mon cycle</h1>

      {vue === 'etat' && (
        <>
          {!stocke && (
            <section className="profile-section">
              <h2>Cycle d'exemple</h2>
              <p>Tu utilises le cycle d'exemple. Crée le tien avec Claude, à partir de vos profils et de votre semaine type.</p>
              <button type="button" className="bouton-plein" onClick={() => setVue('generer')}>
                Créer mon premier cycle
              </button>
            </section>
          )}
          {stocke && position && position.etat !== 'termine' && (
            <>
              <section className="profile-section">
                <p className="anticipe-titre">
                  Cycle {stocke.numero} · {periodeCourte(stocke.debut, ajouterJours(prochainCycle(stocke), -1))}
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
                  <Icon name="lock" size={16} /> Prochain cycle le {formatJourMoisCourt(prochainCycle(stocke))}
                </p>
                <p>La routine d'abord : un nouveau cycle se débloque quand les 4 semaines sont passées.</p>
              </section>
              {position.etat === 'semaine' && position.index < 3 && (
                <section className="profile-section">
                  <h2>Une semaine qui saute ?</h2>
                  <p>
                    Vacances, déplacement : on met le cycle en pause une semaine après celle-ci. Le menu{' '}
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
                <p className="anticipe-titre">Cycle {stocke.numero} terminé</p>
                <h2>4 semaines bouclées, bravo.</h2>
              </section>
              <section className="action-du-jour">
                <p className="anticipe-titre">Recommandé</p>
                <h2>Relancer le même cycle</h2>
                <p>Les 4 mêmes menus A → D, à partir du {formatJourMoisCourt(prochainJour(aujourdhui, foyer.jourCourses))}.</p>
                <button
                  type="button"
                  className="bouton-plein"
                  onClick={() => {
                    enregistrer(relancer(stocke, aujourdhui, foyer.jourCourses, crypto.randomUUID()));
                    setVue('pret');
                  }}
                >
                  Relancer le cycle
                </button>
              </section>
              <section className="profile-section">
                <h2>Nouveau cycle avec Claude</h2>
                <p>4 nouveaux menus selon vos profils, environ 5 minutes avec ton abonnement Claude.</p>
                <button type="button" className="bouton-contour" onClick={() => setVue('generer')}>
                  Créer un nouveau cycle
                </button>
              </section>
            </>
          )}
        </>
      )}

      {vue === 'generer' && (
        <>
          <p className="muted">3 étapes, une fois par cycle.</p>
          <section className="profile-section">
            <h2>1 · Copie le prompt</h2>
            <p>Il contient votre foyer, votre semaine type, le budget et les règles du cycle.</p>
            <button
              type="button"
              className="bouton-plein"
              onClick={() =>
                void copierEt(
                  assemblePromptIa({
                    foyer,
                    profil,
                    dernierPoids: getWeights(profil.id).at(-1) ?? null,
                    // Les autres membres suivis : leur profil et leur pesée, reçus par la sync.
                    autres: Object.values(loadProfilsFoyer()).map((p) => ({
                      profil: p,
                      dernierPoids: getWeights(p.id).at(-1) ?? null,
                    })),
                    precedentes: loadPrecedent(),
                  }),
                  'prompt',
                )
              }
            >
              <Icon name="copy" size={18} /> {copie === 'prompt' ? 'Prompt copié' : 'Copier le prompt'}
            </button>
          </section>
          <section className="profile-section">
            <h2>2 · Colle-le dans Claude</h2>
            <p>Nouvelle conversation, colle, envoie. Claude prépare 4 fichiers (menu-A.json … menu-D.json) : télécharge-les.</p>
            <a className="bouton-contour" href="https://claude.ai/new" target="_blank" rel="noreferrer">
              Ouvrir Claude
            </a>
          </section>
          <section className="profile-section">
            <h2>3 · Importe les fichiers</h2>
            <label className="bouton-plein import-fichiers">
              Choisir les fichiers .json
              <input type="file" multiple accept="application/json,.json" className="sr-only" onChange={(e) => void importer(e)} />
            </label>
          </section>
        </>
      )}

      {vue === 'apercu' && resultat && (
        <>
          {resultat.erreurs.length > 0 && (
            <section className="profile-section erreurs" aria-label="Erreurs">
              <h2>À corriger avant de démarrer</h2>
              <ul>
                {resultat.erreurs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>
          )}
          {resultat.alertes.length > 0 && (
            <section className="profile-section variante" aria-label="Alertes">
              <h2>À savoir</h2>
              <ul>
                {resultat.alertes.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              {foyer.budgetMax != null && plusCher > foyer.budgetMax && (
                <button
                  type="button"
                  className="bouton-contour"
                  onClick={() => {
                    const f = { ...foyer, budgetMax: Math.ceil(plusCher) };
                    saveFoyer(f);
                    onFoyer(f);
                  }}
                >
                  Ajuster mon budget à {Math.ceil(plusCher)} €
                </button>
              )}
            </section>
          )}
          {(resultat.erreurs.length > 0 || resultat.alertes.length > 0) && (
            <button
              type="button"
              className="bouton-contour"
              onClick={() => void copierEt(messagePourClaude(resultat.erreurs, resultat.alertes), 'erreurs')}
            >
              <Icon name="copy" size={18} /> {copie === 'erreurs' ? 'Copié — colle-le à Claude' : 'Copier pour Claude'}
            </button>
          )}
          {resultat.cycle && (
            <>
              <h2>Aperçu des 4 semaines</h2>
              {resultat.cycle.menus.map((m, i) => (
                <p key={m.lettre} className="ligne-reserve">
                  <span className="pastille">{m.lettre}</span>
                  <span className="ligne-nom">
                    <b>{m.titre}</b>
                    <span className="muted">≈ {Math.round(estimes[i])} € de courses</span>
                  </span>
                </p>
              ))}
              <ChampDebut valeur={debut} jourCourses={foyer.jourCourses} onChange={setDebut} />
              <button type="button" className="bouton-plein" disabled={!ouverte || !debut} onClick={lancer}>
                Démarrer le cycle
              </button>
            </>
          )}
          <button type="button" className="lien" onClick={() => setVue('generer')}>
            Importer d'autres fichiers
          </button>
        </>
      )}

      {vue === 'pret' && stocke && (
        <section className="action-du-jour">
          <h2>Cycle {stocke.numero} prêt</h2>
          <p>Il démarre le {formatJourMoisCourt(stocke.debut)} avec le menu A.</p>
          <button type="button" className="bouton-plein" onClick={onVoirCourses}>
            Voir la liste de courses
          </button>
        </section>
      )}
    </div>
  );
}
