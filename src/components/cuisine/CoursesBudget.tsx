import { useState } from 'react';
import type { DepenseEntry, UserProfile, WeeklyData } from '../../lib/model';
import { MAGASINS_PRESETS } from '../../lib/model';
import { getDepenses, saveDepense, deleteDepense } from '../../lib/storage';
import { formatEuro, parseEuro } from '../../lib/prix';
import { todayISO, formatDayMonth } from '../../lib/dates';
import { Icon } from '../Icon';

// Somme des dépenses dont la date appartient à [du..au] — comparaison par
// chaînes ISO (jamais new Date sur une forme date-only, qui parserait en UTC).
// Interne au fichier (lint react-refresh : seul le composant s'exporte).
const payeSurSemaine = (depenses: DepenseEntry[], du: string, au: string): number =>
  depenses
    .filter((d) => d.date >= du && d.date <= au)
    .reduce((somme, d) => somme + d.total, 0);

export function CoursesBudget({
  data,
  profile,
  onOuvrirDepenses,
}: {
  data: WeeklyData;
  profile: UserProfile;
  onOuvrirDepenses: (focusTotal: boolean) => void;
}) {
  const [depenses] = useState<DepenseEntry[]>(() => getDepenses());

  const paye = payeSurSemaine(depenses, data.meta.du, data.meta.au);
  const enSemaine = depenses.some((d) => d.date >= data.meta.du && d.date <= data.meta.au);
  // Carte visible seulement si au moins une donnée existe (spec § 3).
  if (!data.budget && profile.budgetMax === undefined && !enSemaine) return null;

  const max = profile.budgetMax;
  const maxConnu = max !== undefined && enSemaine;
  const pct = maxConnu ? Math.round((paye / max) * 100) : null;
  const depasse = maxConnu && paye > max;

  return (
    <section className="bud" aria-label="Budget courses">
      <div className="bud-head">
        <b>Budget courses</b>
        {profile.magasin && (
          <span className="mag">
            <Icon name="cart" size={14} />
            {profile.magasin}
          </span>
        )}
      </div>
      <span className="bud-hero-label">Payé cette semaine</span>
      <span className={`bud-hero${depasse ? ' alerte' : ''}`}>
        {enSemaine ? formatEuro(paye) : '—'}
      </span>
      {(data.budget || max !== undefined) && (
        <p className="bud-sub">
          {data.budget && (
            <>
              sur <b>{data.budget}</b> estimés
            </>
          )}
          {data.budget && max !== undefined && ' · '}
          {max !== undefined && (
            <>
              max <b>{formatEuro(max)}</b>
            </>
          )}
        </p>
      )}
      {maxConnu && (
        <div className="bud-foot">
          <div className={`bud-bar${depasse ? ' alerte' : ''}`}>
            <i style={{ width: depasse ? '100%' : `${Math.min(pct!, 100)}%` }} />
          </div>
          <span className={`bud-pct${depasse ? ' alerte' : ''}`}>
            {depasse ? `dépassé de ${pct! - 100} %` : `${pct} % du budget`}
          </span>
        </div>
      )}
      <div className="bud-actions">
        <button type="button" className="bsoft" onClick={() => onOuvrirDepenses(true)}>
          <Icon name="plus" size={14} /> Total payé
        </button>
        <button type="button" className="bsoft bud-lie" onClick={() => onOuvrirDepenses(false)}>
          Voir mes dépenses réelles
        </button>
      </div>
    </section>
  );
}

export function DepensesPanel({
  profile,
  focusTotal,
  onRetour,
}: {
  profile: UserProfile;
  focusTotal: boolean;
  onRetour: () => void;
}) {
  const [depenses, setDepenses] = useState<DepenseEntry[]>(() => getDepenses());
  const [date, setDate] = useState(() => todayISO());
  const [magasin, setMagasin] = useState(profile.magasin ?? '');
  const [total, setTotal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const enregistrer = () => {
    const t = parseEuro(total);
    if (t === null) {
      setError('Total invalide : entre un montant supérieur à 0.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) {
      setError('La date doit être valide et non future.');
      return;
    }
    if (!magasin.trim()) {
      setError('Indique le magasin de la session.');
      return;
    }
    setError(null);
    const maj = saveDepense(date, magasin, t);
    // saveDepense renvoie la liste inchangée quand l'upsert est ignoré
    // (première graphie gagne) — getDepenses repart du storage, donc pas
    // d'égalité de référence : on compare le contenu.
    const ignoree =
      maj.length === depenses.length &&
      maj.every(
        (d, i) =>
          d.date === depenses[i].date &&
          d.magasin === depenses[i].magasin &&
          d.total === depenses[i].total,
      );
    if (ignoree) {
      setError('Cette session existe déjà sous une autre graphie de magasin — total inchangé.');
    } else {
      setSaved(true);
    }
    setDepenses(maj);
    setTotal('');
  };

  // Regroupement « Par magasin » : casse ignorée, première graphie conservée,
  // tri par total décroissant.
  const parMagasin = [...depenses.reduce((map, d) => {
    const cle = d.magasin.toLowerCase();
    const acc = map.get(cle) ?? { nom: d.magasin, total: 0, sessions: 0 };
    acc.total += d.total;
    acc.sessions += 1;
    map.set(cle, acc);
    return map;
  }, new Map<string, { nom: string; total: number; sessions: number }>()).values()].sort(
    (a, b) => b.total - a.total,
  );

  return (
    <div className="dep-panel">
      <div className="dep-head">
        <button type="button" className="dep-back" onClick={onRetour}>
          <Icon name="chev-left" size={14} />
          Retour
        </button>
        <h1>Mes dépenses réelles</h1>
        <p className="dep-sub">Une ligne par session de courses.</p>
      </div>

      <div className="dep-form">
        <div className="frow">
          <div>
            <span className="fl">Date</span>
            <input
              type="date"
              aria-label="Date"
              value={date}
              onChange={(e) => {
                setSaved(false);
                setError(null);
                setDate(e.target.value);
              }}
            />
          </div>
          <div>
            <span className="fl">Magasin</span>
            <input
              list="dep-magasins"
              aria-label="Magasin"
              value={magasin}
              onChange={(e) => {
                setSaved(false);
                setError(null);
                setMagasin(e.target.value);
              }}
            />
            <datalist id="dep-magasins">
              {MAGASINS_PRESETS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div>
            <span className="fl">Total (€)</span>
            <input
              className="tot"
              inputMode="decimal"
              aria-label="Total (€)"
              placeholder="38,20"
              autoFocus={focusTotal}
              value={total}
              onChange={(e) => {
                setSaved(false);
                setError(null);
                setTotal(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="fact">
          <button type="button" className="blink" onClick={onRetour}>
            Annuler
          </button>
          <button type="button" className="bgo" onClick={enregistrer}>
            <Icon name="check" size={14} /> Enregistrer
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="muted" role="status">
            Enregistré ✓
          </p>
        )}
      </div>

      {parMagasin.length > 0 && (
        <>
          <p className="dep-sec-label">Par magasin</p>
          <div className="dep-sum">
            {parMagasin.map((m) => (
              <div className="s" key={m.nom}>
                <span className="nm">
                  {m.nom} <small>{`${m.sessions} session${m.sessions > 1 ? 's' : ''}`}</small>
                </span>
                <span className="tot">{formatEuro(m.total)}</span>
                <span className="avg">{`≈ ${formatEuro(m.total / m.sessions)} / session`}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {depenses.length > 0 && (
        <>
          <p className="dep-sec-label">Historique</p>
          <div className="dep-list">
            {depenses.map((d) => (
              <div className="dep" key={`${d.date}-${d.magasin}`}>
                <span className="d">{formatDayMonth(d.date)}</span>
                <span className="m">{d.magasin}</span>
                <span className="t">{formatEuro(d.total)}</span>
                <button
                  type="button"
                  className="rm"
                  aria-label={`Supprimer ${formatDayMonth(d.date)} ${d.magasin}`}
                  onClick={() => setDepenses(deleteDepense(d.date, d.magasin))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="hint dep-hint">
        Deux magasins le même jour = deux lignes. Touche ✕ pour corriger une erreur de saisie.
      </p>
    </div>
  );
}
