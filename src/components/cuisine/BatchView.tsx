import { useRef, useState } from 'react';
import type { MicroBatchJour, ReserveLigne, RituelEtape } from '../../lib/model';
import { getChecks, setCheck } from '../../lib/storage';
import { todayKey } from '../../lib/dates';
import { capitalize } from '../../lib/text';
import { dureeRituel, iconeReserve } from '../../lib/batch';
import { Icon } from '../Icon';

export function BatchView({
  rituel,
  microBatch,
  reserve,
  production,
  termine,
  semaine,
  syncVersion = 0,
}: {
  rituel?: RituelEtape[];
  microBatch?: MicroBatchJour[];
  reserve?: ReserveLigne[];
  production?: string;
  termine?: string;
  semaine: string;
  syncVersion?: number;
}) {
  const [mode, setMode] = useState<'apercu' | 'run' | 'fini'>('apercu');
  const [idx, setIdx] = useState(0);
  // Garde anti-crash : BatchView reste montée au changement de semaine (chevrons) ;
  // si le rituel raccourcit sous l'étape en cours, le run n'est plus valide → aperçu.
  // Garde différentielle (ne re-tire que si l'état diffère) et muette au premier montage.
  if (mode === 'run' && !(rituel && idx < rituel.length)) {
    setMode('apercu');
    setIdx(0);
  }
  const hasRituel = !!rituel?.length;
  const hasMicro = !!microBatch?.length;
  const hasReserve = !!reserve?.length;
  const ceSoir = microBatch?.find((m) => m.jour === todayKey());

  return (
    <>
      {ceSoir && (
        <div className="batch-banner ce-soir">
          <span className="bb-ic">
            <Icon name="moon" size={16} />
          </span>
          <span>
            <b>Ce soir ({ceSoir.jour})</b> — {ceSoir.quoi}
          </span>
        </div>
      )}
      {hasRituel && rituel && mode === 'apercu' && (
        <RituelTimeline
          etapes={rituel}
          production={production}
          semaine={semaine}
          syncVersion={syncVersion}
          onLancer={() => {
            setMode('run');
            setIdx(0);
          }}
        />
      )}
      {hasRituel && rituel && mode === 'run' && idx < rituel.length && (
        <section className="batch-section batch-guide" aria-live="polite">
          <div className="guide-etape-num">
            Étape {idx + 1}/{rituel.length} · {rituel[idx].creneau}
          </div>
          <h3 className="guide-titre">{rituel[idx].label}</h3>
          {rituel[idx].detail && <p className="guide-detail">{rituel[idx].detail}</p>}
          <progress value={idx} max={rituel.length} aria-hidden="true" />
          <button
            type="button"
            className="btn"
            onClick={() => (idx + 1 < rituel.length ? setIdx(idx + 1) : setMode('fini'))}
          >
            {idx + 1 < rituel.length ? 'Étape terminée →' : 'Terminer le rituel ✓'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setMode('apercu');
              setIdx(0);
            }}
          >
            Revenir à l'aperçu
          </button>
        </section>
      )}
      {hasRituel && mode === 'fini' && (
        <section className="batch-section batch-guide" aria-live="polite">
          <span className="guide-done-ic">
            <Icon name="check" size={38} strokeWidth={2.5} />
          </span>
          <h3 className="guide-titre">Rituel terminé !</h3>
          <p className="guide-detail">{termine ?? 'Tout est prêt pour la semaine.'}</p>
          <button type="button" className="btn-ghost" onClick={() => setMode('apercu')}>
            Revoir l'aperçu
          </button>
        </section>
      )}
      {hasMicro && mode === 'apercu' && microBatch && <MicroBatch jours={microBatch} />}
      {mode === 'apercu' && hasReserve && reserve && <Reserve lignes={reserve} />}
      {!hasRituel && !hasMicro && !hasReserve && <p className="muted">Aucun rituel prévu cette semaine.</p>}
    </>
  );
}

function MicroBatch({ jours }: { jours: MicroBatchJour[] }) {
  const [actif, setActif] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const auScroll = () => {
    const el = ref.current;
    if (!el) return;
    const premier = el.firstElementChild as HTMLElement | null;
    const largeur = premier ? premier.offsetWidth + 8 : 158;
    setActif(Math.min(jours.length - 1, Math.max(0, Math.round(el.scrollLeft / largeur))));
  };
  return (
    <section className="batch-section">
      <h3>Micro-batch en semaine</h3>
      <div className="micro-batch" ref={ref} onScroll={auScroll}>
        {jours.map((m) => (
          <div className="micro-jour" key={m.jour}>
            <div className="micro-jour-nom">{capitalize(m.jour)}</div>
            <div className="micro-jour-quoi">{m.quoi}</div>
            {m.detail && <div className="micro-jour-detail">{m.detail}</div>}
          </div>
        ))}
      </div>
      <div className="micro-dots" aria-hidden="true">
        {jours.map((_, i) => (
          <i key={i} className={i === actif ? 'on' : ''} />
        ))}
      </div>
    </section>
  );
}

function Reserve({ lignes }: { lignes: ReserveLigne[] }) {
  return (
    <section className="batch-section">
      <h3>La réserve — au frigo cette semaine</h3>
      <div className="reserve-list">
        {lignes.map((l, i) => (
          <div className="reserve-ligne" key={`${l.cle}-${i}`}>
            <span className="reserve-ic">
              <Icon name={iconeReserve(l)} size={16} />
            </span>
            <span className="reserve-corps">
              <span className="reserve-nom">
                {l.cle === 'mel' ? 'Mél' : capitalize(l.cle)} — {l.plat}
              </span>
              <span className="reserve-cons">{l.conservation}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RituelTimeline({
  etapes,
  production,
  semaine,
  syncVersion = 0,
  onLancer,
}: {
  etapes: RituelEtape[];
  production?: string;
  semaine: string;
  syncVersion?: number;
  onLancer: () => void;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  // Pattern render-phase reset — cf. Checklist.tsx : un changement remote
  // (syncVersion) ou de semaine relit le storage.
  const [synced, setSynced] = useState({ semaine, version: syncVersion });
  if (synced.semaine !== semaine || synced.version !== syncVersion) {
    setSynced({ semaine, version: syncVersion });
    setChecks(getChecks(semaine));
  }
  const duree = dureeRituel(etapes);
  const toggle = (id: string) => {
    const next = !checks[id];
    setCheck(semaine, id, next);
    setChecks((prev) => ({ ...prev, [id]: next }));
  };
  return (
    <section className="batch-section">
      <div className="batch-section-head">
        <h3>Rituel dimanche</h3>
        {duree && (
          <span className="rituel-badge">
            <Icon name="clock" size={14} />
            {duree}
          </span>
        )}
      </div>
      {production && <p className="rituel-production">{production}</p>}
      <ol className="rituel-timeline">
        {etapes.map((e) => (
          <li className={checks[e.id] ? 'rituel-etape done' : 'rituel-etape'} key={e.id}>
            <label>
              <input
                type="checkbox"
                checked={!!checks[e.id]}
                onChange={() => toggle(e.id)}
                aria-label={`${e.label} (${e.creneau})`}
              />
              <span className="rituel-corps">
                <span className="rituel-label">
                  {e.label}
                  <span className="rituel-creneau">{e.creneau}</span>
                </span>
                {e.detail && <span className="rituel-detail">{e.detail}</span>}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <button type="button" className="btn lancer-btn" onClick={onLancer}>
        <Icon name="play" size={14} /> Lancer le rituel
      </button>
    </section>
  );
}
