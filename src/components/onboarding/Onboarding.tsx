import { useState } from 'react';
import {
  COMPLEMENTS_PRESETS,
  MAGASINS_PRESETS,
  OBJECTIF_TYPES,
  PREFERENCES_PRESETS,
  PROFILS_META,
  REGIMES,
  normaliseComplement,
  nouvelIdProfil,
} from '../../lib/model';
import type { ObjectifType, ProfilLegacy, Regime, UserProfile } from '../../lib/model';
import { foyerParDefaut, loadFoyer, saveFoyer } from '../../lib/cycle/etat';
import { ajouterAdulte, ajouterEnfant } from '../../lib/cycle/foyer';
import { EtapeBienvenue } from './EtapeBienvenue';
import { SAISIE_VIDE, type SaisieFoyer } from './saisie';
import { PartageFoyer } from './PartageFoyer';
import { ageDepuis, todayISO } from '../../lib/dates';
import { parseEuro } from '../../lib/prix';
import { addWeight, getWeights, saveProfile } from '../../lib/storage';
import { syncActif } from '../../lib/sync/config';
import { lireSession } from '../../lib/sync/session';
import { Icon } from '../Icon';

export function Onboarding({
  onDone,
  prefill,
}: {
  // foyerLocal : le foyer du téléphone vient de cette inscription (créé ici ou
  // « plus tard ») → l'app enchaîne sur « Ta semaine » ; false = foyer rejoint.
  onDone: (profile: UserProfile, foyerLocal: boolean) => void;
  prefill?: ProfilLegacy;
}) {
  // Migration : démarrer directement à l'étape 2, profil verrouillé (pas d'étape 1).
  // Étape 6 (« Synchroniser les téléphones ») : optionnelle, atteinte seulement
  // si la sync est active et qu'aucune session foyer n'existe encore.
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(prefill ? 2 : 1);
  // id : celui du profil historique en migration, sinon créé en quittant l'étape 1.
  const [id, setId] = useState<string | null>(prefill?.id ?? null);
  const [saisie, setSaisie] = useState<SaisieFoyer>(prefill ? { ...SAISIE_VIDE, suivi: true } : SAISIE_VIDE);
  const prenom = saisie.prenom.trim() || (prefill ? PROFILS_META[prefill.id].nom : '');
  const [poids, setPoids] = useState(() => {
    if (!prefill) return '';
    const list = getWeights(prefill.id);
    const last = list.length > 0 ? list[list.length - 1] : undefined;
    return last ? String(last.kg) : '';
  });
  const [dateNaissance, setDateNaissance] = useState('');
  const [taille, setTaille] = useState(prefill ? String(prefill.taille) : '');
  const [objectifType, setObjectifType] = useState<ObjectifType>('perte');
  const [echeance, setEcheance] = useState('');
  const [poidsObjectif, setPoidsObjectif] = useState(
    prefill?.poidsObjectif != null ? String(prefill.poidsObjectif) : '',
  );
  const [complements, setComplements] = useState<string[]>([]);
  const [nouveauComplement, setNouveauComplement] = useState('');
  const [regime, setRegime] = useState<Regime>('aucun');
  const [magasin, setMagasin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [nouvellePreference, setNouvellePreference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [profileFinal, setProfileFinal] = useState<UserProfile | null>(null);

  const migration = prefill != null;

  const aller = (n: 1 | 2 | 3 | 4 | 5 | 6) => {
    setError(null);
    setStep(n);
  };

  const continuerBienvenue = () => {
    if (!saisie.prenom.trim()) {
      setError('Ton prénom, pour commencer.');
      return;
    }
    if (!id) setId(nouvelIdProfil(saisie.prenom));
    aller(saisie.suivi ? 2 : 4);
  };

  // Sans suivi, les étapes corps / objectif n'existent pas : retour de 4 → 1.
  const retour = () => aller((step === 4 && !saisie.suivi ? 1 : Math.max(1, step - 1)) as 1 | 2 | 3 | 4 | 5 | 6);

  // Valide l'étape 2 et retourne le poids/taille parsés, ou null avec un message.
  // En migration, le poids est optionnel (champ vide si aucune pesée enregistrée —
  // la seule saisie obligatoire est la date de naissance).
  const validerInfos = (): { kg: number | null; cm: number } | null => {
    const kg = poids ? Number.parseFloat(poids.replace(',', '.')) : Number.NaN;
    const cm = Number.parseInt(taille, 10);
    if (
      !dateNaissance ||
      !taille ||
      Number.isNaN(cm) ||
      (!migration && (!poids || Number.isNaN(kg)))
    ) {
      // En migration le poids est optionnel : ne citer que ce qui manque vraiment.
      const manques: string[] = [];
      if (!migration && (!poids || Number.isNaN(kg))) manques.push('ton poids');
      if (!dateNaissance) manques.push('ta date de naissance');
      if (!taille || Number.isNaN(cm)) manques.push('ta taille');
      const liste =
        manques.length > 1
          ? `${manques.slice(0, -1).join(', ')} et ${manques[manques.length - 1]}`
          : manques[0];
      setError(`Formulaire incomplet : remplis ${liste}.`);
      return null;
    }
    if (poids && (Number.isNaN(kg) || kg < 30 || kg > 250)) {
      setError('Poids invalide : entre 30 et 250 kg.');
      return null;
    }
    if (dateNaissance > todayISO()) {
      setError('La date de naissance ne peut pas être dans le futur.');
      return null;
    }
    const ans = ageDepuis(dateNaissance);
    if (ans < 10 || ans > 100) {
      setError('Âge calculé invalide : entre 10 et 100 ans.');
      return null;
    }
    if (cm < 120 || cm > 230) {
      setError('Taille invalide : entre 120 et 230 cm.');
      return null;
    }
    return { kg: poids ? kg : null, cm };
  };

  const continuerInfos = () => {
    if (validerInfos()) aller(3);
  };

  const continuerObjectif = () => {
    const obj = poidsObjectif ? Number.parseFloat(poidsObjectif.replace(',', '.')) : undefined;
    if (poidsObjectif && (obj === undefined || obj < 30 || obj > 250)) {
      setError('Poids objectif invalide : entre 30 et 250 kg.');
      return;
    }
    setError(null);
    aller(4);
  };

  const ajouterComplement = () => {
    const v = nouveauComplement.trim().slice(0, 40);
    if (!v) return;
    if (complements.some((c) => normaliseComplement(c) === normaliseComplement(v))) {
      setError('Ce complément est déjà sélectionné.');
      return;
    }
    setError(null);
    setComplements([...complements, v]);
    setNouveauComplement('');
  };

  const basculerPreset = (preset: string) => {
    setError(null);
    setComplements((cs) =>
      cs.some((c) => normaliseComplement(c) === normaliseComplement(preset))
        ? cs.filter((c) => normaliseComplement(c) !== normaliseComplement(preset))
        : [...cs, preset],
    );
  };

  const ajouterPreference = () => {
    const v = nouvellePreference.trim().slice(0, 40);
    if (!v) return;
    if (preferences.some((p) => normaliseComplement(p) === normaliseComplement(v))) {
      setError('Cette préférence est déjà sélectionnée.');
      return;
    }
    setError(null);
    setPreferences([...preferences, v]);
    setNouvellePreference('');
  };

  const basculerPreference = (preset: string) => {
    setError(null);
    setPreferences((ps) =>
      ps.some((p) => normaliseComplement(p) === normaliseComplement(preset))
        ? ps.filter((p) => normaliseComplement(p) !== normaliseComplement(preset))
        : [...ps, preset],
    );
  };

  // Étape 5 : tout est optionnel — seules les valeurs remplies sont contraintes.
  const validerMaison = (): boolean => {
    if (budgetMax) {
      const bud = parseEuro(budgetMax);
      if (bud === null || bud > 10000) {
        setError('Budget max invalide : entre un montant en euros (ex. 40).');
        return false;
      }
    }
    return true;
  };

  // Enregistrement final tolérant : chaque champ présent est validé (mêmes
  // bornes que les « Continuer »), chaque champ absent est simplement omis —
  // l'onboarding est tout sautable, le profil peut rester partiel.
  const valider = () => {
    const cm = taille ? Number.parseInt(taille, 10) : undefined;
    if (taille && (cm === undefined || cm < 120 || cm > 230)) {
      setError('Taille invalide : entre 120 et 230 cm.');
      return;
    }
    if (dateNaissance) {
      if (dateNaissance > todayISO()) {
        setError('La date de naissance ne peut pas être dans le futur.');
        return;
      }
      const ans = ageDepuis(dateNaissance);
      if (ans < 10 || ans > 100) {
        setError('Âge calculé invalide : entre 10 et 100 ans.');
        return;
      }
    }
    const kg = poids ? Number.parseFloat(poids.replace(',', '.')) : Number.NaN;
    if (poids && (Number.isNaN(kg) || kg < 30 || kg > 250)) {
      setError('Poids invalide : entre 30 et 250 kg.');
      return;
    }
    const obj = poidsObjectif ? Number.parseFloat(poidsObjectif.replace(',', '.')) : undefined;
    if (poidsObjectif && (obj === undefined || obj < 30 || obj > 250)) {
      setError('Poids objectif invalide : entre 30 et 250 kg.');
      return;
    }
    if (!validerMaison()) return;
    if (!id) return;
    const profile: UserProfile = {
      id,
      ...(saisie.suivi ? {} : { suivi: false }),
      ...(dateNaissance ? { dateNaissance } : {}),
      ...(cm != null ? { taille: cm } : {}),
      ...(saisie.prenom.trim() ? { prenom: saisie.prenom.trim() } : {}),
      ...(obj != null ? { poidsObjectif: obj } : {}),
      objectif: { type: objectifType, ...(echeance ? { echeance } : {}) },
      complements: [...complements],
      regime,
      ...(magasin.trim() ? { magasin: magasin.trim() } : {}),
      ...(budgetMax ? { budgetMax: parseEuro(budgetMax)! } : {}),
      ...(preferences.length > 0 ? { preferences: [...preferences] } : {}),
    };
    saveProfile(profile);
    if (!Number.isNaN(kg)) addWeight(id, todayISO(), kg);
    // Inscription : le foyer naît de l'étape 1 (sauf foyer déjà présent sur ce
    // téléphone — changement de profil : assurerMoi m'y ajoutera).
    const foyerLocal = !loadFoyer();
    if (!migration && foyerLocal) {
      let f = foyerParDefaut(profile);
      if (saisie.pourQui !== 'moi') f = ajouterAdulte(f, saisie.partenaire);
      if (saisie.pourQui === 'famille') for (const e of saisie.enfants) f = ajouterEnfant(f, e);
      saveFoyer(f);
    }
    // Sync active sans session foyer (première installation) : créer /
    // rejoindre un foyer, optionnel — sinon on termine comme avant.
    if (syncActif() && !lireSession()) {
      setProfileFinal(profile);
      aller(6);
      return;
    }
    onDone(profile, foyerLocal);
  };

  return (
    <div className="onboarding">
      {!migration && (
        <div className="onboarding-dots" role="group" aria-label="Progression de l'onboarding">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= step ? 'onboarding-dot-active' : undefined} />
          ))}
        </div>
      )}

      {migration && (
        <p className="onb-note">
          <Icon name="check" size={16} />
          <span>
            <b>Une mise à jour 👋</b> — ton profil existe déjà : on l'a prérempli. Vérifie et
            complète ta <b>date de naissance</b>, c'est tout.
          </span>
        </p>
      )}

      {step === 1 && (
        <EtapeBienvenue
          saisie={saisie}
          onChange={(v) => {
            setError(null);
            setSaisie(v);
          }}
          onContinuer={continuerBienvenue}
        />
      )}
      {step === 1 && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {step === 6 && profileFinal && (
        <PartageFoyer profil={profileFinal} onTermine={onDone} onPlusTard={() => onDone(profileFinal, !lireSession())} />
      )}

      {step >= 2 && step <= 5 && id && (
        <form
          className="onboarding-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 2) continuerInfos();
            else if (step === 3) continuerObjectif();
            else if (step === 4) aller(5);
            else valider();
          }}
        >
          {step === 2 && (
            <>
              <h1>Salut {prenom} 👋</h1>
              <p className="onboarding-sub">
                {migration ? 'On met ton profil à niveau.' : 'Tes bases, pour tes suivis.'}
              </p>
              {migration && (
                <p className="mig-prof">
                  <span>
                    Profil : {prenom}
                  </span>
                  <span>non modifiable ici</span>
                </p>
              )}
              <div className="onboarding-field">
                <label htmlFor="ob-poids">Poids (kg)</label>
                <input
                  id="ob-poids"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={poids}
                  onChange={(e) => {
                    setError(null);
                    setPoids(e.target.value);
                  }}
                />
                {migration && <p className="onb-hint">Dernière pesée enregistrée — modifiable si besoin.</p>}
              </div>
              <div className="onboarding-field">
                <label htmlFor="ob-naissance" className={migration ? 'onb-req' : undefined}>
                  Date de naissance
                </label>
                <input
                  id="ob-naissance"
                  type="date"
                  value={dateNaissance}
                  onChange={(e) => {
                    setError(null);
                    setDateNaissance(e.target.value);
                  }}
                />
                <p className="onb-hint">
                  {migration
                    ? 'Nouvelle saisie obligatoire : ton âge devient calculé.'
                    : 'Ton âge se calcule tout seul — plus rien à mettre à jour chaque année.'}
                </p>
              </div>
              <div className="onboarding-field">
                <label htmlFor="ob-taille">Taille (cm)</label>
                <input
                  id="ob-taille"
                  type="number"
                  inputMode="numeric"
                  value={taille}
                  onChange={(e) => {
                    setError(null);
                    setTaille(e.target.value);
                  }}
                />
              </div>
              {migration && (
                <div className="onboarding-field">
                  <label htmlFor={`ob-obj-poids-${step}`}>Poids objectif (kg)</label>
                  <input
                    id={`ob-obj-poids-${step}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={poidsObjectif}
                    onChange={(e) => {
                      setError(null);
                      setPoidsObjectif(e.target.value);
                    }}
                  />
                  <p className="onb-hint">Repris de ton ancien profil — modifiable si besoin.</p>
                </div>
              )}
              <div className="onb-btnrow">
                {!migration && (
                  <button type="button" className="onb-back" onClick={retour}>
                    Retour
                  </button>
                )}
                <button
                  type="button"
                  className="onb-skip"
                  onClick={() => aller((step + 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                >
                  Passer
                </button>
                <button type="button" className="onb-next" onClick={continuerInfos}>
                  Continuer <Icon name="chev-right" size={14} />
                </button>
              </div>
              {migration && (
                <p className="onb-hint">Ensuite : objectif, personnalisation puis maison &amp; courses.</p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1>Ton objectif</h1>
              <p className="onboarding-sub">Pour que l'app te suive dans la bonne direction.</p>
              <div className="rcards" role="radiogroup" aria-label="Type d'objectif">
                {OBJECTIF_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={objectifType === t.id}
                    className={`rcard${objectifType === t.id ? ' sel' : ''}`}
                    onClick={() => {
                      setError(null);
                      setObjectifType(t.id);
                    }}
                  >
                    <span className="rcard-t">
                      <Icon name={t.icone} size={14} />
                      {t.nom}
                    </span>
                    <span className="rcard-d">{t.desc}</span>
                  </button>
                ))}
              </div>
              <div className="onboarding-field">
                <label htmlFor="ob-echeance">
                  Échéance <span className="onb-opt">(optionnelle)</span>
                </label>
                <input
                  id="ob-echeance"
                  type="date"
                  value={echeance}
                  onChange={(e) => {
                    setError(null);
                    setEcheance(e.target.value);
                  }}
                />
              </div>
              <div className="onboarding-field">
                <label htmlFor={`ob-obj-poids-${step}`}>Poids objectif (kg)</label>
                <input
                  id={`ob-obj-poids-${step}`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={poidsObjectif}
                  onChange={(e) => {
                    setError(null);
                    setPoidsObjectif(e.target.value);
                  }}
                />
              </div>
              <div className="onb-btnrow">
                <button type="button" className="onb-back" onClick={retour}>
                  Retour
                </button>
                <button
                  type="button"
                  className="onb-skip"
                  onClick={() => aller((step + 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                >
                  Passer
                </button>
                <button type="button" className="onb-next" onClick={continuerObjectif}>
                  Continuer <Icon name="chev-right" size={14} />
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1>Personnalisation</h1>
              <p className="onboarding-sub">
                Tes compléments et ton régime — modifiable plus tard dans le profil.
              </p>
              <p className="onb-label">Compléments</p>
              <div className="chips">
                {COMPLEMENTS_PRESETS.map((preset) => {
                  const on = complements.some((c) => normaliseComplement(c) === normaliseComplement(preset));
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`chip${on ? ' on' : ''}`}
                      aria-pressed={on}
                      onClick={() => basculerPreset(preset)}
                    >
                      {preset}
                    </button>
                  );
                })}
                {complements
                  .filter((c) => !COMPLEMENTS_PRESETS.some((p) => normaliseComplement(p) === normaliseComplement(c)))
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="chip on"
                      aria-pressed="true"
                      onClick={() => {
                        setError(null);
                        setComplements(complements.filter((x) => x !== c));
                      }}
                    >
                      {c}
                      <span className="rm" aria-hidden="true">
                        ✕
                      </span>
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
                    setError(null);
                    setNouveauComplement(e.target.value);
                  }}
                />
                <button type="button" onClick={ajouterComplement}>
                  <Icon name="plus" size={14} /> Ajouter
                </button>
              </div>
              <p className="onb-label">Régime</p>
              <div className="rline" role="radiogroup" aria-label="Régime">
                {REGIMES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={regime === r.id}
                    className={`rl${regime === r.id ? ' sel' : ''}`}
                    onClick={() => {
                      setError(null);
                      setRegime(r.id);
                    }}
                  >
                    <span className="rl-dot" aria-hidden="true" />
                    {r.nom}
                  </button>
                ))}
              </div>
              <div className="onb-btnrow">
                <button type="button" className="onb-back" onClick={retour}>
                  Retour
                </button>
                <button
                  type="button"
                  className="onb-skip"
                  onClick={() => aller((step + 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                >
                  Passer
                </button>
                <button type="button" className="onb-next" onClick={() => aller(5)}>
                  Continuer <Icon name="chev-right" size={14} />
                </button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h1>Maison &amp; courses</h1>
              <p className="onboarding-sub">
                Dernière étape — pour les listes, le budget et les prochains cycles. Tout est optionnel.
              </p>
              <div className="onboarding-field">
                <label htmlFor="ob-magasin">Magasin habituel</label>
                <input
                  id="ob-magasin"
                  type="text"
                  list="ob-magasins"
                  placeholder="Lidl, Intermarché…"
                  value={magasin}
                  onChange={(e) => {
                    setError(null);
                    setMagasin(e.target.value);
                  }}
                />
                <datalist id="ob-magasins">
                  {MAGASINS_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div className="onboarding-field">
                <label htmlFor="ob-budget">Budget max courses / semaine (€, optionnel)</label>
                <input
                  id="ob-budget"
                  type="text"
                  inputMode="decimal"
                  value={budgetMax}
                  onChange={(e) => {
                    setError(null);
                    setBudgetMax(e.target.value);
                  }}
                />
                <p className="onb-hint">
                  Le plafond à ne pas dépasser — l'app compare l'estimé du menu et ce que tu paies vraiment.
                </p>
              </div>
              <p className="onb-label">Préférences pour les prochains cycles</p>
              <div className="chips">
                {PREFERENCES_PRESETS.map((preset) => {
                  const on = preferences.some(
                    (p) => normaliseComplement(p) === normaliseComplement(preset),
                  );
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`chip${on ? ' on' : ''}`}
                      aria-pressed={on}
                      onClick={() => basculerPreference(preset)}
                    >
                      {preset}
                    </button>
                  );
                })}
                {preferences
                  .filter((p) => !PREFERENCES_PRESETS.some((preset) => normaliseComplement(preset) === normaliseComplement(p)))
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="chip on"
                      aria-pressed="true"
                      onClick={() => basculerPreference(p)}
                    >
                      {p}
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
                    setError(null);
                    setNouvellePreference(e.target.value);
                  }}
                />
                <button type="button" onClick={ajouterPreference}>
                  <Icon name="plus" size={14} /> Ajouter
                </button>
              </div>
              <button type="submit" className="onboarding-cta onb-full">
                C'est parti ! 🚀
              </button>
              <div className="onb-btnrow">
                <button type="button" className="onb-back" onClick={retour}>
                  Retour
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
