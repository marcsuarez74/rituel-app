import { useState } from 'react';
import { type Report, getReports, saveReports } from '../lib/cycle/etat';

// Reports d'un cycle, relus quand le cycle ou la version de sync change
// (pattern render-phase reset, comme useCoches).
export function useReports(cycleId: string, syncVersion: number) {
  const [reports, setReports] = useState(() => getReports(cycleId));
  const [synced, setSynced] = useState({ cycleId, syncVersion });
  if (synced.cycleId !== cycleId || synced.syncVersion !== syncVersion) {
    setSynced({ cycleId, syncVersion });
    setReports(getReports(cycleId));
  }
  const enregistrer = (r: Report[]) => {
    saveReports(cycleId, r);
    setReports(r);
  };
  return { reports, enregistrer };
}
