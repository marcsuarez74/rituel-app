import type { MenuDay, ReserveLigne, RituelEtape } from './model';
import { normaliseComplement } from './model';
import { slugify } from './parse';

// Durée totale du rituel = somme des créneaux « A-B min ». Un créneau non
// parsable est ignoré ; aucune minute exploitable → pas de badge (null).
export function dureeRituel(rituel: RituelEtape[] | undefined): string | null {
  if (!rituel?.length) return null;
  let total = 0;
  for (const e of rituel) {
    const m = e.creneau.match(/(\d+)\s*-\s*(\d+)\s*min/i);
    if (m) total += Number(m[2]) - Number(m[1]);
  }
  if (total <= 0) return null;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return h === 0 ? `≈ ${min} min` : min === 0 ? `≈ ${h} h` : `≈ ${h} h ${min}`;
}

export type ReserveIcone = 'box' | 'bowl' | 'pasta' | 'snow' | 'fish' | 'leaf';

// Icône DÉCORATIVE de la réserve — déduite par mots-clés du plat + conservation
// (sans casse ni accents, via normaliseComplement). La clé `mel` et le mot
// `keto` priment (feuille) ; jamais une information, juste un visuel.
export function iconeReserve(ligne: ReserveLigne): ReserveIcone {
  const t = normaliseComplement(`${ligne.plat} ${ligne.conservation}`);
  if (ligne.cle === 'mel' || /keto|mel\b/.test(t)) return 'leaf';
  if (/congel/.test(t)) return 'snow';
  if (/poisson|saumon|sardine|maquereau/.test(t)) return 'fish';
  if (/pates/.test(t)) return 'pasta';
  if (/salade/.test(t)) return 'bowl';
  return 'box';
}

// Id de coche d'une ligne de réserve — stable : dérive de la clé et du plat,
// jamais de l'ordre du fichier (renommer le plat perd l'état, comme partout).
export const reserveId = (ligne: ReserveLigne): string =>
  `reserve:${ligne.cle}:${slugify(ligne.plat)}`;

export interface SoirJoker {
  jour: string;
  ligne: ReserveLigne;
}

// Soirs sans dîner planifié (ni diner-famille ni diner-melanie) ayant une ligne
// de réserve dédiée → suggestion « Sors la réserve » dans l'onglet Menu.
// La clé « mel » n'est jamais suggérée (elle n'est pas un soir).
export function soirsSansDiner(menu: MenuDay[], reserve: ReserveLigne[]): SoirJoker[] {
  const out: SoirJoker[] = [];
  for (const day of menu) {
    if (day.dinerFamille || day.dinerMelanie) continue;
    const cle = day.jour.trim().toLowerCase();
    const ligne = reserve.find((l) => l.cle === cle);
    if (ligne) out.push({ jour: day.jour, ligne });
  }
  return out;
}
