import { useState } from 'react';
import { prenomProfil } from '../lib/model';
import type { UserProfile } from '../lib/model';
import { getWeights } from '../lib/storage';
import { deconnecterFoyer } from '../lib/sync/engine';
import type { SyncEtat } from '../lib/sync/engine';
import {
  resumeDuo,
  resumeInfos,
  resumeMaison,
  resumeObjectif,
} from '../lib/resumes';
import { Icon, type IconName } from './Icon';
import { ProfilInfos } from './profil/ProfilInfos';
import { ProfilFoyer } from './profil/ProfilFoyer';
import { ProfilMaison } from './profil/ProfilMaison';
import { ProfilObjectif } from './profil/ProfilObjectif';

// Navigation interne : hub (vue générale) ou page détail.
type Vue = 'hub' | 'objectif' | 'infos' | 'maison' | 'foyer';

// Ligne du hub (maquette v2, écran 11) : icône, titre, résumé, chevron.
function LigneHub({ icone, titre, resume, onClick }: { icone: IconName; titre: string; resume: string; onClick: () => void }) {
  return (
    <button type="button" className="hub-ligne" onClick={onClick}>
      <Icon name={icone} size={20} />
      <span className="hub-ligne-txt">
        <b>{titre}</b>
        <span>{resume}</span>
      </span>
      <Icon name="chev-right" size={18} />
    </button>
  );
}

export function ProfilScreen({
  profile,
  onBack,
  onChangeProfile,
  onProfileSaved,
  syncEtat = 'off',
  cycle,
  resumeCycle,
  onMonCycle,
  resumeSemaine,
  onSemaineType,
  onIdentite,
}: {
  profile: UserProfile;
  onBack: () => void;
  onChangeProfile: () => void;
  onProfileSaved?: (p: UserProfile) => void;
  syncEtat?: SyncEtat;
  cycle?: number;
  resumeCycle?: string;
  onMonCycle?: () => void;
  resumeSemaine?: string;
  onSemaineType?: () => void;
  onIdentite?: (p: UserProfile) => void;
}) {
  const [vue, setVue] = useState<Vue>('hub');

  const changerProfil = () => {
    if (
      window.confirm(
        `Changer de profil ? ${prenomProfil(profile.id, profile)} restera sur ce téléphone avec ses données.`,
      )
    )
      onChangeProfile();
  };

  const duo = resumeDuo(syncEtat);

  return (
    <div className="profil-screen">
      {vue === 'hub' ? (
        <>
          <button type="button" className="profil-back" onClick={onBack}>
            <Icon name="chev-left" size={16} />
            Retour
          </button>
          <div className="profil-hub">
            <div className="hub-compte">
              <div className="hub-avatar">{(prenomProfil(profile.id, profile)[0] ?? '?').toUpperCase()}</div>
              <div>
                <h1 className="hub-nom">{prenomProfil(profile.id, profile)}</h1>
                <div className="hub-sous">
                  {duo && <span aria-hidden="true" className={`hub-pt${duo.ton !== 'basilic' ? ` ${duo.ton}` : ''}`} />}
                  {duo && <b>{duo.label}</b>}
                  {cycle != null && (
                    <span className="hub-cycle">{duo ? `· Cycle ${cycle}` : `Cycle ${cycle}`}</span>
                  )}
                </div>
              </div>
            </div>
            <h2 className="hub-section">Le foyer</h2>
            {onMonCycle && (
              <LigneHub icone="refresh" titre="Mon cycle" resume={resumeCycle ?? ''} onClick={onMonCycle} />
            )}
            {onSemaineType && (
              <LigneHub icone="home" titre="Ma semaine type" resume={resumeSemaine ?? ''} onClick={onSemaineType} />
            )}
            <LigneHub icone="cart" titre="Courses & budget" resume={resumeMaison(profile)} onClick={() => setVue('maison')} />
            <h2 className="hub-section">Moi</h2>
            <LigneHub
              icone="target"
              titre="Objectif & régime"
              resume={resumeObjectif(profile, getWeights(profile.id).at(-1) ?? null)}
              onClick={() => setVue('objectif')}
            />
            <LigneHub icone="info" titre="Mes infos" resume={resumeInfos(profile)} onClick={() => setVue('infos')} />
            <div className="hub-actions">
              <button type="button" className="hub-action" onClick={changerProfil}>
                <Icon name="refresh" size={16} /> Changer de profil <span aria-hidden="true" className="fleche">›</span>
              </button>
              {duo && (
                <button type="button" className="hub-action" onClick={() => setVue('foyer')}>
                  <span aria-hidden="true" className="hub-pt" /> {duo.label} — voir le foyer <span aria-hidden="true" className="fleche">›</span>
                </button>
              )}
              {syncEtat !== 'off' && (
                <button type="button" className="hub-action danger" onClick={deconnecterFoyer}>
                  Déconnecter le foyer <span aria-hidden="true" className="fleche">›</span>
                </button>
              )}
            </div>
          </div>
          <p className="muted profil-about">
            Rituel v{__APP_VERSION__} — vos données restent sur votre téléphone.
          </p>
        </>
      ) : (
        <>
          <button type="button" className="profil-back" onClick={() => setVue('hub')}>
            <Icon name="chev-left" size={16} />
            Profil
          </button>
          {vue === 'infos' && <ProfilInfos profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'objectif' && <ProfilObjectif profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'maison' && <ProfilMaison profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'foyer' && <ProfilFoyer syncEtat={syncEtat} profile={profile} onIdentite={onIdentite} />}
        </>
      )}
    </div>
  );
}
