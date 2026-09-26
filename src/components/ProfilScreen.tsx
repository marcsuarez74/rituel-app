import { useState } from 'react';
import { prenomProfil } from '../lib/model';
import type { UserProfile } from '../lib/model';
import { getWeights } from '../lib/storage';
import { assemblePromptIa } from '../lib/promptIa';
import { deconnecterFoyer } from '../lib/sync/engine';
import type { SyncEtat } from '../lib/sync/engine';
import {
  resumeDuo,
  resumeInfos,
  resumeMaison,
  resumeObjectif,
} from '../lib/resumes';
import { ImportButton } from './ImportButton';
import { Icon } from './Icon';
import { ProfilInfos } from './profil/ProfilInfos';
import { ProfilFoyer } from './profil/ProfilFoyer';
import { ProfilMaison } from './profil/ProfilMaison';
import { ProfilObjectif } from './profil/ProfilObjectif';

// Navigation interne : hub (vue générale) ou page détail.
type Vue = 'hub' | 'objectif' | 'infos' | 'maison' | 'foyer';

export function ProfilScreen({
  profile,
  onBack,
  onChangeProfile,
  onProfileSaved,
  onImported,
  syncEtat = 'off',
  cycle,
}: {
  profile: UserProfile;
  onBack: () => void;
  onChangeProfile: () => void;
  onProfileSaved?: (p: UserProfile) => void;
  onImported: () => void;
  syncEtat?: SyncEtat;
  cycle?: number;
}) {
  const [vue, setVue] = useState<Vue>('hub');
  const [copie, setCopie] = useState(false);

  const copierPrompt = async () => {
    const texte = assemblePromptIa(profile, getWeights(profile.id).at(-1) ?? null);
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
    setCopie(true);
  };

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
            <div className="hub-tuiles">
              <button type="button" className="hub-tuile" onClick={() => setVue('objectif')}>
                <Icon name="target" size={20} />
                <b>Objectif</b>
                <span>{resumeObjectif(profile, getWeights(profile.id).at(-1) ?? null)}</span>
              </button>
              <button type="button" className="hub-tuile" onClick={() => setVue('infos')}>
                <Icon name="info" size={20} />
                <b>Mes infos</b>
                <span>{resumeInfos(profile)}</span>
              </button>
              <button type="button" className="hub-tuile" onClick={() => setVue('maison')}>
                <Icon name="home" size={20} />
                <b>Maison &amp; courses</b>
                <span>{resumeMaison(profile)}</span>
              </button>
            </div>
            <div className="hub-actions">
              <button type="button" className="hub-action" onClick={changerProfil}>
                <Icon name="refresh" size={16} /> Changer de profil <span aria-hidden="true" className="fleche">›</span>
              </button>
              <button type="button" className="hub-action" onClick={copierPrompt}>
                <Icon name="copy" size={16} /> Copier le prompt IA <span aria-hidden="true" className="fleche">⧉</span>
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
              <div className="hub-import">
                <ImportButton onImported={onImported} label="Importer un cycle (.md)" />
              </div>
              {copie && (
                <p className="muted" role="status">
                  Prompt copié — colle-le dans le chat.
                </p>
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
          {vue === 'foyer' && <ProfilFoyer syncEtat={syncEtat} />}
        </>
      )}
    </div>
  );
}
