import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ChecklistItem } from '../lib/model';
import { getChecks, setCheck } from '../lib/storage';

export function Checklist<T extends ChecklistItem>({
  items,
  semaine,
  dataVersion = 0,
  className,
  onChecksChange,
  renderLabel,
}: {
  items: T[];
  semaine: string;
  dataVersion?: number;
  className?: string;
  onChecksChange?: (checks: Record<string, boolean>) => void;
  renderLabel?: (item: T) => ReactNode;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  // Pattern render-phase reset (syncedSemaine) étendu à la version de sync :
  // un changement remote (dataVersion) ou de semaine relit le storage.
  const [synced, setSynced] = useState({ semaine, version: dataVersion });
  if (synced.semaine !== semaine || synced.version !== dataVersion) {
    setSynced({ semaine, version: dataVersion });
    setChecks(getChecks(semaine));
  }
  const toggle = (item: ChecklistItem) => {
    const done = !checks[item.id];
    setCheck(semaine, item.id, done);
    const next = { ...checks, [item.id]: done };
    setChecks(next);
    onChecksChange?.({ [item.id]: done });
  };
  return (
    <ul className={className ? `checklist ${className}` : 'checklist'}>
      {items.map((it) => (
        <li key={it.id}>
          <label className={checks[it.id] ? 'done' : ''}>
            <input type="checkbox" checked={!!checks[it.id]} onChange={() => toggle(it)} />
            {renderLabel ? renderLabel(it) : <span>{it.label}</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}
