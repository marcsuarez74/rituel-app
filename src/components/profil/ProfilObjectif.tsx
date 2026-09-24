import { useState } from 'react';
import { OBJECTIF_TYPES, REGIMES, normaliseComplement } from '../../lib/model';
import type { ObjectifType, Regime, UserProfile } from '../../lib/model';
import { saveProfile } from '../../lib/storage';
import { Icon } from '../Icon';
import { Alerte, Fil } from './presente';

// Page détail « Objectif » — le cap complet : type, poids, échéance, régime
// et compléments (le héro du suivi les affiche ensemble).
export function ProfilObjectif({
  profile,
  onProfileSaved,
}: {
  profile: UserProfile;
  onProfileSaved?: (p: UserProfile) => void;
}) {
  const [objectifType, setObjectifType] = useState<ObjectifType>(profile.objectif.type);
  const [echeance, setEcheance] = useState(profile.objectif.echeance ?? '');
  const [poidsObjectif, setPoidsObjectif] = useState(
    profile.poidsObjectif != null ? String(profile.poidsObjectif) : '',
  );
  const [complements, setComplements] = useState<string[]>([...profile.complements]);
  const [nouveauComplement, setNouveauComplement] = useState('');
  const [regime, setRegime] = useState<Regime>(profile.regime);
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pattern render-phase reset (cf. ProfileView) : la page re-synchronise
  // la prop profile (réouverture, enregistrement aval) sans remount.
  const [synced, setSynced] = useState(profile.id);
  if (synced !== profile.id) {
    setSynced(profile.id);
    setObjectifType(profile.objectif.type);
    setEcheance(profile.objectif.echeance ?? '');
    setPoidsObjectif(profile.poidsObjectif != null ? String(profile.poidsObjectif) : '');
    setComplements([...profile.complements]);
    setNouveauComplement('');
    setRegime(profile.regime);
    setSaved(false);
    setErreur(null);
  }

  const maj = (updated: UserProfile) => {
    saveProfile(updated);
    onProfileSaved?.(updated);
    setSaved(true);
  };

  const enregistrerObjectif = () => {
    const obj = poidsObjectif ? Number.parseFloat(poidsObjectif.replace(',', '.')) : undefined;
    if (poidsObjectif && (obj === undefined || obj < 30 || obj > 250)) {
      setErreur('Poids objectif invalide : entre 30 et 250 kg.');
      return;
    }
    setErreur(null);
    const updated: UserProfile = {
      ...profile,
      objectif: { type: objectifType, ...(echeance ? { echeance } : {}) },
    };
    delete updated.poidsObjectif;
    if (obj != null) updated.poidsObjectif = obj;
    maj(updated);
  };

  const enregistrerComplements = () => {
    setErreur(null);
    maj({ ...profile, complements: [...complements] });
  };

  const enregistrerRegime = () => maj({ ...profile, regime });

  const ajouterComplement = () => {
    const v = nouveauComplement.trim().slice(0, 40);
    if (!v) return;
    if (complements.some((c) => normaliseComplement(c) === normaliseComplement(v))) {
      setErreur('Ce complément est déjà sélectionné.');
      return;
    }
    setErreur(null);
    setComplements([...complements, v]);
    setNouveauComplement('');
  };

  return (
    <section className="detail-page">
      <h2>Objectif</h2>
      <div className="rline" role="radiogroup" aria-label="Type d'objectif">
        {OBJECTIF_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={objectifType === t.id}
            className={`rl${objectifType === t.id ? ' sel' : ''}`}
            onClick={() => {
              setSaved(false);
              setErreur(null);
              setObjectifType(t.id);
            }}
          >
            <span className="rl-dot" aria-hidden="true" />
            {t.nom}
          </button>
        ))}
      </div>
      <div className="onboarding-field">
        <label htmlFor="pf-echeance">Échéance (optionnelle)</label>
        <input
          id="pf-echeance"
          type="date"
          value={echeance}
          onChange={(e) => {
            setSaved(false);
            setEcheance(e.target.value);
          }}
        />
      </div>
      <div className="onboarding-field">
        <label htmlFor="pf-obj-poids">Poids objectif (kg)</label>
        <input
          id="pf-obj-poids"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={poidsObjectif}
          onChange={(e) => {
            setSaved(false);
            setErreur(null);
            setPoidsObjectif(e.target.value);
          }}
        />
      </div>
      <button type="button" className="btn profil-save" onClick={enregistrerObjectif}>
        Enregistrer l'objectif
      </button>
      <Alerte texte={erreur} />
      <Fil active={saved} />

      <div className="chips">
        {complements.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            onClick={() => {
              setSaved(false);
              setComplements(complements.filter((x) => x !== c));
            }}
          >
            {c}
            <span className="rm" aria-hidden="true">
              ✕
            </span>
            <span className="sr-only">{`Retirer ${c}`}</span>
          </button>
        ))}
      </div>
      <div className="addrow">
        <input
          value={nouveauComplement}
          maxLength={40}
          placeholder="Ajouter un complément…"
          aria-label="Ajouter un complément"
          onChange={(e) => {
            setErreur(null);
            setNouveauComplement(e.target.value);
          }}
        />
        <button type="button" onClick={ajouterComplement}>
          <Icon name="plus" size={14} /> Ajouter
        </button>
      </div>
      <button type="button" className="btn profil-save" onClick={enregistrerComplements}>
        Enregistrer les compléments
      </button>

      <div className="rline" role="radiogroup" aria-label="Régime">
        {REGIMES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={regime === r.id}
            className={`rl${regime === r.id ? ' sel' : ''}`}
            onClick={() => {
              setSaved(false);
              setRegime(r.id);
            }}
          >
            <span className="rl-dot" aria-hidden="true" />
            {r.nom}
          </button>
        ))}
      </div>
      <button type="button" className="btn profil-save" onClick={enregistrerRegime}>
        Enregistrer le régime
      </button>
    </section>
  );
}
