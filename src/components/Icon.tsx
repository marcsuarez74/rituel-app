import type { ReactNode } from 'react';

// Icônes maison — chemins repris de la maquette Herbes validée.
// Trait adaptatif : 2 px, 2,5 sous 16 px (lisibilité), currentColor, bouts arrondis.
const ICONS = {
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.3 11.5h9.9l1.8-8H6.2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r=".5" />
    </>
  ),
  chev: <path d="M6 9.5l6 6 6-6" />,
  'chev-left': <path d="M14.5 6l-6 6 6 6" />,
  'chev-right': <path d="M9.5 6l6 6-6 6" />,
  pot: (
    <>
      <path d="M6 10.5h12v4.5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" />
      <path d="M3.5 10.5h17M10 10.5V8h4v2.5" />
    </>
  ),
  scale: (
    <path d="M12 4v16M8.5 20h7M5 7h14M5 7l-2.8 5.5a3.2 3.2 0 0 0 5.6 0zM19 7l-2.8 5.5a3.2 3.2 0 0 0 5.6 0z" />
  ),
  moon: <path d="M20 13.5A8 8 0 1 1 10.5 4a6.3 6.3 0 0 0 9.5 9.5z" />,
  box: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="2" />
      <path d="M4 13.5h16M12 13.5V20" />
    </>
  ),
  snow: <path d="M12 3v18M4.5 7.8l15 8.4M19.5 7.5l-15 9" />,
  fish: (
    <>
      <path d="M15.5 12c0 2.8-2.4 5-5.5 5-2.8 0-5.3-2-7-5 1.7-3 4.3-5 7-5 3.1 0 5.5 2.2 5.5 5z" />
      <path d="M15.5 12l4.5-3.5v7z" />
      <circle cx="7.6" cy="11" r=".8" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C10.5 4 4.5 10 4.5 18c0 .8.2 2 .2 2s9-.4 12.8-5.5C20 7.5 20 4 20 4z" />
      <path d="M5.5 19.5C8 13.5 12 9.5 16.5 7.5" />
    </>
  ),
  wheat: (
    <>
      <path d="M12 21V8" />
      <path d="M12 8C9.5 8 7.5 6 7.5 3.5 10 3.5 12 5.5 12 8zM12 8c2.5 0 4.5-2 4.5-4.5C14 3.5 12 5.5 12 8zM12 14.5c-2.5 0-4.5-2-4.5-4.5 2.5 0 4.5 2 4.5 4.5zM12 14.5c2.5 0 4.5-2 4.5-4.5-2.5 0-4.5 2-4.5 4.5z" />
    </>
  ),
  bowl: (
    <>
      <path d="M4 12h16a8 8 0 0 1-16 0z" />
      <path d="M9.5 12c0-2.2 1.1-3.7 2.5-3.7s2.5 1.5 2.5 3.7" />
    </>
  ),
  pasta: (
    <>
      <path d="M4 12h16a8 8 0 0 1-16 0z" />
      <path d="M8.5 12V6.5M11.5 12V5.5M14.5 12V5.5M17 12V7" />
    </>
  ),
  meat: (
    <>
      <circle cx="13.5" cy="8.5" r="4.7" />
      <path d="M10.2 11.8L6.5 15.5" />
      <circle cx="5.6" cy="16.4" r="1.1" />
      <circle cx="7.6" cy="18.4" r="1.2" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 6.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  flame: (
    <path d="M12 3.5c.8 2.8 3.5 4.2 3.5 7.5a3.5 3.5 0 0 1-7 0c0-1.3.4-2.4 1.2-3.4.4.9 1 1.6 1.9 2-.7-2-.4-4.2.4-6.1z" />
  ),
  drop: <path d="M12 3.5c3.5 4 6 7.2 6 10.2a6 6 0 0 1-12 0c0-3 2.5-6.2 6-10.2z" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
    </>
  ),
  play: <path d="M8 5.5v13l10-6.5z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8.1v.1" />
    </>
  ),
  home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5H6a2 2 0 00-2 2v9" />
    </>
  ),
  refresh: <path d="M20 12a8 8 0 11-2.6-5.9M17 4v5h5" />,
  // Seul glyphe en remplissage (pas de trait) : stroke="none" neutralise
  // le stroke courant hérité du <svg> racine.
  user: (
    <>
      <circle cx="12" cy="8" r="4" fill="currentColor" stroke="none" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" stroke="none" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  strokeWidth,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  // Lisibilité : sous 16 px le trait passe à 2,5 (les petits tracés 24-unités
  // tombaient sous ~1 px réel). La prop explicite reste prioritaire.
  const trait = strokeWidth ?? (size < 16 ? 2.5 : 2);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={trait}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
