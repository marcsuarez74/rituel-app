import { useState } from 'react';
import { MAGASINS_PRESETS, OBJECTIF_TYPES, PRENOMS, REGIMES, normaliseComplement } from '../lib/model';
import type { ObjectifType, Regime, UserProfile } from '../lib/model';
import { formatEuro, parseEuro } from '../lib/prix';
import { ageDepuis, todayISO } from '../lib/dates';
import { saveProfile } from '../lib/storage';
import { ImportButton } from './ImportButton';
import { Icon } from './Icon';

type Section = 'infos' | 'objectif' | 'complements' | 'regime' | 'maison';
type SectionAvecErreur = 'infos' | 'objectif' | 'complements' | 'maison';
type Erreur = { section: SectionAvecErreur; texte: string };

// Bloc « Paramètres » recopié dans le prompt de génération de cycle.
// Une ligne par donnée présente ; régime omis si aucun ; null si rien.
// Le régime seul ne justifie pas le bloc : au moins un champ maison requis.
const paramsIaTexte = (p: UserProfile): string | null => {
  const lignes: string[] = [];
  if (p.magasin) lignes.push(`- Magasin : ${p.magasin}`);
  if (p.budgetMax != null) lignes.push(`- Budget courses / semaine : ${formatEuro(p.budgetMax)}`);
  if (p.personnes != null || p.repasJour != null) {
    const parties: string[] = [];
    if (p.personnes != null) parties.push(`${p.personnes}`);
    if (p.repasJour != null) parties.push(`${p.repasJour} repas/jour`);
    lignes.push(`- Personnes à table : ${parties.join(' · ')}`);
  }
  if (p.preferences && p.preferences.length > 0) {
    lignes.push(`- Préférences : ${p.preferences.map((x) => x.toLowerCase()).join(', ')}`);
  }
  if (lignes.length === 0) return null;
  if (p.regime !== 'aucun') lignes.push(`- Régime : ${p.regime}`);
  return lignes.join('\n');
};

export function ProfilScreen({
  profile,
  onBack,
  onChangeProfile,
  onProfileSaved,
  onImported,
}: {
  profile: UserProfile;
  onBack: () => void;
  onChangeProfile: () => void;
  onProfileSaved?: (p: UserProfile) => void;
  onImported: () => void;
}) {
  const [dateNaissance, setDateNaissance] = useState(profile.dateNaissance);
  const [taille, setTaille] = useState(String(profile.taille));
  const [objectifType, setObjectifType] = useState<ObjectifType>(profile.objectif.type);
  const [echeance, setEcheance] = useState(profile.objectif.echeance ?? '');
  const [poidsObjectif, setPoidsObjectif] = useState(
    profile.poidsObjectif != null ? String(profile.poidsObjectif) : '',
  );
  const [complements, setComplements] = useState<string[]>([...profile.complements]);
  const [nouveauComplement, setNouveauComplement] = useState('');
  const [regime, setRegime] = useState<Regime>(profile.regime);
  const [magasin, setMagasin] = useState(profile.magasin ?? '');
  const [budgetMax, setBudgetMax] = useState(profile.budgetMax != null ? String(profile.budgetMax) : '');
  const [personnes, setPersonnes] = useState(profile.personnes != null ? String(profile.personnes) : '');
  const [repasJour, setRepasJour] = useState(profile.repasJour != null ? String(profile.repasJour) : '');
  const [preferences, setPreferences] = useState<string[]>([...(profile.preferences ?? [])]);
  const [nouvellePreference, setNouvellePreference] = useState('');
  const [copie, setCopie] = useState(false);
  const [savedSection, setSavedSection] = useState<Section | null>(null);
  const [erreur, setErreur] = useState<Erreur | null>(null);

  const maj = (section: Section, updated: UserProfile) => {
    saveProfile(updated);
    onProfileSaved?.(updated);
    setSavedSection(section);
  };

  const clearErreur = (section: SectionAvecErreur) =>
    setErreur((e) => (e?.section === section ? null : e));

  const enregistrerInfos = () => {
    const cm = Number.parseInt(taille, 10);
    if (!dateNaissance || Number.isNaN(cm)) {
      setErreur({ section: 'infos', texte: 'Formulaire incomplet : remplis ta date de naissance et ta taille.' });
      return;
    }
    if (dateNaissance > todayISO()) {
      setErreur({ section: 'infos', texte: 'La date de naissance ne peut pas être dans le futur.' });
      return;
    }
    const ans = ageDepuis(dateNaissance);
    if (ans < 10 || ans > 100) {
      setErreur({ section: 'infos', texte: 'Âge calculé invalide : entre 10 et 100 ans.' });
      return;
    }
    if (cm < 120 || cm > 230) {
      setErreur({ section: 'infos', texte: 'Taille invalide : entre 120 et 230 cm.' });
      return;
    }
    clearErreur('infos');
    maj('infos', { ...profile, dateNaissance, taille: cm });
  };

  const enregistrerObjectif = () => {
    const obj = poidsObjectif ? Number.parseFloat(poidsObjectif.replace(',', '.')) : undefined;
    if (poidsObjectif && (obj === undefined || obj < 30 || obj > 250)) {
      setErreur({ section: 'objectif', texte: 'Poids objectif invalide : entre 30 et 250 kg.' });
      return;
    }
    clearErreur('objectif');
    const updated: UserProfile = {
      ...profile,
      objectif: { type: objectifType, ...(echeance ? { echeance } : {}) },
    };
    delete updated.poidsObjectif;
    if (obj != null) updated.poidsObjectif = obj;
    maj('objectif', updated);
  };

  const enregistrerComplements = () => {
    clearErreur('complements');
    maj('complements', { ...profile, complements: [...complements] });
  };

  const enregistrerRegime = () => maj('regime', { ...profile, regime });

  const enregistrerMaison = () => {
    const bud = budgetMax ? parseEuro(budgetMax) : undefined;
    if (bud !== undefined && (bud === null || bud > 10000)) {
      setErreur({ section: 'maison', texte: 'Budget max invalide : entre un montant en euros (ex. 40).' });
      return;
    }
    const pers = personnes ? Number.parseInt(personnes, 10) : undefined;
    if (personnes && (pers === undefined || pers < 1 || pers > 12)) {
      setErreur({ section: 'maison', texte: 'Personnes à table : entre 1 et 12.' });
      return;
    }
    const repas = repasJour ? Number.parseInt(repasJour, 10) : undefined;
    if (repasJour && (repas === undefined || repas < 1 || repas > 12)) {
      setErreur({ section: 'maison', texte: 'Repas par jour : entre 1 et 12.' });
      return;
    }
    clearErreur('maison');
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
    maj('maison', updated);
  };

  const ajouterPreference = () => {
    const v = nouvellePreference.trim().slice(0, 40);
    if (!v) return;
    if (preferences.some((p) => normaliseComplement(p) === normaliseComplement(v))) {
      setErreur({ section: 'maison', texte: 'Cette préférence est déjà sélectionnée.' });
      return;
    }
    clearErreur('maison');
    setCopie(false);
    setPreferences([...preferences, v]);
    setNouvellePreference('');
  };

  const copierParametres = async () => {
    const texte = paramsIaTexte(profile);
    if (!texte) return;
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

  const ajouterComplement = () => {
    const v = nouveauComplement.trim().slice(0, 40);
    if (!v) return;
    if (complements.some((c) => normaliseComplement(c) === normaliseComplement(v))) {
      setErreur({ section: 'complements', texte: 'Ce complément est déjà sélectionné.' });
      return;
    }
    clearErreur('complements');
    setComplements([...complements, v]);
    setNouveauComplement('');
  };

  const changerProfil = () => {
    if (
      window.confirm(
        `Changer de profil ? ${PRENOMS[profile.id]} restera sur ce téléphone avec ses données.`,
      )
    )
      onChangeProfile();
  };

  const fil = (s: Section) =>
    savedSection === s ? (
      <p className="muted" role="status">
        Enregistré ✓
      </p>
    ) : null;

  const alerte = (s: SectionAvecErreur) =>
    erreur?.section === s ? (
      <p className="error" role="alert">
        {erreur.texte}
      </p>
    ) : null;

  return (
    <div className="profil-screen">
      <button type="button" className="profil-back" onClick={onBack}>
        ← Retour
      </button>
      <h1>Profil</h1>

      <section className="profile-section">
        <h3>Mes infos</h3>
        <div className="onboarding-field">
          <label htmlFor="pf-naissance">Date de naissance</label>
          <input
            id="pf-naissance"
            type="date"
            value={dateNaissance}
            onChange={(e) => {
              setSavedSection(null);
              clearErreur('infos');
              setDateNaissance(e.target.value);
            }}
          />
          <p className="onb-hint">
            {dateNaissance
              ? `${ageDepuis(dateNaissance)} ans — calculé automatiquement.`
              : 'Sélectionne ta date de naissance.'}
          </p>
        </div>
        <div className="onboarding-field">
          <label htmlFor="pf-taille">Taille (cm)</label>
          <input
            id="pf-taille"
            type="number"
            inputMode="numeric"
            value={taille}
            onChange={(e) => {
              setSavedSection(null);
              clearErreur('infos');
              setTaille(e.target.value);
            }}
          />
        </div>
        <button type="button" className="btn profil-save" onClick={enregistrerInfos}>
          Enregistrer mes infos
        </button>
        {alerte('infos')}
        {fil('infos')}
      </section>

      <section className="profile-section">
        <h3>Objectif</h3>
        <div className="rline" role="radiogroup" aria-label="Type d'objectif">
          {OBJECTIF_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={objectifType === t.id}
              className={`rl${objectifType === t.id ? ' sel' : ''}`}
              onClick={() => {
                setSavedSection(null);
                clearErreur('objectif');
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
              setSavedSection(null);
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
              setSavedSection(null);
              clearErreur('objectif');
              setPoidsObjectif(e.target.value);
            }}
          />
        </div>
        <button type="button" className="btn profil-save" onClick={enregistrerObjectif}>
          Enregistrer l'objectif
        </button>
        {alerte('objectif')}
        {fil('objectif')}
      </section>

      <section className="profile-section">
        <h3>Compléments</h3>
        <div className="chips">
          {complements.map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              onClick={() => {
                setSavedSection(null);
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
              clearErreur('complements');
              setNouveauComplement(e.target.value);
            }}
          />
          <button type="button" onClick={ajouterComplement}>
            <Icon name="plus" size={13} /> Ajouter
          </button>
        </div>
        <button type="button" className="btn profil-save" onClick={enregistrerComplements}>
          Enregistrer les compléments
        </button>
        {alerte('complements')}
        {fil('complements')}
      </section>

      <section className="profile-section">
        <h3>Régime</h3>
        <div className="rline" role="radiogroup" aria-label="Régime">
          {REGIMES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={regime === r.id}
              className={`rl${regime === r.id ? ' sel' : ''}`}
              onClick={() => {
                setSavedSection(null);
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
        {fil('regime')}
      </section>

      <section className="profile-section">
        <h3>Maison &amp; courses</h3>
        <div className="onboarding-field">
          <label htmlFor="pf-magasin">Magasin habituel</label>
          <input
            id="pf-magasin"
            type="text"
            list="pf-magasins"
            placeholder="Lidl, Intermarché…"
            value={magasin}
            onChange={(e) => {
              setSavedSection(null);
              setCopie(false);
              clearErreur('maison');
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
              setSavedSection(null);
              setCopie(false);
              clearErreur('maison');
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
                setSavedSection(null);
                setCopie(false);
                clearErreur('maison');
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
                setSavedSection(null);
                setCopie(false);
                clearErreur('maison');
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
                setSavedSection(null);
                setCopie(false);
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
              setCopie(false);
              clearErreur('maison');
              setNouvellePreference(e.target.value);
            }}
          />
          <button type="button" onClick={ajouterPreference}>
            <Icon name="plus" size={13} /> Ajouter
          </button>
        </div>
        <button type="button" className="btn profil-save" onClick={enregistrerMaison}>
          Enregistrer maison &amp; courses
        </button>
        {alerte('maison')}
        {fil('maison')}
      </section>

      <section className="profile-section">
        <h3>Génération IA</h3>
        {paramsIaTexte(profile) !== null && (
          <>
            <p className="onb-hint">
              Ces réglages complètent les « Paramètres » du prompt de génération de cycle — recopie-les d'un geste.
            </p>
            <button type="button" className="profil-ghost" onClick={copierParametres}>
              Copier les paramètres IA
            </button>
            {copie && (
              <p className="muted" role="status">
                Paramètres copiés ✓ — colle-les dans le prompt.
              </p>
            )}
          </>
        )}
      </section>

      <section className="profile-section">
        <h3>Semaine</h3>
        <ImportButton onImported={onImported} label="Importer un cycle (.md)" />
      </section>

      <section className="profile-section">
        <h3>Compte</h3>
        <button type="button" className="profil-switch" onClick={changerProfil}>
          Changer de profil
        </button>
      </section>

      <p className="muted profil-about">
        Rituel v{__APP_VERSION__} — vos données restent sur votre téléphone.
      </p>
    </div>
  );
}
