import { resumeDuo } from '../../lib/resumes';
import type { SyncEtat } from '../../lib/sync/engine';

// En-tête fin : titre de l'écran + avatar 48 px (initiale) qui ouvre le
// Profil ; le point sur l'avatar porte l'état de la sync (absent sans sync).
export function EnTete({
  titre,
  prenom,
  syncEtat,
  onProfil,
}: {
  titre: string;
  prenom: string;
  syncEtat: SyncEtat;
  onProfil: () => void;
}) {
  const duo = resumeDuo(syncEtat);
  return (
    <header className="en-tete">
      <h1>{titre}</h1>
      <button
        type="button"
        className="avatar"
        aria-label={duo ? `Mon profil — ${duo.label}` : 'Mon profil'}
        onClick={onProfil}
      >
        {(prenom[0] ?? '?').toUpperCase()}
        {duo && <span aria-hidden="true" className={`avatar-pt ${duo.ton}`} />}
      </button>
    </header>
  );
}
