import type { WeekMeta } from '../lib/model';
import type { SyncEtat } from '../lib/sync/engine';
import { formatDayMonth } from '../lib/dates';
import { Icon } from './Icon';

const ETIQUETTES: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Synchronisation : non connecté',
  sync: 'Synchronisé',
  erreur: 'Synchronisation : erreur — appuyer pour réessayer',
};

export function WeekBanner({
  meta,
  onOpenProfile,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  syncEtat,
  onSyncTap,
}: {
  meta: WeekMeta;
  onOpenProfile?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  syncEtat?: SyncEtat;
  onSyncTap?: () => void;
}) {
  const nav = !!(onPrev || onNext);
  const syncVisible = !!syncEtat && syncEtat !== 'off' && syncEtat !== 'hors-foyer';
  return (
    <header className="week-banner">
      {nav && (
        <button
          type="button"
          className="banner-nav"
          aria-label="Semaine précédente"
          onClick={onPrev}
          disabled={!hasPrev}
        >
          <Icon name="chev-left" size={16} />
        </button>
      )}
      <div className="week-banner-main">
        <div className="week-title-row">
          <h1 className="week-title">Semaine {meta.semaine}</h1>
          <span className="menu-pill">Menu {meta.menu}</span>
        </div>
        {meta.titre && <p className="muted">{meta.titre}</p>}
        <p>
          {formatDayMonth(meta.du)} → {formatDayMonth(meta.au)}
        </p>
      </div>
      {nav && (
        <button
          type="button"
          className="banner-nav"
          aria-label="Semaine suivante"
          onClick={onNext}
          disabled={!hasNext}
        >
          <Icon name="chev-right" size={16} />
        </button>
      )}
      {(syncVisible || onOpenProfile) && (
        <div className="week-banner-actions">
          {syncVisible && (
            <button
              type="button"
              className={`sync-dot sync-${syncEtat}`}
              aria-label={ETIQUETTES[syncEtat]}
              title={ETIQUETTES[syncEtat]}
              onClick={onSyncTap}
            />
          )}
          {onOpenProfile && (
            <button type="button" className="profile-icon-btn" aria-label="Mon profil" onClick={onOpenProfile}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
