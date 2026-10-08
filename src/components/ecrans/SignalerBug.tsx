import { useEffect, useState } from 'react';
import {
  CAPTURE_MAX,
  DESC_MAX,
  DESC_MIN,
  TITRE_MAX,
  TITRE_MIN,
  TYPES_CAPTURE,
  envoyerSignalement,
  etatSignalement,
  infosAppareil,
  type TypeSignalement,
} from '../../lib/bugs';
import { Icon } from '../Icon';

const MESSAGES = {
  quota: 'Vous avez déjà envoyé 3 signalements aujourd’hui. Réessayez demain.',
  indisponible: 'Le signalement est indisponible pour le moment. Réessayez plus tard.',
  invalide: 'Le signalement a été refusé : vérifiez les champs et la capture.',
  session: 'Votre foyer n’est plus connecté. Reconnectez-le dans Profil › Foyer.',
  reseau: 'Pas de connexion : le signalement n’a pas été envoyé. Réessayez.',
} as const;

const libelleInfos = (page: string): [string, string][] => {
  const i = infosAppareil(page);
  return [
    ['Version de l’app', i.version],
    ['Écran d’origine', i.page],
    ['Appareil', i.appareil],
    ['Navigateur', i.navigateur],
    ['Écran', i.ecran],
    ['Langue', i.langue],
    ['Installation', i.installation],
  ];
};

/** Écran poussé « Signaler un bug » : crée une issue GitHub via le serveur de sync. */
export function SignalerBug({ onRetour, page }: { onRetour: () => void; page: string }) {
  const etat = etatSignalement();
  const [type, setType] = useState<TypeSignalement>('bug');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [capture, setCapture] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!capture || typeof URL.createObjectURL !== 'function') {
      setApercu(null);
      return;
    }
    const url = URL.createObjectURL(capture);
    setApercu(url);
    return () => URL.revokeObjectURL?.(url);
  }, [capture]);

  const retour = (
    <button type="button" className="profil-back" onClick={onRetour}>
      <Icon name="chev-left" size={16} /> Profil
    </button>
  );

  if (etat === 'sync-off') {
    return (
      <div className="signaler-bug">
        {retour}
        <h1>Signaler un bug</h1>
        <p>Le signalement n’est pas disponible dans cette version de l’app.</p>
      </div>
    );
  }
  if (etat === 'sans-foyer') {
    return (
      <div className="signaler-bug">
        {retour}
        <h1>Signaler un bug</h1>
        <p>
          Pour signaler un bug ou proposer une amélioration, connectez d’abord votre foyer dans Profil › Foyer.
        </p>
      </div>
    );
  }
  if (issueUrl !== null) {
    return (
      <div className="signaler-bug">
        {retour}
        <h1>Merci !</h1>
        <p>Votre signalement a bien été envoyé.</p>
        {issueUrl && (
          <p>
            <a href={issueUrl} target="_blank" rel="noreferrer noopener">
              Voir le signalement
            </a>
          </p>
        )}
        <button type="button" className="bouton-plein" onClick={onRetour}>
          Retour au profil
        </button>
      </div>
    );
  }

  const titreOk = titre.trim().length >= TITRE_MIN && titre.trim().length <= TITRE_MAX;
  const descOk = description.trim().length >= DESC_MIN && description.trim().length <= DESC_MAX;

  const choisirCapture = (f: File | null) => {
    if (!f) {
      setCapture(null);
      return;
    }
    if (!TYPES_CAPTURE.includes(f.type)) {
      setErreur('La capture doit être une image PNG, JPEG ou WebP.');
      return;
    }
    if (f.size > CAPTURE_MAX) {
      setErreur('La capture dépasse 5 Mo.');
      return;
    }
    setErreur(null);
    setCapture(f);
  };

  const envoyer = async () => {
    if (!titreOk || !descOk || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const r = await envoyerSignalement({ titre, type, description, capture, page });
    setEnvoi(false);
    if (r.ok) setIssueUrl(r.issueUrl);
    else setErreur(MESSAGES[r.raison]);
  };

  return (
    <div className="signaler-bug">
      {retour}
      <h1>Signaler un bug</h1>
      <p className="muted">Votre message crée un ticket public sur GitHub. N’y mettez rien de personnel.</p>

      <div className="segment" role="radiogroup" aria-label="Type de signalement">
        {(['bug', 'amélioration'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
          >
            {t === 'bug' ? 'Un bug' : 'Une amélioration'}
          </button>
        ))}
      </div>

      <label className="signaler-champ">
        Titre
        <input
          type="text"
          value={titre}
          maxLength={TITRE_MAX}
          onChange={(e) => setTitre(e.target.value)}
          aria-describedby="signaler-titre-aide"
        />
        <span id="signaler-titre-aide" className="muted">
          {TITRE_MIN} à {TITRE_MAX} caractères ({titre.trim().length}/{TITRE_MAX})
        </span>
      </label>

      <label className="signaler-champ">
        Description
        <textarea
          rows={6}
          value={description}
          maxLength={DESC_MAX}
          onChange={(e) => setDescription(e.target.value)}
          aria-describedby="signaler-desc-aide"
        />
        <span id="signaler-desc-aide" className="muted">
          {DESC_MIN} à {DESC_MAX} caractères ({description.trim().length}/{DESC_MAX})
        </span>
      </label>

      <label className="signaler-champ">
        Capture d’écran (facultatif)
        <input
          type="file"
          accept={TYPES_CAPTURE.join(',')}
          onChange={(e) => {
            choisirCapture(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        <span className="muted">PNG, JPEG ou WebP, 5 Mo maximum.</span>
      </label>
      {apercu && capture && (
        <div className="signaler-apercu">
          <img src={apercu} alt="Aperçu de la capture" />
          <button type="button" className="bouton-contour" onClick={() => setCapture(null)}>
            Retirer la capture
          </button>
        </div>
      )}

      <details className="signaler-infos">
        <summary>Informations envoyées</summary>
        <ul>
          <li>Votre titre, votre description et la capture éventuelle</li>
          {libelleInfos(page).map(([k, v]) => (
            <li key={k}>
              {k} : {v}
            </li>
          ))}
          <li>L’identifiant technique de votre navigateur (user-agent)</li>
        </ul>
        <p className="muted">Ni votre poids, ni vos données de suivi, ni l’identifiant de votre foyer ne sont envoyés.</p>
      </details>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}

      <button type="button" className="bouton-plein" disabled={!titreOk || !descOk || envoi} onClick={envoyer}>
        {envoi ? 'Envoi…' : 'Envoyer'}
      </button>
    </div>
  );
}
