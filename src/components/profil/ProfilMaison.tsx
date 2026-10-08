import { useState } from 'react';
import { MAGASINS_PRESETS, normaliseComplement } from '../../lib/model';
import type { UserProfile } from '../../lib/model';
import { parseEuro } from '../../lib/prix';
import { saveProfile } from '../../lib/storage';
import { Icon } from '../Icon';
import { Alerte, Fil } from './presente';

// Page détail « Courses & budget » — magasin, budget, préférences des
// prochains cycles (qui est à table : le foyer ; quels repas : la semaine type).
export function ProfilMaison({
  profile,
  onProfileSaved,
}: {
  profile: UserProfile;
  onProfileSaved?: (p: UserProfile) => void;
}) {
  const [magasin, setMagasin] = useState(profile.magasin ?? '');
  const [budgetMax, setBudgetMax] = useState(profile.budgetMax != null ? String(profile.budgetMax) : '');
  const [preferences, setPreferences] = useState<string[]>([...(profile.preferences ?? [])]);
  const [nouvellePreference, setNouvellePreference] = useState('');
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pattern render-phase reset (cf. ProfileView).
  const [synced, setSynced] = useState(profile.id);
  if (synced !== profile.id) {
    setSynced(profile.id);
    setMagasin(profile.magasin ?? '');
    setBudgetMax(profile.budgetMax != null ? String(profile.budgetMax) : '');
    setPreferences([...(profile.preferences ?? [])]);
    setNouvellePreference('');
    setSaved(false);
    setErreur(null);
  }

  const maj = (updated: UserProfile) => {
    saveProfile(updated);
    onProfileSaved?.(updated);
    setSaved(true);
  };

  const enregistrerMaison = () => {
    const bud = budgetMax ? parseEuro(budgetMax) : undefined;
    if (bud !== undefined && (bud === null || bud > 10000)) {
      setErreur('Budget max invalide : entre un montant en euros (ex. 40).');
      return;
    }
    setErreur(null);
    // Clés maison reconstruites : un champ vidé retire la donnée (pattern
    // delete + set de enregistrerObjectif) — jamais de valeur vide écrite.
    const updated: UserProfile = { ...profile };
    delete updated.magasin;
    delete updated.budgetMax;
    delete updated.preferences;
    // Champs retirés (spec 2026-10-07 §1 ter) : nettoyés au passage.
    delete updated.personnes;
    delete updated.repasJour;
    if (magasin.trim()) updated.magasin = magasin.trim();
    if (bud != null) updated.budgetMax = bud;
    if (preferences.length > 0) updated.preferences = [...preferences];
    maj(updated);
  };

  const ajouterPreference = () => {
    const v = nouvellePreference.trim().slice(0, 40);
    if (!v) return;
    if (preferences.some((p) => normaliseComplement(p) === normaliseComplement(v))) {
      setErreur('Cette préférence est déjà sélectionnée.');
      return;
    }
    setErreur(null);
    setPreferences([...preferences, v]);
    setNouvellePreference('');
  };

  return (
    <section className="detail-page">
      <h2>Courses &amp; budget</h2>
      <div className="onboarding-field">
        <label htmlFor="pf-magasin">Magasin habituel</label>
        <input
          id="pf-magasin"
          type="text"
          list="pf-magasins"
          placeholder="Lidl, Intermarché…"
          value={magasin}
          onChange={(e) => {
            setSaved(false);
            setErreur(null);
            setMagasin(e.target.value);
          }}
        />
        <datalist id="pf-magasins">
          {MAGASINS_PRESETS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div className="onboarding-field">
        <label htmlFor="pf-budget">Budget max courses / semaine (€)</label>
        <input
          id="pf-budget"
          type="text"
          inputMode="decimal"
          value={budgetMax}
          onChange={(e) => {
            setSaved(false);
            setErreur(null);
            setBudgetMax(e.target.value);
          }}
        />
      </div>
      <p className="onb-label">Préférences pour les prochains cycles</p>
      <div className="chips">
        {preferences.map((p) => (
          <button
            key={p}
            type="button"
            className="chip"
            onClick={() => {
              setSaved(false);
              setPreferences(preferences.filter((x) => x !== p));
            }}
          >
            {p}
            <span className="rm" aria-hidden="true">
              ✕
            </span>
            <span className="sr-only">{`Retirer ${p}`}</span>
          </button>
        ))}
      </div>
      <div className="addrow">
        <input
          value={nouvellePreference}
          maxLength={40}
          placeholder="Ajouter une préférence…"
          aria-label="Ajouter une préférence"
          onChange={(e) => {
            setErreur(null);
            setNouvellePreference(e.target.value);
          }}
        />
        <button type="button" onClick={ajouterPreference}>
          <Icon name="plus" size={14} /> Ajouter
        </button>
      </div>
      <button type="button" className="btn profil-save" onClick={enregistrerMaison}>
        Enregistrer maison &amp; courses
      </button>
      <Alerte texte={erreur} />
      <Fil active={saved} />
    </section>
  );
}
