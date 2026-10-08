import { useState } from 'react';
import { formatJourMoisCourt, todayISO } from '../../lib/dates';
import { COMPLEMENTS_PRESETS, OBJECTIF_TYPES, REGIMES, estSuivi, normaliseComplement } from '../../lib/model';
import type { ObjectifType, Regime, UserProfile } from '../../lib/model';
import { poidsActuel, resumeObjectif } from '../../lib/stats';
import { getWeights, saveProfile } from '../../lib/storage';
import { Icon } from '../Icon';
import { Alerte, Fil } from './presente';

const kg = (n: number): string => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`;
const signe = (n: number): string => (n > 0 ? `+${kg(n)}` : n < 0 ? `−${kg(-n)}` : kg(0));
const parsePoids = (s: string): number | undefined => (s ? Number.parseFloat(s.replace(',', '.')) : undefined);

// Page détail « Objectif » (spec 2026-10-07 §4, maquette écran F) : résumé
// chiffré (dernière pesée → poids visé, rythme), cap en cartes, régime et
// compléments en chips, un seul « Enregistrer » collé en bas.
export function ProfilObjectif({
  profile,
  onProfileSaved,
}: {
  profile: UserProfile;
  onProfileSaved?: (p: UserProfile) => void;
}) {
  const [suivi, setSuivi] = useState(estSuivi(profile));
  const [objectifType, setObjectifType] = useState<ObjectifType>(profile.objectif.type);
  const [echeance, setEcheance] = useState(profile.objectif.echeance ?? '');
  const [poidsVise, setPoidsVise] = useState(profile.poidsObjectif != null ? String(profile.poidsObjectif) : '');
  const [regime, setRegime] = useState<Regime>(profile.regime);
  const [complements, setComplements] = useState<string[]>([...profile.complements]); // cochés, dans l'ordre
  const [libres, setLibres] = useState<string[]>(() =>
    profile.complements.filter((c) => !COMPLEMENTS_PRESETS.some((p) => normaliseComplement(p) === normaliseComplement(c))),
  );
  const [autreOuvert, setAutreOuvert] = useState(false);
  const [autre, setAutre] = useState('');
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pattern render-phase reset (cf. ProfileView) : la page re-synchronise
  // la prop profile (réouverture, changement de profil) sans remount.
  const [synced, setSynced] = useState(profile.id);
  if (synced !== profile.id) {
    setSynced(profile.id);
    setSuivi(estSuivi(profile));
    setObjectifType(profile.objectif.type);
    setEcheance(profile.objectif.echeance ?? '');
    setPoidsVise(profile.poidsObjectif != null ? String(profile.poidsObjectif) : '');
    setRegime(profile.regime);
    setComplements([...profile.complements]);
    setSaved(false);
    setErreur(null);
  }

  const modifie = () => {
    setSaved(false);
    setErreur(null);
  };

  const actuel = poidsActuel(getWeights(profile.id))?.kg ?? null;
  const vise = parsePoids(poidsVise);
  const resume = resumeObjectif(actuel, vise != null && vise >= 30 && vise <= 250 ? vise : undefined, echeance || undefined, todayISO());
  const rythme = resume?.kgParSemaine != null ? `≈ ${resume.kgParSemaine.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg / semaine` : null;

  const basculer = (c: string) => {
    modifie();
    setComplements(complements.includes(c) ? complements.filter((x) => x !== c) : [...complements, c]);
  };

  const ajouterAutre = () => {
    const v = autre.trim().slice(0, 40);
    if (!v) return;
    if ([...COMPLEMENTS_PRESETS, ...libres].some((c) => normaliseComplement(c) === normaliseComplement(v))) {
      setErreur('Ce complément est déjà dans la liste.');
      return;
    }
    modifie();
    setLibres([...libres, v]);
    setComplements([...complements, v]);
    setAutre('');
  };

  const enregistrer = () => {
    if (poidsVise && (vise === undefined || Number.isNaN(vise) || vise < 30 || vise > 250)) {
      setErreur('Poids visé invalide : entre 30 et 250 kg.');
      return;
    }
    const updated: UserProfile = {
      ...profile,
      ...(suivi ? {} : { suivi: false }),
      objectif: { type: objectifType, ...(echeance ? { echeance } : {}) },
      regime,
      complements: [...complements],
    };
    if (suivi) delete updated.suivi; // absent = suivi
    delete updated.poidsObjectif;
    if (vise != null) updated.poidsObjectif = vise;
    saveProfile(updated);
    onProfileSaved?.(updated);
    setErreur(null);
    setSaved(true);
  };

  return (
    <section className="detail-page objectif-page">
      <h2>Objectif</h2>

      <section className="profile-section">
        <label className="interrupteur">
          <input
            type="checkbox"
            role="switch"
            checked={suivi}
            onChange={() => {
              modifie();
              setSuivi(!suivi);
            }}
          />
          <span>
            Suivre mon poids et un objectif
            <span className="muted">Désactivé : plus d’onglet Suivi, portions adulte standard.</span>
          </span>
        </label>
      </section>

      {!suivi && (
        <p className="suivi-off">
          Suivi coupé : Rituel reste une app de routine. Ton régime et tes compléments servent toujours aux menus.
        </p>
      )}

      {suivi && (
        <>
          <div className="obj-resume" aria-live="polite">
            {actuel == null ? (
              <p className="obj-ecart">Pèse-toi dans Suivi pour voir l’écart.</p>
            ) : !resume ? (
              <>
                <p className="obj-poids">{kg(actuel)}</p>
                <p className="obj-ecart">Fixe un poids visé pour voir l’écart.</p>
              </>
            ) : (
              <>
                <p className="obj-poids">
                  <span>{kg(resume.actuel)}</span>
                  <span className="obj-fleche" aria-hidden="true">→</span>
                  <span className="obj-vise">{kg(resume.vise)}</span>
                </p>
                <p className="obj-ecart">
                  {signe(resume.ecart)}
                  {echeance && rythme ? ` · d’ici le ${formatJourMoisCourt(echeance)}` : ''}
                </p>
                {rythme && <p className="obj-rythme">{rythme}</p>}
              </>
            )}
          </div>

          <section className="profile-section" aria-labelledby="obj-cap">
            <h3 id="obj-cap">Ton cap</h3>
            <div className="rcards" role="radiogroup" aria-labelledby="obj-cap">
              {OBJECTIF_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={objectifType === t.id}
                  className="rcard"
                  onClick={() => {
                    modifie();
                    setObjectifType(t.id);
                  }}
                >
                  <span className="rcard-i" aria-hidden="true">
                    <Icon name={t.icone} size={18} />
                  </span>
                  <span className="rcard-t">{t.nom}</span>
                  <span className="rcard-d">{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="onb-row2">
              <div className="onboarding-field">
                <label htmlFor="pf-obj-poids">Poids visé (kg)</label>
                <input
                  id="pf-obj-poids"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={poidsVise}
                  onChange={(e) => {
                    modifie();
                    setPoidsVise(e.target.value);
                  }}
                />
              </div>
              <div className="onboarding-field">
                <label htmlFor="pf-echeance">Échéance (optionnelle)</label>
                <input
                  id="pf-echeance"
                  type="date"
                  value={echeance}
                  onChange={(e) => {
                    modifie();
                    setEcheance(e.target.value);
                  }}
                />
              </div>
            </div>
            {resume?.ambitieux && (
              <p className="alerte-douce" role="note">
                <Icon name="info" size={16} />
                <span>
                  <b>Rythme ambitieux</b> — au-delà de 1 kg par semaine, c’est dur à tenir : tu peux reculer l’échéance.
                  Rien n’est bloqué.
                </span>
              </p>
            )}
          </section>

        </>
      )}

      <section className="profile-section" aria-labelledby="obj-regime">
        <h3 id="obj-regime">Régime</h3>
        <div className="chips" role="radiogroup" aria-labelledby="obj-regime">
          {REGIMES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={regime === r.id}
              className="chip"
              onClick={() => {
                modifie();
                setRegime(r.id);
              }}
            >
              {r.nom}
            </button>
          ))}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="obj-comp">
        <h3 id="obj-comp">Compléments</h3>
        <p className="onb-hint">Touche pour cocher ou décocher.</p>
        <div className="chips">
          {[...COMPLEMENTS_PRESETS, ...libres].map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={complements.includes(c)} onClick={() => basculer(c)}>
              {c}
            </button>
          ))}
          <button
            type="button"
            className="chip chip-autre"
            aria-expanded={autreOuvert}
            onClick={() => setAutreOuvert(!autreOuvert)}
          >
            <Icon name="plus" size={14} /> Autre…
          </button>
        </div>
        {autreOuvert && (
          <div className="addrow">
            <input
              value={autre}
              maxLength={40}
              placeholder="Ex. Spiruline"
              aria-label="Autre complément"
              onChange={(e) => {
                setErreur(null);
                setAutre(e.target.value);
              }}
            />
            <button type="button" onClick={ajouterAutre}>
              Ajouter
            </button>
          </div>
        )}
      </section>

      <div className="pied-collant">
        <Alerte texte={erreur} />
        <Fil active={saved} />
        <button type="button" className="bouton-plein" onClick={enregistrer}>
          Enregistrer
        </button>
      </div>
    </section>
  );
}
