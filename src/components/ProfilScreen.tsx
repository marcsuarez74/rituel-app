import { useState } from 'react';
import { estSuivi, prenomProfil } from '../lib/model';
import type { UserProfile } from '../lib/model';
import { fmtKg } from '../lib/text';
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
import { SupprimerProfil } from './profil/SupprimerProfil';

// Navigation interne : hub (vue générale) ou page détail.
type Vue = 'hub' | 'objectif' | 'infos' | 'maison' | 'foyer';

// Ligne du hub (maquette « Moi ») : icône, titre, résumé, chevron.
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

// Écran « Moi » (spec refonte §4.6) : carte d'identité puis listes Moi /
// Mon foyer / Ce téléphone. Les sous-écrans profil/* sont réutilisés.
export function ProfilScreen({
  profile,
  onBack,
  onChangeProfile,
  onProfileSaved,
  syncEtat = 'off',
  resumeCycle,
  onMonCycle,
  resumeSemaine,
  onSemaineType,
  onSuivi,
  resumeFoyer,
  onIdentite,
  onSignalerBug,
  onProfilSupprime,
}: {
  profile: UserProfile;
  onBack: () => void;
  onChangeProfile: () => void;
  onProfileSaved?: (p: UserProfile) => void;
  syncEtat?: SyncEtat;
  resumeCycle?: string;
  onMonCycle?: () => void;
  resumeSemaine?: string;
  onSemaineType?: () => void;
  onSuivi?: () => void;
  resumeFoyer?: string;
  onIdentite?: (p: UserProfile) => void;
  onSignalerBug?: () => void;
  onProfilSupprime?: () => void;
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
  const moi = estSuivi(profile);
  const derniere = getWeights(profile.id).at(-1) ?? null;

  return (
    <div className="profil-screen">
      {vue === 'hub' ? (
        <>
          <button type="button" className="profil-back" onClick={onBack}>
            <Icon name="chev-left" size={16} />
            Retour
          </button>
          <h1 className="titre-pousse">Moi</h1>
          <div className="hub-compte">
            <div className="hub-avatar">{(prenomProfil(profile.id, profile)[0] ?? '?').toUpperCase()}</div>
            <div>
              <b className="hub-nom">{prenomProfil(profile.id, profile)}</b>
              {resumeFoyer && <span className="hub-sous">{resumeFoyer}</span>}
            </div>
          </div>
          <h2 className="hub-section">Moi</h2>
          <LigneHub icone="info" titre="Mes infos" resume={resumeInfos(profile)} onClick={() => setVue('infos')} />
          {moi && (
            <LigneHub
              icone="target"
              titre="Objectif"
              resume={resumeObjectif(profile, derniere)}
              onClick={() => setVue('objectif')}
            />
          )}
          {moi && onSuivi && (
            <LigneHub
              icone="courbe"
              titre="Suivi poids"
              resume={derniere ? `Dernière pesée : ${fmtKg(derniere.kg)} kg` : 'Aucune pesée'}
              onClick={onSuivi}
            />
          )}
          <h2 className="hub-section">Mon foyer</h2>
          {onMonCycle && <LigneHub icone="refresh" titre="Mes menus" resume={resumeCycle ?? ''} onClick={onMonCycle} />}
          {onSemaineType && (
            <LigneHub icone="home" titre="Ma semaine type" resume={resumeSemaine ?? ''} onClick={onSemaineType} />
          )}
          <LigneHub
            icone="couverts"
            titre="Foyer et partage"
            resume={duo ? duo.label : 'Sur ce téléphone'}
            onClick={() => setVue('foyer')}
          />
          <LigneHub icone="cart" titre="Magasin et budget" resume={resumeMaison(profile)} onClick={() => setVue('maison')} />
          <h2 className="hub-section">Ce téléphone</h2>
          <div className="hub-actions">
            <button type="button" className="hub-action" onClick={changerProfil}>
              <Icon name="refresh" size={16} /> Changer de profil <span aria-hidden="true" className="fleche">›</span>
            </button>
            {onSignalerBug && (
              <button type="button" className="hub-action" onClick={onSignalerBug}>
                <Icon name="info" size={16} /> Signaler un bug <span aria-hidden="true" className="fleche">›</span>
              </button>
            )}
            {syncEtat !== 'off' && (
              <button type="button" className="hub-action danger" onClick={deconnecterFoyer}>
                Déconnecter le foyer <span aria-hidden="true" className="fleche">›</span>
              </button>
            )}
          </div>
          {onProfilSupprime && <SupprimerProfil onSupprime={onProfilSupprime} />}
          <p className="muted profil-about">
            Rituel v{__APP_VERSION__} — vos données restent sur votre téléphone.
          </p>
        </>
      ) : (
        <>
          <button type="button" className="profil-back" onClick={() => setVue('hub')}>
            <Icon name="chev-left" size={16} />
            Moi
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
