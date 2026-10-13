import { useEffect } from 'react';

// Confettis (spec refonte §3.3, §4.4) : une salve quand `fete` passe à vrai,
// jamais sous prefers-reduced-motion, et sans animer si WAAPI manque
// (happy-dom). Les paillettes sont des spans fixes en haut de l'écran, animées
// par la Web Animations API puis retirées (le CSS .confetti fait le reste).
export function useConfettis(fete: boolean): void {
  useEffect(() => {
    if (!fete) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const couleurs = ['#4e9a3a', '#f2c230', '#5aaee0', '#e2553f', '#e08a1e', '#b8336a'];
    for (let k = 0; k < 36; k++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.setAttribute('aria-hidden', 'true');
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = couleurs[k % couleurs.length];
      c.style.borderRadius = k % 3 ? '2px' : '999px';
      document.body.appendChild(c);
      const anim = c.animate?.(
        [
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(${(Math.random() - 0.5) * 90}px, 65vh) rotate(${(Math.random() - 0.5) * 720}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 1400 + Math.random() * 900,
          delay: Math.random() * 300,
          easing: 'cubic-bezier(0.25, 0.6, 0.4, 1)',
          fill: 'forwards',
        },
      );
      if (anim) anim.onfinish = () => c.remove();
    }
    return () => document.querySelectorAll('.confetti').forEach((x) => x.remove());
  }, [fete]);
}
