import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { lireSessionPub, supprimerProfil } from '../../lib/sync/engine';

const MOT = 'SUPPRIMER';

type Etape = 'saisie' | 'envoi' | 'reseau';

// Zone dangereuse du Profil (spec 2026-10-12) : confirmation par saisie du mot
// SUPPRIMER dans un dialogue modal. Le serveur d'abord ; si le réseau échoue,
// on propose de réessayer ou de supprimer quand même sur ce téléphone.
export function SupprimerProfil({ onSupprime }: { onSupprime: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState<Etape>('saisie');
  const [saisie, setSaisie] = useState('');
  const [tout, setTout] = useState(false);
  const dialogue = useRef<HTMLElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const foyer = !!lireSessionPub();

  useEffect(() => {
    if (ouvert) champ.current?.focus();
  }, [ouvert]);

  const fermer = () => {
    setOuvert(false);
    setEtape('saisie');
    setSaisie('');
    setTout(false);
    declencheur.current?.focus();
  };

  const supprimer = async (localSeulement: boolean) => {
    setEtape('envoi');
    try {
      await supprimerProfil({ localSeulement, toutSupprimer: foyer && tout && !localSeulement });
      onSupprime();
    } catch {
      setEtape('reseau');
    }
  };

  const clavier = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && etape !== 'envoi') {
      fermer();
      return;
    }
    if (e.key !== 'Tab') return;
    // Piège de focus : Tab/Maj+Tab restent dans le dialogue.
    const cibles = [...(dialogue.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])];
    if (cibles.length === 0) return;
    const premier = cibles[0]!;
    const dernier = cibles[cibles.length - 1]!;
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault();
      premier.focus();
    }
  };

  const valide = saisie.trim().toUpperCase() === MOT;

  return (
    <>
      <div className="zone-danger">
        <button ref={declencheur} type="button" className="hub-action danger" onClick={() => setOuvert(true)}>
          Supprimer mon profil <span aria-hidden="true" className="fleche">›</span>
        </button>
      </div>
      {ouvert && (
        <div className="voile" onClick={() => etape !== 'envoi' && fermer()}>
          <section
            ref={dialogue}
            className="feuille"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sp-titre"
            aria-describedby="sp-desc"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={clavier}
          >
            <h2 id="sp-titre">Supprimer mon profil</h2>
            <div id="sp-desc" className="sp-desc">
              <p>
                Tout sera effacé <b>définitivement</b> sur ce téléphone : ton profil, tes pesées, tes coches, tes
                dépenses, tes menus et les réglages du foyer. Tu reviendras à l’écran de bienvenue.
              </p>
              {foyer && (
                <p>
                  Ce téléphone quitte aussi le foyer connecté. Si c’est le dernier téléphone du foyer, toutes ses
                  données sont supprimées du serveur ; sinon elles restent pour les autres.
                </p>
              )}
            </div>
            {etape === 'reseau' && (
              <p className="sp-alerte" role="alert">
                Impossible de joindre le serveur : rien n’a été effacé. Réessaie, ou supprime quand même les données de
                ce téléphone (le foyer restera alors sur le serveur).
              </p>
            )}
            {etape !== 'reseau' ? (
              <>
                {foyer && (
                  <label className="sp-tout">
                    <input
                      type="checkbox"
                      checked={tout}
                      disabled={etape === 'envoi'}
                      onChange={(e) => setTout(e.target.checked)}
                    />
                    <span>
                      Je suis le dernier appareil de ce foyer — supprimer aussi toutes les données du foyer sur le
                      serveur. Les autres membres perdront l’accès et leurs données.
                    </span>
                  </label>
                )}
                <label className="signaler-champ">
                  <span>Tape SUPPRIMER pour confirmer</span>
                  <input
                    ref={champ}
                    type="text"
                    value={saisie}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    disabled={etape === 'envoi'}
                    onChange={(e) => setSaisie(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="bouton-danger"
                  disabled={!valide || etape === 'envoi'}
                  onClick={() => void supprimer(false)}
                >
                  {etape === 'envoi' ? 'Suppression…' : 'Supprimer définitivement'}
                </button>
                <button type="button" className="lien" disabled={etape === 'envoi'} onClick={fermer}>
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button type="button" className="bouton-contour" onClick={() => void supprimer(false)}>
                  Réessayer
                </button>
                <button type="button" className="bouton-danger" onClick={() => void supprimer(true)}>
                  Supprimer quand même sur ce téléphone
                </button>
                <button type="button" className="lien" onClick={fermer}>
                  Annuler
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
