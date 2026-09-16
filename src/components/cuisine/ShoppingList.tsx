import { useMemo, useState } from 'react';
import type { CourseItem } from '../../lib/model';
import { imagePourRayon } from '../../lib/rayons';
import { getChecks } from '../../lib/storage';
import { capitalize } from '../../lib/text';
import { Checklist } from '../Checklist';
import { Icon } from '../Icon';

export function ShoppingList({
  items,
  semaine,
  budget,
  syncVersion = 0,
}: {
  items: CourseItem[];
  semaine: string;
  budget?: string;
  syncVersion?: number;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  const [magasin, setMagasin] = useState(false);
  // Pattern render-phase reset — cf. Checklist.tsx : un changement remote
  // (syncVersion) ou de semaine relit le storage.
  const [synced, setSynced] = useState({ semaine, version: syncVersion });
  if (synced.semaine !== semaine || synced.version !== syncVersion) {
    setSynced({ semaine, version: syncVersion });
    setChecks(getChecks(semaine));
  }

  const groups = useMemo(() => {
    const grouped = new Map<string, CourseItem[]>();
    for (const it of items) {
      const list = grouped.get(it.rayon);
      if (list) list.push(it);
      else grouped.set(it.rayon, [it]);
    }
    return [...grouped.entries()].map(([rayon, groupItems]) => ({ rayon, items: groupItems }));
  }, [items]);

  if (items.length === 0) {
    return <p className="muted">Aucune course pour cette semaine.</p>;
  }

  const visibles = (list: CourseItem[]) => (magasin ? list.filter((it) => !checks[it.id]) : list);
  const total = items.length;
  const done = items.reduce((acc, it) => acc + (checks[it.id] ? 1 : 0), 0);
  const labelCourse = (it: CourseItem) => (
    <span className="course-label">
      <span>
        {it.label}
        {it.rituel && (
          <span className="item-rituel">
            <Icon name="pot" size={14} /> rituel
          </span>
        )}
      </span>
      {it.note && <span className="item-note">{it.note}</span>}
    </span>
  );
  return (
    <div>
      <div className="batch-banner">
        <span className="bb-ic">
          <Icon name="pot" size={16} />
        </span>
        <span>
          <b>Pensées pour le rituel</b> — les items marqués <Icon name="pot" size={14} />{' '}
          alimentent le batch de dimanche.
          {budget ? ` ${budget} estimés.` : ''}
        </span>
      </div>
      <p className="progress">
        {done}/{total} cochés
        <button
          type="button"
          className="mm"
          aria-pressed={magasin}
          onClick={() => setMagasin(!magasin)}
        >
          <Icon name="cart" size={14} /> {magasin ? 'Tout revoir' : 'Mode magasin'}
        </button>
        <progress value={done} max={total} />
      </p>
      {[...groups]
        .sort((a, b) => Number(a.rayon === 'keto') - Number(b.rayon === 'keto'))
        .map(({ rayon, items: groupItems }) => {
          const faits = groupItems.filter((it) => checks[it.id]).length;
          const affiches = visibles(groupItems);
          if (affiches.length === 0) return null;
          return rayon === 'keto' ? (
            <section className="keto-box" key={rayon}>
              <h3 className="keto-title">
                <Icon name="leaf" size={14} /> Les extras keto de Mélanie{' '}
                <span className="rayon-cnt">
                  {faits}/{groupItems.length}
                </span>
              </h3>
              <Checklist
                items={affiches}
                semaine={semaine}
                dataVersion={syncVersion}
                onChecksChange={(groupChecks) => setChecks((prev) => ({ ...prev, ...groupChecks }))}
                renderLabel={labelCourse}
              />
            </section>
          ) : (
            <section className="course-group" key={rayon}>
              <header className="course-group-header">
                <img
                  src={imagePourRayon(rayon)}
                  alt={capitalize(rayon)}
                  loading="lazy"
                  width={72}
                  height={54}
                />
                <h3>{capitalize(rayon)}</h3>
                <span className="rayon-cnt">
                  {faits}/{groupItems.length}
                </span>
              </header>
              <Checklist
                items={affiches}
                semaine={semaine}
                dataVersion={syncVersion}
                onChecksChange={(groupChecks) => setChecks((prev) => ({ ...prev, ...groupChecks }))}
                renderLabel={labelCourse}
              />
            </section>
          );
        })}
      {magasin && done === total && <p className="muted">Tout est coché — bonne course 👋</p>}
    </div>
  );
}
