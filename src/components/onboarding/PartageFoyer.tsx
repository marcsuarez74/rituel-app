import { useState } from 'react';
import { loadFoyer } from '../../lib/cycle/etat';
import { rattacher } from '../../lib/cycle/foyer';
import type { Membre } from '../../lib/cycle/etat';
import type { UserProfile } from '../../lib/model';
import { renommerPesees, saveProfile } from '../../lib/storage';
import { connecterFoyer } from '../../lib/sync/engine';
import { messageConnexion, messageCreation } from '../../lib/sync/messages';
import { creerFoyer, genererCodeFoyer } from '../../lib/sync/session';
import { Icon } from '../Icon';

const copierTexte = async (texte: string) => {
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
};

type Vue = 'choix' | 'code' | 'rejoindre' | 'question';

// Créer ou rejoindre un foyer (spec 2026-10-07 §3, maquette écrans B-D) : fin
// d'onboarding et Profil › Foyer hors foyer. `foyerLocal` = le foyer du
// téléphone est celui du foyer (créé ici) ; false = celui du serveur (rejoint).
export function PartageFoyer({
  profil,
  onTermine,
  onPlusTard,
}: {
  profil: UserProfile;
  onTermine: (p: UserProfile, foyerLocal: boolean) => void;
  onPlusTard?: () => void;
}) {
  const [vue, setVue] = useState<Vue>('choix');
  const [code, setCode] = useState('');
  const [saisie, setSaisie] = useState('');
  const [candidats, setCandidats] = useState<Membre[]>([]);
  const [choix, setChoix] = useState<string>('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  // Adultes saisis à l'inscription, sans téléphone : à qui donner le code.
  const enAttente = (loadFoyer()?.membres ?? []).filter((m) => m.type === 'adulte' && !m.telephone);

  const creer = async () => {
    if (occupe) return;
    setOccupe(true);
    setErreur(null);
    const nouveau = genererCodeFoyer();
    try {
      await creerFoyer(nouveau);
    } catch (e) {
      setErreur(messageCreation(e));
      setOccupe(false);
      return;
    }
    try {
      await connecterFoyer(nouveau);
      setCode(nouveau);
      setVue('code');
    } catch (e) {
      setErreur(messageConnexion(e));
    } finally {
      setOccupe(false);
    }
  };

  // Être X : le profil de ce téléphone prend l'id du membre (repas, macros, pesées).
  const devenir = (id: string): UserProfile => {
    renommerPesees(profil.id, id);
    const p = { ...profil, id };
    saveProfile(p);
    return p;
  };

  const rejoindre = async () => {
    const c = saisie.trim();
    if (occupe || !c) return;
    setOccupe(true);
    setErreur(null);
    try {
      await connecterFoyer(c, { rejoindre: true });
    } catch (e) {
      setErreur(messageConnexion(e));
      setOccupe(false);
      return;
    }
    setOccupe(false);
    const foyer = loadFoyer();
    const r = foyer ? rattacher(foyer, profil) : ({ etat: 'deja' } as const);
    if (r.etat === 'auto') onTermine(devenir(r.membre.id), false);
    else if (r.etat === 'question') {
      setCandidats(r.candidats);
      setChoix(r.candidats[0].id);
      setVue('question');
    } else onTermine(profil, false);
  };

  return (
    <div className="partage-foyer">
      {vue === 'choix' && (
        <>
          <h1>Partager avec ton foyer</h1>
          <p className="onboarding-sub">Optionnel — menus, courses, coches et pesées sur tous vos téléphones.</p>
          <button type="button" className="onboarding-cta onb-full" onClick={() => void creer()} disabled={occupe}>
            {occupe ? 'Création…' : 'Créer mon foyer'}
          </button>
          <p className="onb-hint">Tu es le premier téléphone de la maison.</p>
          <button
            type="button"
            className="bouton-contour onb-full"
            onClick={() => {
              setErreur(null);
              setVue('rejoindre');
            }}
          >
            Rejoindre un foyer
          </button>
          <p className="onb-hint">Quelqu'un t'a donné un code de foyer.</p>
          {onPlusTard && (
            <button type="button" className="lien onb-full" onClick={onPlusTard}>
              Plus tard <Icon name="chev-right" size={14} />
            </button>
          )}
        </>
      )}

      {vue === 'code' && (
        <>
          <h1>Votre code de foyer</h1>
          <p className="sync-code">{code}</p>
          <div className="onb-row2">
            <button
              type="button"
              className="bouton-contour"
              onClick={() => void copierTexte(code).then(() => setCopie(true))}
            >
              <Icon name="copy" size={16} /> {copie ? 'Copié' : 'Copier'}
            </button>
            {'share' in navigator && (
              <button
                type="button"
                className="bouton-contour"
                onClick={() => void navigator.share({ text: `Rejoins notre foyer sur Rituel avec ce code : ${code}` }).catch(() => {})}
              >
                Partager
              </button>
            )}
          </div>
          <p className="alerte-douce">
            <Icon name="info" size={16} />
            <span>
              {enAttente.length ? `Donne-le à ${enAttente.map((m) => m.prenom).join(', ')} : ` : 'Donne-le aux autres : '}
              « Rejoindre un foyer » à la fin de l'inscription. Retrouvable dans Profil › Foyer sur ce téléphone.
            </span>
          </p>
          <button type="button" className="onboarding-cta onb-full" onClick={() => onTermine(profil, true)}>
            C'est noté
          </button>
        </>
      )}

      {vue === 'rejoindre' && (
        <>
          <h1>Rejoindre un foyer</h1>
          <p className="onboarding-sub">Saisis le code que t'a donné la personne qui a créé le foyer.</p>
          <div className="onboarding-field">
            <label htmlFor="pf-code-foyer">Code de foyer</label>
            <input
              id="pf-code-foyer"
              type="password"
              autoComplete="off"
              value={saisie}
              onChange={(e) => {
                setErreur(null);
                setSaisie(e.target.value);
              }}
            />
          </div>
          <button
            type="button"
            className="onboarding-cta onb-full"
            onClick={() => void rejoindre()}
            disabled={occupe || !saisie.trim()}
          >
            {occupe ? 'Connexion…' : 'Rejoindre'}
          </button>
          <button type="button" className="lien onb-full" onClick={() => setVue('choix')}>
            Retour
          </button>
        </>
      )}

      {vue === 'question' && (
        <>
          <h1>{candidats.length === 1 ? `Es-tu ${candidats[0].prenom} ?` : 'Qui es-tu dans ce foyer ?'}</h1>
          <p className="onboarding-sub">Le foyer t'attendait peut-être sous un autre prénom.</p>
          <div className="rline" role="radiogroup" aria-label="Qui es-tu ?">
            {[
              ...candidats.map((m) => ({ id: m.id, nom: candidats.length === 1 ? "Oui, c'est moi" : m.prenom })),
              { id: '', nom: candidats.length === 1 ? 'Non, ajoute-moi' : 'Aucun : ajoute-moi' },
            ].map((o) => (
              <button
                key={o.id || 'nouveau'}
                type="button"
                role="radio"
                aria-checked={choix === o.id}
                className={`rl${choix === o.id ? ' sel' : ''}`}
                onClick={() => setChoix(o.id)}
              >
                <span className="rl-dot" aria-hidden="true" />
                {o.nom}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="onboarding-cta onb-full"
            onClick={() => onTermine(choix ? devenir(choix) : profil, false)}
          >
            Valider
          </button>
        </>
      )}

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
