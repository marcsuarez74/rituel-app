import type { IconName } from '../Icon';

export type Onglet = 'aujourdhui' | 'menu' | 'courses' | 'rituel' | 'suivi';

export const ONGLETS: Array<{ id: Onglet; label: string; icone: IconName }> = [
  { id: 'aujourdhui', label: "Aujourd'hui", icone: 'home' },
  { id: 'menu', label: 'Menu', icone: 'couverts' },
  { id: 'courses', label: 'Courses', icone: 'cart' },
  { id: 'rituel', label: 'Rituel', icone: 'pot' },
  { id: 'suivi', label: 'Suivi', icone: 'courbe' },
];
