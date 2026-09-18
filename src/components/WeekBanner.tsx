import type { WeekMeta } from '../lib/model';
import type { SyncEtat } from '../lib/sync/engine';
import { libelleSemaineCourt, numeroCycle, periodeCourte } from '../lib/dates';
import { Icon } from './Icon';

const ETIQUETTES: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Duo — synchronisation en cours',
  sync: 'Duo — synchronisé, appuyer pour resynchroniser',
  erreur: 'Duo — erreur, appuyer pour réessayer',
};

// Bannière compacte validée (maquette 2026-09-18) : chevrons toujours visibles
// (grisés aux bornes), titre court tappable = changeur de semaine, pill
// « Cycle N » inline après le titre (masquée sans numéro parsable), dates
// courtes sur une ligne, chip « Duo/Local » et avatar. Nettement plus compacte
// que l'ancienne bannière.
export function WeekBanner({
  meta,
  onOpenProfile,
  onSwitcher,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  syncEtat,
  onSyncTap,
}: {
  meta: WeekMeta;
  onOpenProfile?: () => void;
  onSwitcher?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  syncEtat?: SyncEtat;
  onSyncTap?: () => void;
}) {
  const foyer = !!syncEtat && syncEtat !== 'off' && syncEtat !== 'hors-foyer';
  const cycle = numeroCycle(meta.semaine);
  return (
    <header className="week-banner">
      <button
        type="button"
        className="banner-nav"
        aria-label="Semaine précédente"
        onClick={onPrev}
        disabled={!onPrev || !hasPrev}
      >
        <Icon name="chev-left" size={18} />
      </button>
      <div className="week-banner-main">
        <h1 className="week-title">
          <button
            type="button"
            className="week-head"
            onClick={onSwitcher}
            disabled={!onSwitcher}
            aria-label={`${libelleSemaineCourt(meta.semaine)} — changer de semaine`}
          >
            {libelleSemaineCourt(meta.semaine)}
          </button>
          {cycle != null && <span className="cycle-pill">Cycle {cycle}</span>}
        </h1>
        <p className="week-dates">{periodeCourte(meta.du, meta.au)}</p>
        {meta.titre && <p className="muted week-titre-md">{meta.titre}</p>}
      </div>
      <button
        type="button"
        className="banner-nav"
        aria-label="Semaine suivante"
        onClick={onNext}
        disabled={!onNext || !hasNext}
      >
        <Icon name="chev-right" size={18} />
      </button>
      <button
        type="button"
        className={`sync-chip ${foyer ? `sync-chip-${syncEtat}` : 'sync-chip-local'}`}
        aria-label={foyer ? ETIQUETTES[syncEtat!] : 'Hors foyer — ouvrir le profil pour connecter'}
        onClick={foyer ? onSyncTap : onOpenProfile}
      >
        <span className="sync-chip-dot" aria-hidden="true" />
        {foyer ? 'Duo' : 'Local'}
      </button>
      {onOpenProfile && (
        <button type="button" className="profile-icon-btn" aria-label="Mon profil" onClick={onOpenProfile}>
          <Icon name="user" size={16} />
        </button>
      )}
    </header>
  );
}
