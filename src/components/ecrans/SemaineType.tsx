import { useState } from 'react';
import { ordreJours } from '../../lib/cycle/calendrier';
import type { ExceptionFoyer, JourType, ReglagesFoyer } from '../../lib/cycle/etat';
import { ajouterEnfant, changerJour, resumeJour, retirerMembre } from '../../lib/cycle/foyer';
import { JOURS } from '../../lib/cycle/types';
import type { Jour } from '../../lib/cycle/types';
import { capitalize } from '../../lib/text';
import { Icon } from '../Icon';

const JOURNEES = ['standard', 'sortie', 'repos', 'alternee'] as const;

function Choix<T extends string>({
  label,
  valeur,
  options,
  onChange,
}: {
  label: string;
  valeur: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="choix">
      <span>{label}</span>
      <div className="segment" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === valeur} onClick={() => onChange(o)}>
            {o === 'alternee' ? 'alternée' : o === 'leger' ? 'léger' : o}
          </button>
        ))}
      </div>
    </div>
  );
}

// Semaine type du foyer (spec v2 §4.1, écran 10) : membres (enfants sans âge),
// rythme (courses, rituel), 7 jours dépliables, exceptions récurrentes. En
// mode `compact` (étape « Ta semaine » après l'onboarding) : rythme + enfants.
export function SemaineType({
  foyer,
  compact = false,
  onEnregistrer,
  onRetour,
}: {
  foyer: ReglagesFoyer;
  compact?: boolean;
  onEnregistrer: (f: ReglagesFoyer) => void;
  onRetour: () => void;
}) {
  const [f, setF] = useState(foyer);
  const [enfant, setEnfant] = useState('');
  const [exception, setException] = useState<ExceptionFoyer>({ regle: '', effet: '', actif: true });
  const adultes = f.membres.filter((m) => m.type === 'adulte');
  const jour = (j: Jour, maj: Partial<JourType>) => setF(changerJour(f, j, maj));

  return (
    <div className="semaine-type">
      {!compact && (
        <button type="button" className="profil-back" onClick={onRetour}>
          <Icon name="chev-left" size={16} /> Profil
        </button>
      )}
      <h1>{compact ? 'Ta semaine' : 'Ma semaine type'}</h1>
      {compact && (
        <p className="muted">
          Pour que Claude cale les menus sur votre vie : le jour des courses, le rituel et qui est à table. Le détail
          jour par jour se règle ensuite dans Profil › Ma semaine type.
        </p>
      )}

      <section className="profile-section" aria-labelledby="h-rythme">
        <h2 id="h-rythme">Rythme</h2>
        <label className="debut-cycle">
          Jour des courses (début de chaque semaine)
          <select value={f.jourCourses} onChange={(e) => setF({ ...f, jourCourses: e.target.value as Jour })}>
            {JOURS.map((j) => (
              <option key={j} value={j}>
                {capitalize(j)}
              </option>
            ))}
          </select>
        </label>
        <label className="debut-cycle">
          Jour du rituel batch
          <select value={f.jourRituel} onChange={(e) => setF({ ...f, jourRituel: e.target.value as Jour })}>
            {JOURS.map((j) => (
              <option key={j} value={j}>
                {capitalize(j)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="profile-section" aria-labelledby="h-foyer">
        <h2 id="h-foyer">Le foyer</h2>
        {f.membres.map((m) => (
          <p key={m.id} className="membre">
            <b>{m.prenom}</b>
            <span className="muted">{m.type === 'adulte' ? 'adulte · suivi' : 'enfant · portion enfant'}</span>
            {m.type === 'enfant' && (
              <button type="button" className="lien" onClick={() => setF(retirerMembre(f, m.id))}>
                Retirer {m.prenom}
              </button>
            )}
          </p>
        ))}
        <form
          className="ticket"
          onSubmit={(e) => {
            e.preventDefault();
            setF(ajouterEnfant(f, enfant));
            setEnfant('');
          }}
        >
          <label>
            Prénom d'un enfant
            <input type="text" value={enfant} maxLength={30} onChange={(e) => setEnfant(e.target.value)} />
          </label>
          <button type="submit" className="bouton-contour">
            Ajouter
          </button>
        </form>
      </section>

      {!compact && (
        <>
          <h2>Jour par jour</h2>
          {ordreJours(f.jourCourses).map((j) => {
            const t = f.semaine[j];
            return (
              <details key={j} className="profile-section placard jour-type">
                <summary>
                  <b>{capitalize(j)}</b>
                  <span className="muted">{resumeJour(f, j)}</span>
                </summary>
                {f.membres.map((m) => (
                  <Choix
                    key={m.id}
                    label={`Déjeuner de ${m.prenom}`}
                    valeur={t.dejeuner[m.id] ?? (m.type === 'adulte' ? 'maison' : 'dehors')}
                    options={m.type === 'adulte' ? (['maison', 'box'] as const) : (['maison', 'dehors'] as const)}
                    onChange={(v) => jour(j, { dejeuner: { ...t.dejeuner, [m.id]: v } })}
                  />
                ))}
                <Choix label="Dîner" valeur={t.diner} options={['famille', 'rapide', 'leger'] as const} onChange={(v) => jour(j, { diner: v })} />
                {adultes.map((m) => (
                  <label key={m.id} className="interrupteur">
                    <input
                      type="checkbox"
                      checked={t.plusTard.includes(m.id)}
                      onChange={(e) =>
                        jour(j, {
                          plusTard: e.target.checked ? [...t.plusTard, m.id] : t.plusTard.filter((x) => x !== m.id),
                        })
                      }
                    />
                    {m.prenom} dîne plus tard
                  </label>
                ))}
                {f.membres
                  .filter((m) => m.suivi)
                  .map((m) => (
                    <Choix
                      key={m.id}
                      label={`Journée de ${m.prenom}`}
                      valeur={t.journee?.[m.id] ?? 'standard'}
                      options={JOURNEES}
                      onChange={(v) => jour(j, { journee: { ...t.journee, [m.id]: v } })}
                    />
                  ))}
                <label className="debut-cycle">
                  Note
                  <input
                    type="text"
                    value={t.note ?? ''}
                    maxLength={80}
                    // vide → undefined : omis au JSON (une note vide serait illégale)
                    onChange={(e) => jour(j, { note: e.target.value.trim() ? e.target.value : undefined })}
                  />
                </label>
              </details>
            );
          })}

          <section className="profile-section" aria-labelledby="h-exceptions">
            <h2 id="h-exceptions">Exceptions récurrentes</h2>
            {f.exceptions.map((x, i) => (
              <p key={`${x.regle}-${i}`} className="membre">
                <label className="interrupteur">
                  <input
                    type="checkbox"
                    checked={x.actif}
                    onChange={() =>
                      setF({ ...f, exceptions: f.exceptions.map((y, k) => (k === i ? { ...y, actif: !y.actif } : y)) })
                    }
                  />
                  <span>
                    <b>{x.regle}</b> → {x.effet}
                  </span>
                </label>
                <button type="button" className="lien" onClick={() => setF({ ...f, exceptions: f.exceptions.filter((_, k) => k !== i) })}>
                  Retirer
                </button>
              </p>
            ))}
            <form
              className="ticket"
              onSubmit={(e) => {
                e.preventDefault();
                if (!exception.regle.trim() || !exception.effet.trim()) return;
                setF({ ...f, exceptions: [...f.exceptions, { regle: exception.regle.trim(), effet: exception.effet.trim(), actif: true }] });
                setException({ regle: '', effet: '', actif: true });
              }}
            >
              <label>
                Quand
                <input
                  type="text"
                  placeholder="1er et 3e vendredis"
                  value={exception.regle}
                  onChange={(e) => setException({ ...exception, regle: e.target.value })}
                />
              </label>
              <label>
                Ce qui change
                <input
                  type="text"
                  placeholder="resto à deux, dîner simple enfants"
                  value={exception.effet}
                  onChange={(e) => setException({ ...exception, effet: e.target.value })}
                />
              </label>
              <button type="submit" className="bouton-contour">
                Ajouter
              </button>
            </form>
          </section>
        </>
      )}

      <div className="budget-actions">
        {compact && (
          <button type="button" className="bouton-contour" onClick={() => onEnregistrer(foyer)}>
            Passer
          </button>
        )}
        <button type="button" className="bouton-plein" onClick={() => onEnregistrer(f)}>
          {compact ? 'Valider' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
