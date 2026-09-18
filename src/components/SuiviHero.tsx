import { useState } from 'react';
import { OBJECTIF_TYPES, REGIMES } from '../lib/model';
import type { UserProfile } from '../lib/model';
import { formatJourMoisCourt, joursRestants } from '../lib/dates';
import { fmtKg } from '../lib/text';
import { getWeights } from '../lib/storage';
import { poidsActuel, progressionPoids, variationKg7j } from '../lib/stats';
import { ProgressRing } from './ProgressRing';
import { Icon } from './Icon';

// Carte héro du suivi : ObjectifBloc + StatCards fusionnés. Anneau de
// progression dès qu'une cible + des pesées existent (sens auto-détecté),
// poids simple sinon.
export function SuiviHero({ profile }: { profile: UserProfile }) {
  // Invariant : le profil actif ne change jamais en place — un changement passe
  // par removeProfile → Onboarding, qui démonte tout le sous-arbre suivi. Côté
  // App, la clé `hero-${weightsBump}` remonte le composant à l'ajout d'une pesée.
  const [weights] = useState(() => getWeights(profile.id));

  const type = OBJECTIF_TYPES.find((t) => t.id === profile.objectif.type)!;
  const actuel = poidsActuel(weights);
  const depart = weights.length > 0 ? weights[0] : null;
  const cible = profile.poidsObjectif;

  // Le sens ne dépend pas du type d'objectif (juste une étiquette) : il est
  // auto-détecté des données — cible < départ = perte, sinon masse.
  const calc =
    cible != null && depart && actuel
      ? progressionPoids(cible < depart.kg ? 'perte' : 'masse', depart.kg, actuel.kg, cible)
      : null;

  // La variation est « bonne » si elle va dans le sens de l'objectif.
  let delta: { texte: string; classe: string } | null = null;
  const variation = variationKg7j(weights);
  if (actuel && variation != null) {
    const kg = fmtKg(Math.abs(variation));
    const fleche = variation < 0 ? '▼' : '▲';
    let classe = 'stat-delta-neutre';
    if (cible != null) {
      const perte = cible < actuel.kg;
      classe = (variation < 0) === perte ? 'stat-delta-bon' : 'stat-delta-alerte';
    }
    delta = { texte: `${fleche} ${variation < 0 ? '-' : '+'}${kg} kg`, classe };
  }

  const echeance = profile.objectif.echeance;
  const restants = echeance ? joursRestants(echeance) : null;

  return (
    <section className="suivi-hero" aria-label="Mon objectif">
      <div className="suivi-hero-main">
        {calc && cible != null ? (
          <ProgressRing
            progress={calc.pct / 100}
            ariaLabel={`Progression : ${calc.pct} % de l'objectif`}
          >
            <b>{fmtKg(Math.abs(calc.kgRestant))}</b>
            <small>kg {calc.sens}</small>
          </ProgressRing>
        ) : (
          <div className="suivi-hero-poids" role="img" aria-label="Poids actuel">
            <Icon name="scale" size={22} />
            <b>{actuel ? fmtKg(actuel.kg) : '—'}</b>
            <small>kg</small>
          </div>
        )}
        <div className="suivi-hero-info">
          <span className="suivi-hero-label">
            <Icon name={type.icone} size={14} /> Objectif · {type.nom}
          </span>
          {cible != null && <b className="suivi-hero-cible">Cible {fmtKg(cible)} kg</b>}
          {delta && (
            <span className={`stat-delta ${delta.classe}`}>
              {delta.texte}
              <small>vs 7 jours</small>
            </span>
          )}
          {echeance && restants != null && (
            <p className={`suivi-hero-echeance${restants < 0 ? ' late' : ''}`}>
              <Icon name="clock" size={14} /> Échéance : <b>{formatJourMoisCourt(echeance)}</b> ·{' '}
              <b>
                {restants > 0
                  ? `dans ${restants} jours`
                  : restants === 0
                    ? 'aujourd’hui'
                    : 'dépassée'}
              </b>
            </p>
          )}
        </div>
      </div>
      {(profile.regime !== 'aucun' || profile.complements.length > 0) && (
        <div className="suivi-hero-chips">
          {profile.regime !== 'aucun' && (
            <span className="cchip">{REGIMES.find((r) => r.id === profile.regime)!.nom}</span>
          )}
          {profile.complements.length > 0 && (
            <span className="cchip">
              {profile.complements.length} complément{profile.complements.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
