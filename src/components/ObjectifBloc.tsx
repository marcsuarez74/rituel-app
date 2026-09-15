import { useState } from 'react';
import { OBJECTIF_TYPES, REGIMES } from '../lib/model';
import type { UserProfile } from '../lib/model';
import { formatJourMoisCourt, joursRestants } from '../lib/dates';
import { fmtKg } from '../lib/text';
import { getWeights } from '../lib/storage';
import { poidsActuel } from '../lib/stats';
import { Icon } from './Icon';

// Progression perte/masse : départ = 1re pesée, actuel = dernière, 0-100 %.
// Arrondi au dixième : 4,4/8,8 en flottant donnerait 49,999…% sans lui.
const progression = (type: 'perte' | 'masse', depart: number, actuel: number, cible: number): number | null => {
  const total = type === 'perte' ? depart - cible : cible - depart;
  const fait = type === 'perte' ? depart - actuel : actuel - depart;
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((fait / total) * 1000) / 10));
};

export function ObjectifBloc({ profile }: { profile: UserProfile }) {
  // Invariant : le profil actif ne change jamais en place — un changement passe par
  // removeProfile → Onboarding, qui démonte tout le sous-arbre suivi. Côté App, la clé
  // `obj-${weightsBump}` remonte le bloc à l'ajout d'une pesée (relecture du storage).
  const [weights] = useState(() => getWeights(profile.id));

  const type = OBJECTIF_TYPES.find((t) => t.id === profile.objectif.type)!;
  const regime = REGIMES.find((r) => r.id === profile.regime)!;
  const actuel = poidsActuel(weights);
  const depart = weights.length > 0 ? weights[0] : null;
  const cible = profile.poidsObjectif;

  let barrePct: number | null = null;
  let kgRestant: number | null = null;
  if (
    (profile.objectif.type === 'perte' || profile.objectif.type === 'masse') &&
    cible != null &&
    depart &&
    actuel
  ) {
    barrePct = progression(profile.objectif.type, depart.kg, actuel.kg, cible);
    kgRestant = profile.objectif.type === 'perte' ? actuel.kg - cible : cible - actuel.kg;
  }

  const echeance = profile.objectif.echeance;
  const restants = echeance ? joursRestants(echeance) : null;

  return (
    <section className="obj-bloc" aria-label="Mon objectif">
      <div className="obj-pills">
        <span className="obj-pill-type">
          <Icon name={type.icone} size={14} />
          {type.nom}
        </span>
        {profile.regime !== 'aucun' && (
          <span className="obj-pill-reg">
            <Icon name="leaf" size={14} />
            {regime.nom}
          </span>
        )}
      </div>

      {echeance && restants != null && (
        <p className={`obj-echeance${restants < 0 ? ' late' : ''}`}>
          <Icon name="clock" size={14} />
          Échéance : <b>{formatJourMoisCourt(echeance)}</b> ·{' '}
          <b>
            {restants > 0 ? `dans ${restants} jours` : restants === 0 ? "aujourd'hui" : 'dépassée'}
          </b>
        </p>
      )}

      {barrePct != null && kgRestant != null && cible != null && depart && actuel ? (
        <div className="obj-prog">
          <p className="obj-kg">
            {fmtKg(Math.abs(kgRestant))}
            <small> kg</small>{' '}
            <span>{profile.objectif.type === 'perte' ? 'restants' : 'à prendre'}</span>
          </p>
          <div className="obj-bar" aria-hidden="true">
            <span style={{ width: `${barrePct}%` }} />
          </div>
          <p className="obj-det">
            Départ {fmtKg(depart.kg)} kg · {fmtKg(depart.kg)} → {fmtKg(actuel.kg)} → cible {fmtKg(cible)} kg
          </p>
        </div>
      ) : (
        actuel && (
          <p className="obj-plain">
            <Icon name="scale" size={14} />
            Poids actuel <b>{fmtKg(actuel.kg)} kg</b>
            {cible != null && (
              <>
                {' '}· cible <b>{fmtKg(cible)} kg</b>
              </>
            )}
          </p>
        )
      )}

      {profile.complements.length > 0 && (
        <div className="obj-comps">
          <span className="obj-comps-label">Compléments</span>
          {profile.complements.map((c) => (
            <span key={c} className="cchip">
              {c}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
