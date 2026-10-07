import { useState } from 'react';
import type { UserProfile } from '../../lib/model';
import { Pesees } from '../Pesees';
import { SuiviHero } from '../SuiviHero';

// Onglet Suivi (chunk à part, avec la courbe) : objectif + poids. Séances,
// cibles et rappels sont reportés (décision 2026-10-07).
export function Suivi({ profile, syncVersion }: { profile: UserProfile; syncVersion: number }) {
  // SuiviHero lit les pesées au montage : une pesée ajoutée le remonte.
  const [bump, setBump] = useState(0);
  return (
    <>
      <SuiviHero key={`${bump}-${syncVersion}`} profile={profile} />
      <Pesees profile={profile} syncVersion={syncVersion} onWeightsChanged={() => setBump((b) => b + 1)} />
    </>
  );
}
