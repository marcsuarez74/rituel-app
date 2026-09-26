import { useState } from 'react';
import {
  connecterFoyer,
  deconnecterFoyer,
  lireSessionPub,
  purgerFoyer,
} from '../../lib/sync/engine';
import type { SyncEtat } from '../../lib/sync/engine';
import { creerFoyer, genererCodeFoyer } from '../../lib/sync/session';
import { messageConnexion, messageCreation } from '../../lib/sync/messages';
import { Alerte } from './presente';

// Message d'état en vue connectée (texte simple — pas de symbole).
const ETAT_SYNC: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Synchronisation : en attente.',
  sync: 'Synchronisé.',
  erreur: 'Synchronisation : erreur.',
};

// Page détail « Foyer » — création (code d'invitation permanent), connexion
// par code, état duo, déconnexion, purge (double confirmation).
export function ProfilFoyer({ syncEtat }: { syncEtat: SyncEtat }) {
  const [codeFoyer, setCodeFoyer] = useState('');
  const [syncErreur, setSyncErreur] = useState<string | null>(null);
  const [syncOccupe, setSyncOccupe] = useState(false);
  const [purgeEnCours, setPurgeEnCours] = useState(false);
  // Création : le code n'est récupérable qu'ici (hashé côté serveur) — il
  // reste affiché jusqu'à la connexion du téléphone.
  const [codeCree, setCodeCree] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

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

  const creerFoyerCode = async () => {
    if (syncOccupe) return;
    setSyncOccupe(true);
    setSyncErreur(null);
    try {
      const code = genererCodeFoyer();
      await creerFoyer(code);
      setCopie(false);
      setCodeCree(code);
    } catch (e) {
      setSyncErreur(messageCreation(e));
    } finally {
      setSyncOccupe(false);
    }
  };

  const copierCode = async () => {
    if (!codeCree) return;
    try {
      await navigator.clipboard.writeText(codeCree);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = codeCree;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopie(true);
  };

  const connecterApresCreation = async () => {
    if (!codeCree || syncOccupe) return;
    setSyncOccupe(true);
    try {
      await connecterFoyer(codeCree);
      setCodeCree(null);
    } catch (e) {
      setSyncErreur(messageConnexion(e));
    } finally {
      setSyncOccupe(false);
    }
  };

  // Purge : le serveur est nettoyé avant le local (engine) — double
  // confirmation car l'action est définitive pour tout le foyer.
  const supprimerFoyer = () => {
    if (purgeEnCours) return;
    if (
      !window.confirm(
        'Supprimer les données du foyer ? Semaines, pesées et dépenses partagées seront effacées sur le serveur du foyer et sur tous les téléphones.',
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
        ) : codeCree ? (
          <>
            <p className="sync-code">{codeCree}</p>
            <button type="button" className="profil-ghost" onClick={() => void copierCode()}>
              {copie ? 'Copié' : 'Copier le code'}
            </button>
            <p className="onb-hint">
              Notez ce code : il n’est pas stocké en clair. Il sera demandé sur
              l’autre téléphone (« Se connecter au foyer »).
            </p>
            <button
              type="button"
              className="profil-ghost"
              onClick={() => void connecterApresCreation()}
              disabled={syncOccupe}
            >
              {syncOccupe ? 'Connexion…' : 'C’est noté — connecter ce téléphone'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="profil-ghost"
              onClick={() => void creerFoyerCode()}
              disabled={syncOccupe}
            >
              Créer un foyer
            </button>
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
          Données synchronisées sur votre serveur (rituel.marco-studio.fr).
        </p>
      </div>
    </section>
  );
}
