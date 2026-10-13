import { useState } from 'react';
import type { UserProfile } from '../../lib/model';
import { Pesees } from '../Pesees';
import { SuiviHero } from '../SuiviHero';
import { Icon } from '../Icon';

// Écran poussé « Suivi poids » (spec refonte §4.6) : objectif + poids,
// ouvert depuis la carte Suivi d'Aujourd'hui ou depuis Moi. Séances,
// cibles et rappels sont reportés (décision 2026-10-07).
export function Suivi({
  profile,
  syncVersion,
  onRetour,
}: {
  profile: UserProfile;
  syncVersion: number;
  onRetour?: () => void;
}) {
  // SuiviHero lit les pesées au montage : une pesée ajoutée le remonte.
  const [bump, setBump] = useState(0);
  return (
    <div className="suivi-ecran">
      {onRetour && (
        <button type="button" className="profil-back" onClick={onRetour}>
          <Icon name="chev-left" size={16} /> Retour
        </button>
      )}
      <SuiviHero key={`${bump}-${syncVersion}`} profile={profile} />
      <Pesees profile={profile} syncVersion={syncVersion} onWeightsChanged={() => setBump((b) => b + 1)} />
    </div>
  );
}
