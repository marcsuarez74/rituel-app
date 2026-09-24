import { useState } from 'react';
import {
  connecterFoyer,
  deconnecterFoyer,
  lireSessionPub,
  purgerFoyer,
} from '../../lib/sync/engine';
import type { SyncEtat } from '../../lib/sync/engine';
import { messageConnexion } from '../../lib/sync/messages';
import { Alerte } from './presente';

// Message d'état en vue connectée (texte simple — pas de symbole).
const ETAT_SYNC: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Synchronisation : en attente.',
  sync: 'Synchronisé.',
  erreur: 'Synchronisation : erreur.',
};

// Page détail « Foyer » — connexion par code, état duo, déconnexion, purge
// (double confirmation, définitive pour tout le foyer).
export function ProfilFoyer({ syncEtat }: { syncEtat: SyncEtat }) {
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
