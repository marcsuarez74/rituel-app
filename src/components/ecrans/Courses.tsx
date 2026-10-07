import { useState } from 'react';
import type { FormEvent } from 'react';
import { estimerSemaine, payeEntre } from '../../lib/cycle/budget';
import { ajouterJours, debutSemaine } from '../../lib/cycle/calendrier';
import { LIBELLES_RAYON, cleIngredient, formatQuantite, listeCourses, type LigneCourse } from '../../lib/cycle/courses';
import { ingredientsAuFrigo } from '../../lib/cycle/reports';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { LETTRES, RAYONS } from '../../lib/cycle/types';
import { formatEuro, parseEuro } from '../../lib/prix';
import { getDepenses, saveDepense } from '../../lib/storage';
import { Icon } from '../Icon';
import { useCoches } from '../useCoches';
import { useReports } from '../useReports';

const environ = (n: number) => `≈ ${Math.round(n)} €`;

// Onglet Courses (spec v2 §9) : liste CALCULÉE depuis les recettes de la
// semaine + fixes, carte Estimé / Payé / Max (alerte au-dessus du plafond),
// mode magasin (masque le coché), saisie du ticket, placard à vérifier.
export function Courses({
  actif,
  foyer,
  semaine,
  aujourdhui,
  syncVersion,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  semaine: number;
  aujourdhui: string;
  syncVersion: number;
}) {
  const lettre = LETTRES[semaine];
  const { lignes, placard } = listeCourses(actif.cycle, lettre, semaine);
  const estime = estimerSemaine(actif.cycle, lettre);
  const { coches, basculer } = useCoches(semaineCoches(actif.id, semaine), syncVersion);
  const { reports } = useReports(actif.id, syncVersion);
  const auFrigo = ingredientsAuFrigo(actif.cycle, semaine, reports);
  const [magasin, setMagasin] = useState(false);
  const [saisie, setSaisie] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [depenses, setDepenses] = useState(getDepenses);
  const [syncDepenses, setSyncDepenses] = useState(syncVersion);
  if (syncDepenses !== syncVersion) {
    setSyncDepenses(syncVersion);
    setDepenses(getDepenses());
  }

  const du = debutSemaine(actif, semaine);
  const paye = payeEntre(depenses, du, ajouterJours(du, 6));
  const max = foyer.budgetMax;
  const depasse = (n: number) => max != null && n > max;
  const faits = lignes.filter((l) => coches[l.id]).length;
  const visibles = (r: (typeof RAYONS)[number]): LigneCourse[] =>
    lignes.filter((l) => l.rayon === r && !(magasin && coches[l.id]));

  const payer = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const total = parseEuro(saisie ?? '');
    if (total == null) {
      setErreur('Montant invalide.');
      return;
    }
    setDepenses(saveDepense(aujourdhui, foyer.magasin || 'Courses', total));
    setSaisie(null);
    setErreur(null);
  };

  return (
    <>
      <section className="profile-section budget-v2" aria-label="Budget et progression">
        <div className="budget-chiffres">
          <div className={depasse(estime.total) ? 'alerte' : undefined}>
            <span>Estimé</span>
            <b>{environ(estime.total)}</b>
          </div>
          <div className={depasse(paye) ? 'alerte' : undefined}>
            <span>Payé</span>
            <b>{paye > 0 ? formatEuro(paye) : '—'}</b>
          </div>
          <div>
            <span>Max</span>
            <b>{max != null ? `${max} €` : '—'}</b>
          </div>
        </div>
        <p className="muted">
          Dont extras keto {environ(estime.keto)} · éléments fixes {environ(estime.fixes)}
        </p>
        {max != null && depasse(Math.max(estime.total, paye)) && (
          <p className="budget-alerte" role="status">
            {environ(Math.max(estime.total, paye) - max)} au-dessus de ton plafond.
          </p>
        )}
        <p className="chariot">
          Dans le chariot <b>{faits} / {lignes.length}</b>
        </p>
        <progress max={lignes.length || 1} value={faits} aria-label={`Dans le chariot : ${faits} sur ${lignes.length}`} />
        <div className="budget-actions">
          <button type="button" className="bouton-contour" aria-pressed={magasin} onClick={() => setMagasin(!magasin)}>
            <Icon name="cart" size={18} /> {magasin ? 'Tout revoir' : 'Mode magasin'}
          </button>
          <button type="button" className="bouton-plein" onClick={() => setSaisie(saisie == null ? '' : null)}>
            J'ai payé…
          </button>
        </div>
        {saisie != null && (
          <form className="ticket" onSubmit={payer}>
            <label>
              Total du ticket (€)
              <input
                type="text"
                inputMode="decimal"
                value={saisie}
                onChange={(e) => {
                  setErreur(null);
                  setSaisie(e.target.value);
                }}
              />
            </label>
            <button type="submit" className="bouton-plein">
              Enregistrer
            </button>
            {erreur && (
              <p className="error" role="alert">
                {erreur}
              </p>
            )}
          </form>
        )}
      </section>

      {magasin && faits === lignes.length && lignes.length > 0 && (
        <p className="muted" role="status">
          Tout est dans le chariot.
        </p>
      )}

      {RAYONS.map((r) => {
        const liste = visibles(r);
        if (liste.length === 0) return null;
        const duRayon = lignes.filter((l) => l.rayon === r);
        return (
          <section key={r} className={r === 'keto' ? 'profile-section rayon keto' : 'profile-section rayon'} aria-labelledby={`rayon-${r}`}>
            <div className="rayon-tete">
              <h2 id={`rayon-${r}`}>{LIBELLES_RAYON[r]}</h2>
              <span className="muted">
                {duRayon.filter((l) => coches[l.id]).length}/{duRayon.length}
              </span>
            </div>
            {liste.map((l) => (
              <button
                key={l.id}
                type="button"
                className="ligne-cochable"
                aria-pressed={!!coches[l.id]}
                onClick={() => basculer(l.id)}
              >
                <span className="case" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
                <span className="ligne-nom">
                  {l.nom}
                  {l.rituel && <span className="badge-rituel">rituel</span>}
                </span>
                <span className="ligne-qte">{formatQuantite(l.quantite, l.unite)}</span>
              </button>
            ))}
          </section>
        );
      })}

      {auFrigo.length > 0 && (
        <section className="profile-section" aria-labelledby="h-frigo">
          <h2 id="h-frigo">Déjà au frigo ?</h2>
          <p className="muted">Plats reportés : déjà achetés. Touche un produit s'il faut le racheter.</p>
          {auFrigo.map((i) => {
            const id = `frigo:${lettre}:${cleIngredient(i.nom)}`;
            return (
              <button
                key={id}
                type="button"
                className="ligne-cochable au-frigo"
                aria-pressed={!coches[id]}
                onClick={() => basculer(id)}
              >
                <span className="case" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
                <span className="ligne-nom">{i.nom}</span>
                <span className="ligne-qte">{coches[id] ? 'à racheter' : formatQuantite(i.quantite, i.unite)}</span>
              </button>
            );
          })}
        </section>
      )}

      {placard.length > 0 && (
        <details className="profile-section placard">
          <summary>À vérifier au placard · {placard.length}</summary>
          <ul>
            {placard.map((l) => (
              <li key={l.id}>
                {l.nom} <span className="muted">· {formatQuantite(l.quantite, l.unite)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
