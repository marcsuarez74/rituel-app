// Illustrations SVG inline (spec refonte §3.3, annexe A.4) : trait d'encre,
// aplats de couleur — pas d'image raster. La box reçoit la couleur du plat.
export function IlluBox({ vive, claire, jour }: { vive: string; claire: string; jour?: string }) {
  return (
    <svg width="86" height="69" viewBox="0 0 86 69" aria-hidden="true" focusable="false">
      <g>
        <rect x="6" y="22" width="74" height="42" rx="10" fill={claire} stroke="var(--encre)" strokeWidth="2.5" />
        <path d="M6 34h74" stroke="var(--encre)" strokeWidth="2" />
        <rect x="4" y="16" width="78" height="14" rx="6" fill={vive} stroke="var(--encre)" strokeWidth="2.5" />
        {jour && (
          <g>
            <rect x="24" y="40" width="38" height="16" rx="3" fill="var(--kraft)" stroke="var(--encre)" strokeWidth="2" />
            <text
              x="43"
              y="52.5"
              textAnchor="middle"
              fontFamily="'Bricolage Grotesque', sans-serif"
              fontSize="11"
              fontWeight="800"
              fill="var(--encre)"
            >
              {jour}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

// La marmite du rituel (pot tomate, vapeur), posée sur l'ardoise sombre.
export function IlluCasserole({ taille = 84 }: { taille?: number }) {
  return (
    <svg
      width={taille}
      height={taille * 0.85}
      viewBox="0 0 96 82"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="var(--encre)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M14 40h68v22a14 14 0 0 1-14 14H28a14 14 0 0 1-14-14z"
          fill="#e2553f"
        />
        <path d="M4 40h88M40 40v-6h16v6" />
        <path d="M34 20c0-6 6-6 6-12M48 22c0-6 6-6 6-12M62 20c0-6 6-6 6-12" stroke="var(--craie-jaune)" strokeWidth="2" />
        <path d="M24 54h10" stroke="var(--craie)" strokeWidth="3" />
      </g>
    </svg>
  );
}
