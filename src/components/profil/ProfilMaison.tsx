import { useState } from 'react';
import { MAGASINS_PRESETS, normaliseComplement } from '../../lib/model';
import type { UserProfile } from '../../lib/model';
import { parseEuro } from '../../lib/prix';
import { saveProfile } from '../../lib/storage';
import { Icon } from '../Icon';
import { Alerte, Fil } from './presente';

// Page détail « Maison & courses » — magasin, budget, personnes à table,
// repas/jour, préférences des prochains cycles.
export function ProfilMaison({
  profile,
  onProfileSaved,
}: {
  profile: UserProfile;
  onProfileSaved?: (p: UserProfile) => void;
}) {
  const [magasin, setMagasin] = useState(profile.magasin ?? '');
  const [budgetMax, setBudgetMax] = useState(profile.budgetMax != null ? String(profile.budgetMax) : '');
  const [personnes, setPersonnes] = useState(profile.personnes != null ? String(profile.personnes) : '');
  const [repasJour, setRepasJour] = useState(profile.repasJour != null ? String(profile.repasJour) : '');
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
    setPersonnes(profile.personnes != null ? String(profile.personnes) : '');
    setRepasJour(profile.repasJour != null ? String(profile.repasJour) : '');
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
    const pers = personnes ? Number.parseInt(personnes, 10) : undefined;
    if (personnes && (pers === undefined || pers < 1 || pers > 12)) {
      setErreur('Personnes à table : entre 1 et 12.');
      return;
    }
    const repas = repasJour ? Number.parseInt(repasJour, 10) : undefined;
    if (repasJour && (repas === undefined || repas < 1 || repas > 12)) {
      setErreur('Repas par jour : entre 1 et 12.');
      return;
    }
    setErreur(null);
    // Clés maison reconstruites : un champ vidé retire la donnée (pattern
    // delete + set de enregistrerObjectif) — jamais de valeur vide écrite.
    const updated: UserProfile = { ...profile };
    delete updated.magasin;
    delete updated.budgetMax;
    delete updated.preferences;
    delete updated.personnes;
    delete updated.repasJour;
    if (magasin.trim()) updated.magasin = magasin.trim();
    if (bud != null) updated.budgetMax = bud;
    if (preferences.length > 0) updated.preferences = [...preferences];
    if (pers != null) updated.personnes = pers;
    if (repas != null) updated.repasJour = repas;
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
      <h2>Maison &amp; courses</h2>
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
      <div className="onb-row2">
        <div className="onboarding-field">
          <label htmlFor="pf-personnes">Personnes à table</label>
          <input
            id="pf-personnes"
            type="text"
            inputMode="numeric"
            value={personnes}
            onChange={(e) => {
              setSaved(false);
              setErreur(null);
              setPersonnes(e.target.value);
            }}
          />
        </div>
        <div className="onboarding-field">
          <label htmlFor="pf-repas">Repas par jour</label>
          <input
            id="pf-repas"
            type="text"
            inputMode="numeric"
            value={repasJour}
            onChange={(e) => {
              setSaved(false);
              setErreur(null);
              setRepasJour(e.target.value);
            }}
          />
        </div>
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
