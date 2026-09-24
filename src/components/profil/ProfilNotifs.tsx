import type { PushConfig, RappelPush } from '../../lib/push/module';
import { Alerte } from './presente';

// Page détail « Notifications » — les états push restent dans ProfilScreen
// (le hub en a besoin pour la tuile + son résumé).
export function ProfilNotifs({
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
        <Alerte texte={pushErreur} />

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
