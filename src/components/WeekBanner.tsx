import type { WeekMeta } from '../lib/model';
import type { SyncEtat } from '../lib/sync/engine';
import { formatDayMonth, libelleSemaineCourt } from '../lib/dates';
import { Icon } from './Icon';

const ETIQUETTES: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Duo — synchronisation en cours',
  sync: 'Duo — synchronisé, appuyer pour resynchroniser',
  erreur: 'Duo — erreur, appuyer pour réessayer',
};

// Bannière compacte validée (maquette 2026-09-18) : chevrons toujours visibles
// (grisés aux bornes), titre court tappable = changeur de semaine, dates + pill
// menu, chip « Duo/Local » et avatar. Nettement plus compacte que l'ancienne bannière.
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
  return (
    <header className="week-banner">
      <button
        type="button"
        className="banner-nav"
        aria-label="Semaine précédente"
        onClick={onPrev}
        disabled={!onPrev || !hasPrev}
      >
        <Icon name="chev-left" size={16} />
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
        </h1>
        <div className="week-dates-row">
          <span className="week-dates">
            {formatDayMonth(meta.du)} → {formatDayMonth(meta.au)}
          </span>
          <span className="menu-pill">{meta.menu}</span>
        </div>
        {meta.titre && <p className="muted week-titre-md">{meta.titre}</p>}
      </div>
      <button
        type="button"
        className="banner-nav"
        aria-label="Semaine suivante"
        onClick={onNext}
        disabled={!onNext || !hasNext}
      >
        <Icon name="chev-right" size={16} />
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
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
          </svg>
        </button>
      )}
    </header>
  );
}
