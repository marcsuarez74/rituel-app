import { useEffect, useState } from 'react';
import { Icon } from './Icon';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Minuteur d'étape : un tap lance, un tap arrête ; vibre à la fin si possible.
export function Minuteur({ minutes }: { minutes: number }) {
  const [fin, setFin] = useState<number | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (fin == null) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [fin]);
  const reste = fin == null ? null : Math.max(0, Math.ceil((fin - maintenant) / 1000));
  useEffect(() => {
    if (reste === 0) navigator.vibrate?.([300, 150, 300]);
  }, [reste]);

  const lancer = () => {
    const n = Date.now();
    setMaintenant(n);
    setFin(n + minutes * 60_000);
  };
  return (
    <button
      type="button"
      className={reste === 0 ? 'minuteur termine' : 'minuteur'}
      aria-live="polite"
      onClick={fin == null ? lancer : () => setFin(null)}
    >
      <Icon name="clock" size={16} />
      {reste == null ? `Minuteur ${minutes} min` : reste === 0 ? 'Terminé · OK' : `${mmss(reste)} · Arrêter`}
    </button>
  );
}
