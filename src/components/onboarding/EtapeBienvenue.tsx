import { useState } from 'react';
import { Icon } from '../Icon';
import type { PourQui, SaisieFoyer } from './saisie';

const POUR_QUI: Array<{ id: PourQui; nom: string }> = [
  { id: 'moi', nom: 'Juste moi' },
  { id: 'deux', nom: 'À deux' },
  { id: 'famille', nom: 'En famille' },
];

const MODES = [
  { suivi: false, nom: 'Juste la routine', desc: 'menus, courses, rituel batch' },
  { suivi: true, nom: 'Suivre mon poids et un objectif', desc: 'portions et macros calculées pour toi, onglet Suivi' },
];

// Étape 1 de l'onboarding (spec 2026-10-07 §2, maquette écran A) : seule
// étape obligatoire — prénom, pour qui on cuisine, routine ou suivi.
export function EtapeBienvenue({
  saisie,
  onChange,
  onContinuer,
}: {
  saisie: SaisieFoyer;
  onChange: (s: SaisieFoyer) => void;
  onContinuer: () => void;
}) {
  const [enfant, setEnfant] = useState('');
  const maj = (m: Partial<SaisieFoyer>) => onChange({ ...saisie, ...m });
  const ajouterEnfant = () => {
    const p = enfant.trim();
    if (p && !saisie.enfants.includes(p)) maj({ enfants: [...saisie.enfants, p] });
    setEnfant('');
  };

  return (
    <>
      <h1>Bienvenue sur Rituel 👋</h1>
      <p className="onboarding-sub">Deux questions et tu peux commencer. Le reste est optionnel.</p>

      <div className="onboarding-field">
        <label htmlFor="ob-prenom">Comment tu t'appelles ?</label>
        <input
          id="ob-prenom"
          type="text"
          maxLength={20}
          autoComplete="given-name"
          value={saisie.prenom}
          onChange={(e) => maj({ prenom: e.target.value })}
        />
      </div>

      <p className="onb-label" id="ob-pour-qui">
        Tu cuisines pour…
      </p>
      <div className="rline" role="radiogroup" aria-labelledby="ob-pour-qui">
        {POUR_QUI.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={saisie.pourQui === o.id}
            className={`rl${saisie.pourQui === o.id ? ' sel' : ''}`}
            onClick={() => maj({ pourQui: o.id })}
          >
            <span className="rl-dot" aria-hidden="true" />
            {o.nom}
          </button>
        ))}
      </div>

      {saisie.pourQui !== 'moi' && (
        <div className="onboarding-field">
          <label htmlFor="ob-partenaire">
            Prénom de ton/ta partenaire <span className="onb-opt">(optionnel)</span>
          </label>
          <input
            id="ob-partenaire"
            type="text"
            maxLength={20}
            value={saisie.partenaire}
            onChange={(e) => maj({ partenaire: e.target.value })}
          />
        </div>
      )}

      {saisie.pourQui === 'famille' && (
        <>
          <p className="onb-label">Les enfants</p>
          {saisie.enfants.length > 0 && (
            <div className="chips">
              {saisie.enfants.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="chip on"
                  aria-label={`Retirer ${e}`}
                  onClick={() => maj({ enfants: saisie.enfants.filter((x) => x !== e) })}
                >
                  {e}
                  <span className="rm" aria-hidden="true">
                    ✕
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="addrow">
            <input
              value={enfant}
              maxLength={20}
              placeholder="Prénom d'un enfant"
              aria-label="Prénom d'un enfant"
              onChange={(e) => setEnfant(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ajouterEnfant();
                }
              }}
            />
            <button type="button" onClick={ajouterEnfant}>
              <Icon name="plus" size={14} /> Ajouter
            </button>
          </div>
        </>
      )}

      <p className="onb-label" id="ob-mode">
        Et toi, tu veux aussi…
      </p>
      <div className="rcards rcards-ligne" role="radiogroup" aria-labelledby="ob-mode">
        {MODES.map((m) => (
          <button
            key={m.nom}
            type="button"
            role="radio"
            aria-checked={saisie.suivi === m.suivi}
            className="rcard"
            onClick={() => maj({ suivi: m.suivi })}
          >
            <span className="rcard-t">{m.nom}</span>
            <span className="rcard-d">{m.desc}</span>
          </button>
        ))}
      </div>

      <div className="onb-btnrow">
        <button type="button" className="onb-next" onClick={onContinuer}>
          Continuer <Icon name="chev-right" size={14} />
        </button>
      </div>
      <p className="onb-hint">
        {saisie.suivi
          ? 'Ensuite : tes mesures, ton objectif, tes goûts — tout ça peut attendre.'
          : 'Ensuite : ton régime et tes goûts — tout ça peut attendre.'}
      </p>
    </>
  );
}
