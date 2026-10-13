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

// Bocal en verre : la couleur du plat en couvercle, l'aplat clair dedans.
export function Bocal({ vive, claire, taille = 44 }: { vive: string; claire: string; taille?: number }) {
  return (
    <svg width={taille} height={taille * 1.15} viewBox="0 0 44 51" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--encre)" strokeWidth="2.5" strokeLinejoin="round">
        <rect x="12" y="4" width="20" height="8" rx="2" fill={vive} />
        <path d="M10 12h24v6c4 2 4 4 4 8v18a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V26c0-4 0-6 4-8z" fill={claire} />
        <path d="M8 30h28" strokeDasharray="3 4" />
      </g>
    </svg>
  );
}

// Frigo fermé, congélateur, micro-ondes : aplats fixes (annexe A.4).
export function Frigo({ taille = 48 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--encre)" strokeWidth="2.5" strokeLinecap="round">
        <rect x="8" y="3" width="32" height="42" rx="6" fill="var(--fra-t)" />
        <path d="M8 18h32M14 9v5M14 23v8" />
      </g>
    </svg>
  );
}

export function FrigoGrand({ taille = 76 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille * 0.85} viewBox="0 0 96 82" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--encre)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="10" y="6" width="34" height="70" rx="6" fill="var(--fra-t)" />
        <path d="M10 32h34M16 14v10M16 40v12" />
        <rect x="52" y="34" width="38" height="24" rx="5" fill="#fbeeb0" />
        <path d="M52 44h38" />
        <rect x="62" y="26" width="18" height="8" rx="2" fill="#2fa58a" />
        <rect x="56" y="62" width="30" height="14" rx="3" fill="var(--kraft)" />
      </g>
    </svg>
  );
}

export function Congelateur({ taille = 48 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--encre)" strokeWidth="2.5" strokeLinecap="round">
        <rect x="5" y="10" width="38" height="30" rx="6" fill="var(--givre)" />
        <path d="M24 16v18M16 20l16 10M32 20L16 30" />
      </g>
    </svg>
  );
}

export function MicroOndes({ taille = 76 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille * 0.85} viewBox="0 0 96 82" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--encre)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="14" width="84" height="56" rx="8" fill="var(--leg-t)" />
        <rect x="14" y="22" width="52" height="40" rx="5" fill="var(--craie)" />
        <path d="M28 50c0-8 22-8 22 0z" fill="#e3b505" />
        <circle cx="78" cy="30" r="4" />
        <path d="M74 44h8M74 52h8" />
        <path d="M30 36c0-4 4-4 4-8M42 36c0-4 4-4 4-8" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function Legumes({ taille = 200 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille * 0.7} viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--encre)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 70c-6-24 10-44 30-40 6 14-6 38-30 40z" fill="#4e9a3a" />
        <path d="M48 30C38 44 28 58 18 70" />
        <circle cx="62" cy="54" r="18" fill="#e2553f" />
        <path d="M58 36c2 4 6 4 8 0" fill="#4e9a3a" />
        <path d="M80 30h20l-12 44z" fill="#e08a1e" />
        <path d="M88 30c-4-8 0-12 4-14M92 30c4-6 8-6 12-4" stroke="#4e9a3a" />
        <ellipse cx="104" cy="66" rx="12" ry="10" fill="#f2c230" />
      </g>
    </svg>
  );
}

// Sac de courses kraft (maquette §4.4) : bannière « tout est coché ».
export function IlluSac({ taille = 44 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille * 1.15} viewBox="0 0 48 55" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--encre)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 18h28l-3 32H13z" fill="#e2c08d" />
        <path d="M17 18c0-6 3-10 7-10s7 4 7 10" />
        <path d="M18 30h12M18 38h12" />
      </g>
    </svg>
  );
}
