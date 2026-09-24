import { useState } from 'react';
import { ageDepuis, todayISO } from '../../lib/dates';
import type { UserProfile } from '../../lib/model';
import { saveProfile } from '../../lib/storage';
import { Alerte, Fil } from './presente';

// Page détail « Mes infos » — le retour ‹ est géré par ProfilScreen.
export function ProfilInfos({
  profile,
  onProfileSaved,
}: {
  profile: UserProfile;
  onProfileSaved?: (p: UserProfile) => void;
}) {
  const [prenom, setPrenom] = useState(profile.prenom ?? '');
  const [dateNaissance, setDateNaissance] = useState(profile.dateNaissance ?? '');
  const [taille, setTaille] = useState(profile.taille != null ? String(profile.taille) : '');
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pattern render-phase reset (cf. ProfileView) : la page re-synchronise
  // la prop profile (réouverture, enregistrement aval) sans remount.
  const [synced, setSynced] = useState(profile.id);
  if (synced !== profile.id) {
    setSynced(profile.id);
    setPrenom(profile.prenom ?? '');
    setDateNaissance(profile.dateNaissance ?? '');
    setTaille(profile.taille != null ? String(profile.taille) : '');
    setSaved(false);
    setErreur(null);
  }

  const enregistrerInfos = () => {
    const cm = taille ? Number.parseInt(taille, 10) : undefined;
    if ((dateNaissance || taille) && (!dateNaissance || cm === undefined || Number.isNaN(cm))) {
      setErreur('Formulaire incomplet : remplis ta date de naissance et ta taille.');
      return;
    }
    if (dateNaissance) {
      if (dateNaissance > todayISO()) {
        setErreur('La date de naissance ne peut pas être dans le futur.');
        return;
      }
      const ans = ageDepuis(dateNaissance);
      if (ans < 10 || ans > 100) {
        setErreur('Âge calculé invalide : entre 10 et 100 ans.');
        return;
      }
    }
    if (cm != null && (cm < 120 || cm > 230)) {
      setErreur('Taille invalide : entre 120 et 230 cm.');
      return;
    }
    setErreur(null);
    // Pattern delete + re-set : un champ vidé retire la donnée — un profil
    // partiel (prénom seul) est un état valide, jamais une valeur vide écrite.
    const updated: UserProfile = { ...profile };
    delete updated.prenom;
    delete updated.dateNaissance;
    delete updated.taille;
    if (prenom.trim()) updated.prenom = prenom.trim();
    if (dateNaissance) updated.dateNaissance = dateNaissance;
    if (cm != null) updated.taille = cm;
    saveProfile(updated);
    onProfileSaved?.(updated);
    setSaved(true);
  };

  return (
    <section className="detail-page">
      <h2>Mes infos</h2>
      <div className="onboarding-field">
        <label htmlFor="pf-prenom">Prénom</label>
        <input
          id="pf-prenom"
          type="text"
          maxLength={20}
          value={prenom}
          onChange={(e) => {
            setSaved(false);
            setPrenom(e.target.value);
          }}
        />
        <p className="onb-hint">Utilisé dans les salutations et le prompt IA.</p>
      </div>
      <div className="onboarding-field">
        <label htmlFor="pf-naissance">Date de naissance</label>
        <input
          id="pf-naissance"
          type="date"
          value={dateNaissance}
          onChange={(e) => {
            setSaved(false);
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
            setSaved(false);
            setTaille(e.target.value);
          }}
        />
      </div>
      <button type="button" className="btn profil-save" onClick={enregistrerInfos}>
        Enregistrer mes infos
      </button>
      <Alerte texte={erreur} />
      <Fil active={saved} />
    </section>
  );
}
