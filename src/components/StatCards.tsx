import { useState } from 'react';
import { getWeights } from '../lib/storage';
import { poidsActuel, variationKg7j } from '../lib/stats';
import { fmtKg } from '../lib/text';
import type { UserProfile } from '../lib/model';
import { Icon } from './Icon';

export function StatCards({ profile }: { profile: UserProfile }) {
  // Invariant : le profil actif ne change jamais en place — un changement passe par
  // removeProfile → Onboarding, qui démonte tout le sous-arbre suivi. Si un changement
  // de profil en place était un jour ajouté, il faudrait ici un render-phase reset
  // (pattern syncedProfile) pour relire les pesées du nouveau profil.
  const [weights] = useState(() => getWeights(profile.id));

  const actuel = poidsActuel(weights);
  const variation = variationKg7j(weights);

  // La variation est « bonne » si elle va dans le sens de l'objectif.
  let deltaClass = 'stat-delta-neutre';
  let deltaTexte: string | null = null;
  if (actuel && variation != null) {
    const kg = fmtKg(Math.abs(variation));
    const fleche = variation < 0 ? '▼' : '▲';
    deltaTexte = `${fleche} ${variation < 0 ? '-' : '+'}${kg} kg`;
    if (profile.poidsObjectif != null) {
      const perte = profile.poidsObjectif < actuel.kg;
      deltaClass = (variation < 0) === perte ? 'stat-delta-bon' : 'stat-delta-alerte';
    }
  }

  return (
    <div className="stat-cards" role="list" aria-label="Résumé de mon suivi">
      <div className="stat-card stat-card-hero" role="listitem" aria-label="Poids">
        <div>
          <span className="stat-label">
            <Icon name="scale" size={14} /> Poids
          </span>
          <span className="stat-value">
            {actuel ? fmtKg(actuel.kg) : '—'}
            {actuel && <small> kg</small>}
          </span>
        </div>
        {deltaTexte && (
          <span className={`stat-delta ${deltaClass}`}>
            {deltaTexte}
            <small>vs 7 jours</small>
          </span>
        )}
      </div>
    </div>
  );
}
