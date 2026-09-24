import { useEffect, useState } from 'react';
import { MAGASINS_PRESETS, normaliseComplement, prenomProfil } from '../lib/model';
import type { UserProfile } from '../lib/model';
import { parseEuro } from '../lib/prix';
import { getWeights, saveProfile } from '../lib/storage';
import { assemblePromptIa } from '../lib/promptIa';
import {
  connecterFoyer,
  deconnecterFoyer,
  lireSessionPub,
  purgerFoyer,
} from '../lib/sync/engine';
import type { SyncEtat } from '../lib/sync/engine';
import { messageConnexion } from '../lib/sync/messages';
import { configDefaut } from '../lib/push/module';
import type { PushConfig, RappelPush } from '../lib/push/module';
import {
  desabonner,
  majConfig,
  souscrireEtEnregistrer,
} from '../lib/push/module';
import { pushActif } from '../lib/push/config';
import {
  resumeDuo,
  resumeInfos,
  resumeMaison,
  resumeNotifications,
  resumeObjectif,
} from '../lib/resumes';
import { ImportButton } from './ImportButton';
import { Icon } from './Icon';
import { ProfilInfos } from './profil/ProfilInfos';
import { ProfilObjectif } from './profil/ProfilObjectif';
import { Alerte, Fil } from './profil/presente';

// Navigation interne : hub (vue générale) ou page détail.
type Vue = 'hub' | 'objectif' | 'infos' | 'maison' | 'notifs' | 'foyer';

// Message d'état en vue connectée (texte simple — pas de symbole).
const ETAT_SYNC: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Synchronisation : en attente.',
  sync: 'Synchronisé.',
  erreur: 'Synchronisation : erreur.',
};

// ——— Pages détail transitoires (Inlines) : le JSX des sections actuelles est
// enveloppé dans une page détail ; les Tasks 4-7 les extraient vers
// src/components/profil/. Code déplacé, pas réécrit. ———

// Page détail « Maison & courses » — magasin, budget, personnes à table,
// repas/jour, préférences des prochains cycles.
function MaisonInline({
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

// Page détail « Notifications » — les états push restent dans ProfilScreen
// (le hub en a besoin pour la tuile + son résumé).
function PushInline({
  pushOn,
  pushErreur,
  pushConfig,
  pushBasculer,
  pushToggleEvenement,
  pushAjouterRappel,
  pushSupprimerRappel,
  pushMajRappel,
  pushToggleJour,
}: {
  pushOn: boolean;
  pushErreur: string | null;
  pushConfig: PushConfig;
  pushBasculer: () => Promise<void>;
  pushToggleEvenement: (cle: 'diner' | 'pesee' | 'courses') => void;
  pushAjouterRappel: () => void;
  pushSupprimerRappel: (index: number) => void;
  pushMajRappel: (index: number, patch: Partial<RappelPush>) => void;
  pushToggleJour: (index: number, jour: number) => void;
}) {
  return (
    <section className="detail-page">
      <h2>Notifications</h2>
      <div className="push-bloc">
        <button type="button" className="profil-ghost" aria-pressed={pushOn} onClick={() => void pushBasculer()}>
          {pushOn ? 'Désactiver les notifications' : 'Activer les notifications'}
        </button>
        {pushErreur && (
          <p className="error" role="alert">
            {pushErreur}
          </p>
        )}

        <p className="push-sous-titre">Quand mon coéquipier agit</p>
        <div className="chips">
          <button
            type="button"
            className={`chip${pushConfig.evenements.diner ? ' on' : ''}`}
            aria-pressed={pushConfig.evenements.diner}
            onClick={() => pushToggleEvenement('diner')}
          >
            Dîner coché
          </button>
          <button
            type="button"
            className={`chip${pushConfig.evenements.pesee ? ' on' : ''}`}
            aria-pressed={pushConfig.evenements.pesee}
            onClick={() => pushToggleEvenement('pesee')}
          >
            Pesée ajoutée
          </button>
          <button
            type="button"
            className={`chip${pushConfig.evenements.courses ? ' on' : ''}`}
            aria-pressed={pushConfig.evenements.courses}
            onClick={() => pushToggleEvenement('courses')}
          >
            Courses faites
          </button>
        </div>

        <p className="push-sous-titre">Mes rappels</p>
        {pushConfig.rappels.map((rappel, i) => (
          <div className="push-rappel" key={i}>
            <div className="push-rappel-row">
              <label>
                <span className="onb-hint">Type de rappel</span>
                <select
                  aria-label={`Type de rappel ${i + 1}`}
                  value={rappel.type}
                  onChange={(e) => pushMajRappel(i, { type: e.target.value as RappelPush['type'] })}
                >
                  <option value="seance">Séance</option>
                  <option value="pesee">Pesée</option>
                  <option value="rituel">Rituel dimanche</option>
                </select>
              </label>
              <input
                aria-label={`Heure du rappel ${i + 1}`}
                type="time"
                value={rappel.heure}
                onChange={(e) => pushMajRappel(i, { heure: e.target.value })}
              />
              <button
                type="button"
                className="chip push-suppr"
                aria-label={`Supprimer le rappel ${i + 1}`}
                onClick={() => pushSupprimerRappel(i)}
              >
                Supprimer
              </button>
            </div>
            <div className="chips push-puces">
              {[
                [1, 'Lundi', 'L'],
                [2, 'Mardi', 'M'],
                [3, 'Mercredi', 'M'],
                [4, 'Jeudi', 'J'],
                [5, 'Vendredi', 'V'],
                [6, 'Samedi', 'S'],
                [0, 'Dimanche', 'D'],
              ].map(([j, label, lettre]) => (
                <button
                  key={j}
                  type="button"
                  className={`chip${rappel.jours.includes(j as number) ? ' on' : ''}`}
                  aria-pressed={rappel.jours.includes(j as number)}
                  aria-label={label as string}
                  onClick={() => pushToggleJour(i, j as number)}
                >
                  {lettre}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className="profil-ghost push-ajout" onClick={pushAjouterRappel}>
          Ajouter un rappel
        </button>
        <p className="onb-hint">
          Notifications sur cet appareil, envoyées par le serveur du foyer (Supabase). Désactivation immédiate.
        </p>
      </div>
    </section>
  );
}

// Page détail « Foyer » — connexion par code, état duo, déconnexion, purge
// (double confirmation, définitive pour tout le foyer). Self-contained.
function FoyerInline({ syncEtat }: { syncEtat: SyncEtat }) {
  const [codeFoyer, setCodeFoyer] = useState('');
  const [syncErreur, setSyncErreur] = useState<string | null>(null);
  const [syncOccupe, setSyncOccupe] = useState(false);
  const [purgeEnCours, setPurgeEnCours] = useState(false);

  const connecterFoyerCode = async () => {
    const code = codeFoyer.trim();
    if (!code) return;
    setSyncOccupe(true);
    setSyncErreur(null);
    try {
      await connecterFoyer(code);
      setCodeFoyer('');
    } catch (e) {
      setSyncErreur(messageConnexion(e));
    } finally {
      setSyncOccupe(false);
    }
  };

  // Purge : le serveur est nettoyé avant le local (engine) — double
  // confirmation car l'action est définitive pour tout le foyer. La garde
  // purgeEnCours verrouille pendant la flush en vol (double-tap).
  const supprimerFoyer = () => {
    if (purgeEnCours) return;
    if (
      !window.confirm(
        'Supprimer les données du foyer ? Semaines, pesées et dépenses partagées seront effacées chez Supabase et sur tous les téléphones du foyer.',
      )
    )
      return;
    if (!window.confirm('Dernière confirmation : cette action est définitive.')) return;
    setPurgeEnCours(true);
    purgerFoyer()
      .catch(() => setSyncErreur('Suppression impossible : réessaie plus tard.'))
      .finally(() => setPurgeEnCours(false));
  };

  return (
    <section className="detail-page">
      <h2>Foyer</h2>
      <div className="sync-bloc">
        {lireSessionPub() ? (
          <>
            {/* hors-foyer n'a jamais de label ici : fenêtre transitoire
                (session posée, connexion en échec) — l'alerte syncErreur
                et le point rouge portent le signal. 'off' : page atteinte
                uniquement si duo existe, garde là pour le type ETAT_SYNC. */}
            {syncEtat !== 'off' && syncEtat !== 'hors-foyer' && <p className="muted">{ETAT_SYNC[syncEtat]}</p>}
            <button type="button" className="profil-ghost" onClick={deconnecterFoyer}>
              Déconnecter le foyer
            </button>
            <button
              type="button"
              className="sync-danger"
              onClick={supprimerFoyer}
              disabled={purgeEnCours}
            >
              {purgeEnCours ? 'Suppression…' : 'Supprimer les données du foyer'}
            </button>
          </>
        ) : (
          <>
            <div className="onboarding-field">
              <label htmlFor="sync-code">Code de foyer</label>
              <input
                id="sync-code"
                type="password"
                value={codeFoyer}
                onChange={(e) => {
                  setSyncErreur(null);
                  setCodeFoyer(e.target.value);
                }}
              />
            </div>
            <button
              type="button"
              className="profil-ghost"
              onClick={connecterFoyerCode}
              disabled={syncOccupe}
            >
              {syncOccupe ? 'Connexion…' : 'Se connecter au foyer'}
            </button>
          </>
        )}
        <Alerte texte={syncErreur} />
        <p className="onb-hint">
          Données synchronisées chez Supabase — région UE, accès limité au foyer.
        </p>
      </div>
    </section>
  );
}

export function ProfilScreen({
  profile,
  onBack,
  onChangeProfile,
  onProfileSaved,
  onImported,
  syncEtat = 'off',
  cycle,
}: {
  profile: UserProfile;
  onBack: () => void;
  onChangeProfile: () => void;
  onProfileSaved?: (p: UserProfile) => void;
  onImported: () => void;
  syncEtat?: SyncEtat;
  cycle?: number;
}) {
  const [vue, setVue] = useState<Vue>('hub');
  const [copie, setCopie] = useState(false);

  // Notifications push : config locale du device (la vérité serveur = ce
  // qu'on POSTe), `pushOn` = souscription existante (survit au rechargement).
  const pushVisible = pushActif();
  const [pushOn, setPushOn] = useState(false);
  const [pushConfig, setPushConfig] = useState<PushConfig>(configDefaut());
  const [pushErreur, setPushErreur] = useState<string | null>(null);
  useEffect(() => {
    // Pas de SW (navigateur sans support, tests) : l'état reste « off ».
    if (!pushVisible || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushOn(!!sub))
      .catch(() => {});
  }, [pushVisible]);

  const pushActive = (config: PushConfig): void => {
    setPushConfig(config);
    if (pushOn) void majConfig(config);
  };

  const pushBasculer = async (): Promise<void> => {
    setPushErreur(null);
    if (pushOn) {
      await desabonner();
      setPushOn(false);
      return;
    }
    const res = await souscrireEtEnregistrer(pushConfig);
    if (res.ok) {
      setPushOn(true);
    } else {
      // Diagnostic visible : l'erreur brute du navigateur porte la cause réelle.
      setPushErreur(res.erreur ?? 'Échec de l’activation.');
      console.error('[push] activation impossible :', res.erreur);
    }
  };

  const pushToggleEvenement = (cle: 'diner' | 'pesee' | 'courses'): void => {
    pushActive({ ...pushConfig, evenements: { ...pushConfig.evenements, [cle]: !pushConfig.evenements[cle] } });
  };

  const pushAjouterRappel = (): void => {
    pushActive({ ...pushConfig, rappels: [...pushConfig.rappels, { type: 'seance', jours: [1], heure: '08:00' }] });
  };

  const pushSupprimerRappel = (index: number): void => {
    pushActive({ ...pushConfig, rappels: pushConfig.rappels.filter((_, i) => i !== index) });
  };

  const pushMajRappel = (index: number, patch: Partial<RappelPush>): void => {
    pushActive({
      ...pushConfig,
      rappels: pushConfig.rappels.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  };

  const pushToggleJour = (index: number, jour: number): void => {
    const r = pushConfig.rappels[index];
    if (!r) return;
    const jours = r.jours.includes(jour) ? r.jours.filter((j) => j !== jour) : [...r.jours, jour].sort((a, b) => a - b);
    pushMajRappel(index, { jours });
  };

  const copierPrompt = async () => {
    const texte = assemblePromptIa(profile, getWeights(profile.id).at(-1) ?? null);
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

  const changerProfil = () => {
    if (
      window.confirm(
        `Changer de profil ? ${prenomProfil(profile.id, profile)} restera sur ce téléphone avec ses données.`,
      )
    )
      onChangeProfile();
  };

  const duo = resumeDuo(syncEtat);

  const propsPush = {
    pushOn,
    pushErreur,
    pushConfig,
    pushBasculer,
    pushToggleEvenement,
    pushAjouterRappel,
    pushSupprimerRappel,
    pushMajRappel,
    pushToggleJour,
  };

  return (
    <div className="profil-screen">
      {vue === 'hub' ? (
        <>
          <button type="button" className="profil-back" onClick={onBack}>
            <Icon name="chev-left" size={16} />
            Retour
          </button>
          <div className="profil-hub">
            <div className="hub-compte">
              <div className="hub-avatar">{(prenomProfil(profile.id, profile)[0] ?? '?').toUpperCase()}</div>
              <div>
                <div className="hub-nom">{prenomProfil(profile.id, profile)}</div>
                <div className="hub-sous">
                  {duo && <span aria-hidden="true" className={`hub-pt${duo.ton !== 'basilic' ? ` ${duo.ton}` : ''}`} />}
                  {duo && <b>{duo.label}</b>}
                  {cycle != null && (
                    <span className="hub-cycle">{duo ? `· Cycle ${cycle}` : `Cycle ${cycle}`}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="hub-tuiles">
              <button type="button" className="hub-tuile" onClick={() => setVue('objectif')}>
                <Icon name="target" size={20} />
                <b>Objectif</b>
                <span>{resumeObjectif(profile, getWeights(profile.id).at(-1) ?? null)}</span>
              </button>
              <button type="button" className="hub-tuile" onClick={() => setVue('infos')}>
                <Icon name="info" size={20} />
                <b>Mes infos</b>
                <span>{resumeInfos(profile)}</span>
              </button>
              <button type="button" className="hub-tuile" onClick={() => setVue('maison')}>
                <Icon name="home" size={20} />
                <b>Maison &amp; courses</b>
                <span>{resumeMaison(profile)}</span>
              </button>
              {pushVisible && (
                <button type="button" className="hub-tuile" onClick={() => setVue('notifs')}>
                  <Icon name="bell" size={20} />
                  <b>Notifications</b>
                  <span>{resumeNotifications(pushConfig)}</span>
                </button>
              )}
            </div>
            <div className="hub-actions">
              <button type="button" className="hub-action" onClick={changerProfil}>
                <Icon name="refresh" size={16} /> Changer de profil <span aria-hidden="true" className="fleche">›</span>
              </button>
              <button type="button" className="hub-action" onClick={copierPrompt}>
                <Icon name="copy" size={16} /> Copier le prompt IA <span aria-hidden="true" className="fleche">⧉</span>
              </button>
              {duo && (
                <button type="button" className="hub-action" onClick={() => setVue('foyer')}>
                  <span aria-hidden="true" className="hub-pt" /> {duo.label} — voir le foyer <span aria-hidden="true" className="fleche">›</span>
                </button>
              )}
              {syncEtat !== 'off' && (
                <button type="button" className="hub-action danger" onClick={deconnecterFoyer}>
                  Déconnecter le foyer <span aria-hidden="true" className="fleche">›</span>
                </button>
              )}
              <div className="hub-import">
                <ImportButton onImported={onImported} label="Importer un cycle (.md)" />
              </div>
              {copie && (
                <p className="muted" role="status">
                  Prompt copié — colle-le dans le chat.
                </p>
              )}
            </div>
          </div>
          <p className="muted profil-about">
            Rituel v{__APP_VERSION__} — vos données restent sur votre téléphone.
          </p>
        </>
      ) : (
        <>
          <button type="button" className="profil-back" onClick={() => setVue('hub')}>
            <Icon name="chev-left" size={16} />
            Profil
          </button>
          {vue === 'infos' && <ProfilInfos profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'objectif' && <ProfilObjectif profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'maison' && <MaisonInline profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'notifs' && <PushInline {...propsPush} />}
          {vue === 'foyer' && <FoyerInline syncEtat={syncEtat} />}
        </>
      )}
    </div>
  );
}
