import type { ReactNode } from 'react';

// Anneau « bourgeon » (maquette validée 2026-09-18) : piste, arc basilic à
// bouts arrondis, point citron en bout d'arc — il voyage le long de l'anneau
// à chaque pesée et disparaît à la boucle fermée. SVG maison, comme WeightChart.
export function ProgressRing({
  progress,
  children,
  ariaLabel,
}: {
  progress: number;
  children?: ReactNode;
  ariaLabel: string;
}) {
  const R = 48;
  const C = 2 * Math.PI * R;
  const p = Math.min(1, Math.max(0, progress));
  // Bourgeon : position angulaire depuis le haut, sens horaire (x = cx + r·sin, y = cy - r·cos).
  const angle = p * 2 * Math.PI;
  const bx = 60 + R * Math.sin(angle);
  const by = 60 - R * Math.cos(angle);
  const ferme = p > 0.985;
  return (
    <div className="progress-ring">
      <svg viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
        <circle cx="60" cy="60" r={R} className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r={R}
          className="ring-arc"
          strokeDasharray={`${p * C} ${C}`}
          transform="rotate(-90 60 60)"
        />
        {!ferme && <circle cx={bx} cy={by} r="6.5" className="ring-bud" />}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
