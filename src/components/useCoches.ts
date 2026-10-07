import { useState } from 'react';
import { getChecks, setCheck } from '../lib/storage';

// Coches d'une semaine du cycle (clé `cycle:{id}:{n}`), relues quand la
// semaine ou la version de sync change — pattern render-phase reset du repo.
export function useCoches(semaine: string, syncVersion: number) {
  const [coches, setCoches] = useState(() => getChecks(semaine));
  const [synced, setSynced] = useState({ semaine, syncVersion });
  if (synced.semaine !== semaine || synced.syncVersion !== syncVersion) {
    setSynced({ semaine, syncVersion });
    setCoches(getChecks(semaine));
  }
  const basculer = (id: string) => {
    const fait = !coches[id];
    setCheck(semaine, id, fait);
    setCoches((c) => ({ ...c, [id]: fait }));
  };
  return { coches, basculer };
}
