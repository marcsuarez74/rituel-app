import type { IconName } from '../Icon';

// 4 onglets (spec refonte §4.1) : l'ancien onglet Suivi devient une carte sur
// Aujourd'hui, l'accès au suivi poids vit dans Moi.
export type Onglet = 'aujourdhui' | 'semaine' | 'courses' | 'rituel';

export const ONGLETS: Array<{ id: Onglet; label: string; icone: IconName }> = [
  { id: 'aujourdhui', label: "Aujourd'hui", icone: 'home' },
  { id: 'semaine', label: 'Semaine', icone: 'calendrier' },
  { id: 'courses', label: 'Courses', icone: 'cart' },
  { id: 'rituel', label: 'Rituel', icone: 'pot' },
];
