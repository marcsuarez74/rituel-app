import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { estimerSemaine } from '../../lib/cycle/budget';
import { prochainJour } from '../../lib/cycle/calendrier';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { loadPrecedent, saveCycle, saveFoyer, savePrecedent } from '../../lib/cycle/etat';
import { changerDebut, demarrer, messagePourClaude } from '../../lib/cycle/monCycle';
import { LETTRES } from '../../lib/cycle/types';
import { importerCycle, type ResultatImport } from '../../lib/cycle/valider';
import { formatJourMoisCourt } from '../../lib/dates';
import type { UserProfile } from '../../lib/model';
import { assemblePromptIa } from '../../lib/promptIa';
import { copier } from '../../lib/copier';
import { getWeights, loadProfilsFoyer } from '../../lib/storage';
import { Icon } from '../Icon';
import { Legumes } from '../illustrations/Illustrations';
import { ChampDebut } from './ChampDebut';

// Assistant « Prépare tes prochains menus » (spec refonte §7, maquette
// ecranWiz) : 3 étapes à une action pleine — 1 · la semaine type (confirmée
// ou modifiée), 2 · la demande à copier dans une IA, 3 · la réponse importée
// et vérifiée. La logique d'import (importerCycle) est inchangée ; les textes
// ne disent jamais « cycle ».
export function ProchainsMenus({
  stocke,
  foyer,
  profil,
  aujourdhui,
  direct = false,
  onRetour,
  onCycle,
  onFoyer,
  onModifierSemaine,
  onVoirSemaine,
}: {
  stocke: CycleActif | null;
  foyer: ReglagesFoyer;
  profil: UserProfile;
  aujourdhui: string;
  /** Arrivée directe depuis l'onboarding : le retour est « Plus tard ». */
  direct?: boolean;
  onRetour: () => void;
  onCycle: (c: CycleActif) => void;
  onFoyer: (f: ReglagesFoyer) => void;
  onModifierSemaine: () => void;
  onVoirSemaine: () => void;
}) {
  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [copie, setCopie] = useState(false);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [debut, setDebut] = useState(() => prochainJour(aujourdhui, foyer.jourCourses));
  const [lance, setLance] = useState<CycleActif | null>(null);

  const enregistrer = (c: CycleActif) => {
    saveCycle(c);
    onCycle(c);
  };
  // Semaine du foyer alignée sur la date de début choisie (changerDebut).
  const enregistrerAvecDebut = (c: CycleActif, d: string) => {
    const { actif, foyer: f } = changerDebut(c, foyer, d);
    enregistrer(actif);
    if (f !== foyer) {
      saveFoyer(f);
      onFoyer(f);
    }
  };
  const copierDemande = async () => {
    await copier(demande);
    setCopie(true);
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
  };
  const lancer = () => {
    if (!resultat?.cycle) return;
    if (stocke) savePrecedent(stocke.cycle.recettes.map((r) => r.id));
    const c = demarrer(resultat.cycle, stocke, debut, crypto.randomUUID(), foyer.semaine);
    enregistrerAvecDebut(c, debut);
    setLance(c);
  };

  const estimes = resultat?.cycle ? LETTRES.map((l) => estimerSemaine(resultat.cycle!, l).total) : [];
  const plusCher = Math.max(0, ...estimes);
  // La demande à copier (étape 2) : même texte pour l'aperçu et le presse-papiers.
  const demande = assemblePromptIa({
    foyer,
    profil,
    dernierPoids: getWeights(profil.id).at(-1) ?? null,
    // Les autres membres suivis : leur profil et leur pesée, reçus par la sync.
    autres: Object.values(loadProfilsFoyer()).map((p) => ({
      profil: p,
      dernierPoids: getWeights(p.id).at(-1) ?? null,
    })),
    precedentes: loadPrecedent(),
  });

  // Résumé de la semaine type (étape 1) : un jour compte pour une valeur dès
  // qu'un membre la vit ; « maison » si personne n'est en box ni dehors.
  const jours = Object.values(foyer.semaine);
  const box = jours.filter((t) => Object.values(t.dejeuner).includes('box')).length;
  const dehors = jours.filter((t) => Object.values(t.dejeuner).includes('dehors')).length;
  const maison = jours.filter((t) => !Object.values(t.dejeuner).some((v) => v !== 'maison')).length;
  const diner = (v: string) => jours.filter((t) => t.diner === v).length;
  const chips = [
    box > 0 && `${box} midi${box > 1 ? 's' : ''} en box`,
    dehors > 0 && `${dehors} midi${dehors > 1 ? 's' : ''} dehors`,
    maison > 0 && `${maison} midi${maison > 1 ? 's' : ''} à la maison`,
    diner('famille') > 0 && `${diner('famille')} dîner${diner('famille') > 1 ? 's' : ''} maison`,
    diner('rapide') > 0 && `${diner('rapide')} dîner${diner('rapide') > 1 ? 's' : ''} rapide${diner('rapide') > 1 ? 's' : ''}`,
    diner('leger') > 0 && `${diner('leger')} dîner${diner('leger') > 1 ? 's' : ''} léger${diner('leger') > 1 ? 's' : ''}`,
  ].filter(Boolean) as string[];

  const titre = lance
    ? null
    : etape === 1
      ? 'Ta semaine type est-elle toujours la bonne ?'
      : etape === 2
        ? 'Demande tes menus à une IA'
        : "Ajoute la réponse de l'IA";

  return (
    <div className="prochains-menus">
      <button type="button" className="profil-back" onClick={onRetour}>
        <Icon name="chev-left" size={16} /> {direct ? 'Plus tard' : 'Retour'}
      </button>

      {lance ? (
        <section className="fete" aria-label="Menus prêts">
          <Legumes taille={140} />
          <h1>Tes menus sont prêts</h1>
          <p>
            Premières courses {formatJourMoisCourt(lance.debut)}, premier rituel{' '}
            {formatJourMoisCourt(prochainJour(lance.debut, foyer.jourRituel))}.
          </p>
          <button type="button" className="bouton-plein" onClick={onVoirSemaine}>
            Voir ma semaine
          </button>
        </section>
      ) : (
        <>
          <p className="etape-wiz" aria-current="step">
            Étape {etape} sur 3
            <span className="progres" aria-hidden="true">
              {[1, 2, 3].map((x) => (
                <span key={x} className={x < etape ? 'fait' : x === etape ? 'ici' : undefined} />
              ))}
            </span>
          </p>
          <h1 className="question">{titre}</h1>

          {etape === 1 && (
            <>
              <p>Elle décide des box, des courses et du rituel des 4 prochaines semaines.</p>
              <div className="resume-sem">
                {chips.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <button type="button" className="lien" onClick={onModifierSemaine}>
                La modifier
              </button>
              <button type="button" className="bouton-plein" onClick={() => setEtape(2)}>
                Oui, continuer
              </button>
            </>
          )}

          {etape === 2 && (
            <>
              <p>
                On a écrit pour toi un message qui décrit votre foyer : copie-le, colle-le dans ChatGPT, Claude ou Le
                Chat, et garde sa réponse.
              </p>
              <details className="message" aria-label="Aperçu de la demande" open>
                <summary>Voir la demande</summary>
                <pre>{demande}</pre>
              </details>
              {copie ? (
                <button type="button" className="bouton-plein" onClick={() => setEtape(3)}>
                  J'ai la réponse, continuer
                </button>
              ) : (
                <button type="button" className="bouton-plein" onClick={() => void copierDemande()}>
                  <Icon name="copy" size={18} /> Copier la demande
                </button>
              )}
              <a className="bouton-contour" href="https://claude.ai/new" target="_blank" rel="noreferrer">
                Ouvrir Claude
              </a>
            </>
          )}

          {etape === 3 && (
            <>
              <p>Choisis les fichiers .json que l'IA t'a donnés. Rituel vérifie tout pour toi.</p>
              {!resultat && (
                <label className="bouton-plein import-fichiers">
                  Choisir les fichiers .json
                  <input type="file" multiple accept="application/json,.json" className="sr-only" onChange={(e) => void importer(e)} />
                </label>
              )}
              {resultat && (
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
                  {resultat.cycle && (
                    <div className="fini-banniere" role="status">
                      <Icon name="check" size={24} />
                      <span>C'est bon : 4 semaines de menus.</span>
                    </div>
                  )}
                  {resultat.cycle && resultat.classees.actions.length === 0 && (
                    <section className="profile-section apercu-pret" aria-label="Résumé de l'import">
                      <p className="muted">
                        4 menus importés, courses estimées entre {Math.round(Math.min(...estimes))} et{' '}
                        {Math.round(Math.max(...estimes))} € par semaine.
                      </p>
                    </section>
                  )}
                  {resultat.classees.actions.length > 0 && (
                    <section className="profile-section variante" aria-label="Points à regarder">
                      <h2>Quelques points avant de démarrer</h2>
                      <ul>
                        {resultat.classees.actions.map((a) => (
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
                  {(resultat.classees.notes.length > 0 || resultat.classees.nbCorriges > 0) && (
                    <details className="notes-ia">
                      <summary>
                        {resultat.classees.notes.length > 0
                          ? `Notes de ton IA (${resultat.classees.notes.length})`
                          : "Détails de l'import"}
                      </summary>
                      {resultat.classees.notes.length > 0 && (
                        <ul>
                          {resultat.classees.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      )}
                      {resultat.classees.nbCorriges > 0 && (
                        <p className="muted">
                          {resultat.classees.nbCorriges} ingrédient{resultat.classees.nbCorriges > 1 ? 's' : ''} rangé
                          {resultat.classees.nbCorriges > 1 ? 's' : ''} automatiquement dans le bon rayon ou la bonne
                          unité.
                        </p>
                      )}
                    </details>
                  )}
                  {(resultat.erreurs.length > 0 || resultat.classees.actions.length > 0) && (
                    <button
                      type="button"
                      className="bouton-contour"
                      onClick={() => void copier(messagePourClaude(resultat.erreurs, resultat.classees.actions))}
                    >
                      <Icon name="copy" size={18} /> Copier pour Claude
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
                      <button type="button" className="bouton-plein" disabled={!debut} onClick={lancer}>
                        Lancer mes menus
                      </button>
                    </>
                  )}
                  <button type="button" className="lien" onClick={() => setResultat(null)}>
                    Importer d'autres fichiers
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
