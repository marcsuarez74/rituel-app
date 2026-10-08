import { useState } from 'react';
import { loadFoyer } from '../../lib/cycle/etat';
import type { UserProfile } from '../../lib/model';
import { deconnecterFoyer, lireSessionPub, purgerFoyer } from '../../lib/sync/engine';
import type { SyncEtat } from '../../lib/sync/engine';
import { lireCode } from '../../lib/sync/session';
import { Icon } from '../Icon';
import { PartageFoyer } from '../onboarding/PartageFoyer';
import { Alerte } from './presente';

// Message d'état en vue connectée (texte simple — pas de symbole).
const ETAT_SYNC: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Synchronisation : en attente.',
  sync: 'Synchronisé.',
  erreur: 'Synchronisation : erreur.',
};

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

// Page détail « Foyer » (spec 2026-10-07 §3, maquette écran E) — connecté :
// membres, code à donner (gardé sur ce téléphone), déconnexion, purge (double
// confirmation) ; hors foyer : créer / rejoindre, comme à l'inscription.
export function ProfilFoyer({
  syncEtat,
  profile,
  onIdentite,
}: {
  syncEtat: SyncEtat;
  profile: UserProfile;
  onIdentite?: (p: UserProfile) => void; // rattaché à un membre existant (id changé)
}) {
  const [syncErreur, setSyncErreur] = useState<string | null>(null);
  const [purgeEnCours, setPurgeEnCours] = useState(false);
  const [codeVisible, setCodeVisible] = useState(false);
  const [copie, setCopie] = useState(false);
  // Créer / rejoindre reste affiché jusqu'au bout (code à noter, « Es-tu X ? »)
  // même si la session existe déjà ; render-phase reset quand on sort du foyer.
  const session = !!lireSessionPub();
  const [partage, setPartage] = useState(!session);
  if (!session && !partage) setPartage(true);

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

  const code = lireCode();
  const membres = loadFoyer()?.membres ?? [];

  return (
    <section className="detail-page">
      <h2>Foyer</h2>
      <div className="sync-bloc">
        {session && !partage ? (
          <>
            {syncEtat !== 'off' && syncEtat !== 'hors-foyer' && <p className="muted">{ETAT_SYNC[syncEtat]}</p>}
            {membres.length > 0 && (
              <section className="profile-section" aria-labelledby="pf-membres">
                <h3 id="pf-membres">Membres</h3>
                {membres.map((m) => (
                  <p key={m.id} className="membre">
                    <b>{m.prenom}</b>
                    <span className="muted">
                      {m.id === profile.id
                        ? 'toi · ce téléphone'
                        : m.type === 'enfant'
                          ? 'enfant'
                          : m.telephone
                            ? 'adulte · son téléphone est connecté'
                            : 'adulte · pas encore de téléphone'}
                    </span>
                  </p>
                ))}
              </section>
            )}
            {code && (
              <section className="profile-section" aria-labelledby="pf-code">
                <h3 id="pf-code">Code du foyer</h3>
                <p className="onb-hint">À donner pour ajouter un téléphone. Gardé sur ce téléphone, jamais en clair sur le serveur.</p>
                <p className="sync-code">{codeVisible ? code : '•'.repeat(Math.min(code.length, 24))}</p>
                <div className="onb-row2 actions-code">
                  <button type="button" className="bouton-contour" onClick={() => setCodeVisible(!codeVisible)}>
                    {codeVisible ? 'Masquer' : 'Afficher'}
                  </button>
                  <button
                    type="button"
                    className="bouton-contour"
                    onClick={() => void copierTexte(code).then(() => setCopie(true))}
                  >
                    <Icon name="copy" size={16} /> {copie ? 'Copié' : 'Copier'}
                  </button>
                </div>
              </section>
            )}
            <button type="button" className="profil-ghost" onClick={deconnecterFoyer}>
              Déconnecter le foyer
            </button>
            <p className="onb-hint">Ce téléphone repasse en local ; le foyer continue pour les autres.</p>
            <button type="button" className="sync-danger" onClick={supprimerFoyer} disabled={purgeEnCours}>
              {purgeEnCours ? 'Suppression…' : 'Supprimer les données du foyer'}
            </button>
          </>
        ) : (
          <PartageFoyer
            profil={profile}
            onTermine={(p) => {
              setPartage(false);
              if (p.id !== profile.id) onIdentite?.(p);
            }}
          />
        )}
        <Alerte texte={syncErreur} />
        <p className="onb-hint">Données synchronisées sur votre serveur (rituel.marco-studio.fr).</p>
      </div>
    </section>
  );
}
