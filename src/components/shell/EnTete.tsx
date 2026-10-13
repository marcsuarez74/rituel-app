import { resumeDuo } from '../../lib/resumes';
import type { SyncEtat } from '../../lib/sync/engine';

// En-tête (spec refonte §4.1) : titre de l'écran + sous-titre (date ou
// position dans les menus) + avatar rond 50 px (initiale) qui ouvre Moi ;
// le point sur l'avatar porte l'état de la sync (absent sans sync).
export function EnTete({
  titre,
  sousTitre,
  prenom,
  syncEtat,
  onProfil,
}: {
  titre: string;
  sousTitre?: string;
  prenom: string;
  syncEtat: SyncEtat;
  onProfil: () => void;
}) {
  const duo = resumeDuo(syncEtat);
  return (
    <header className="en-tete">
      <div className="en-tete-titre">
        <h1>{titre}</h1>
        {sousTitre && <p>{sousTitre}</p>}
      </div>
      <button
        type="button"
        className="avatar"
        aria-label={`Moi : ${prenom}`}
        onClick={onProfil}
      >
        {(prenom[0] ?? '?').toUpperCase()}
        {duo && <span aria-hidden="true" className={`avatar-pt ${duo.ton}`} />}
      </button>
    </header>
  );
}
