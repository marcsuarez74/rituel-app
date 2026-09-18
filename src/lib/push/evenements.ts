// Détection des événements push depuis les mutations envoyées (pur, testé).
// Appelée par le câblage App après flush confirmée — l'envoi ne part jamais
// en optimiste.

import type { EvenementType } from './module';
import type { MutationSync } from '../sync/outbox';

export interface EvenementDetecte {
  type: EvenementType;
  label: string;
}

// menu:{jour}:{clé} — seuls les deux dîners déclenchent (le texte du menu est
// le label de la notification).
const MENU_DINER = /^menu:([^:]+):diner(Famille|Melanie)$/;

const fr = (n: number): string => String(n).replace('.', ',');

export const evenementsDepuisMutations = (
  mutations: MutationSync[],
  menuLabel: (jour: string, cle: string) => string | null,
): EvenementDetecte[] => {
  const evenements: EvenementDetecte[] = [];
  for (const m of mutations) {
    if (m.op !== 'upsert' || !m.payload) continue;
    if (m.table === 'checks') {
      const id = m.key.check_id;
      const match = typeof id === 'string' ? MENU_DINER.exec(id) : null;
      if (!match || m.payload.done !== true) continue;
      const label = menuLabel(match[1]!, match[2] === 'Famille' ? 'dinerFamille' : 'dinerMelanie');
      if (label) evenements.push({ type: 'diner', label });
    } else if (m.table === 'weights') {
      const kg = m.payload.kg;
      if (typeof kg === 'number' && Number.isFinite(kg)) {
        evenements.push({ type: 'pesee', label: `${fr(kg)} kg` });
      }
    } else if (m.table === 'depenses') {
      const { magasin, total } = m.payload;
      if (typeof total === 'number' && Number.isFinite(total) && typeof magasin === 'string') {
        evenements.push({ type: 'courses', label: `${fr(total)} € chez ${magasin}` });
      }
    }
  }
  return evenements;
};
