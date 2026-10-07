import template from '../assets/prompt-cycle-template.md?raw';
import typesSource from './cycle/types.ts?raw';
import { ordreJours } from './cycle/calendrier';
import type { ReglagesFoyer } from './cycle/etat';
import { prenomMembre } from './cycle/menu';
import { ageDepuis } from './dates';
import type { ObjectifType, UserProfile } from './model';
import type { WeightEntry } from './storage';

// Prompt maître du cycle v2 (spec 2026-10-07 §6.1 + annexe) : le template ne
// contient que la structure ; l'app le remplit avec le foyer, la semaine type
// et le profil stockés sur le téléphone. Une ligne absente disparaît.

export const SEUIL_KETO_G = 30;

const OBJECTIFS_PROMPT: Record<ObjectifType, string> = {
  perte: 'perdre du poids',
  affiner: 'affiner la silhouette',
  masse: 'prendre de la masse',
  maintien: 'maintenir le poids',
};

const kg = (n: number): string => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

// Le contrat (interfaces Macros … CycleFichier) recopié tel quel depuis types.ts.
export const schemaContrat = (): string => {
  const debut = typesSource.indexOf('export interface Macros');
  const fin = typesSource.indexOf('// </schema>');
  return typesSource.slice(debut, fin).trim();
};

export interface ContextePrompt {
  foyer: ReglagesFoyer;
  profil: UserProfile;
  dernierPoids: WeightEntry | null;
  precedentes: string[];
}

const membres = ({ foyer, profil, dernierPoids }: ContextePrompt): string =>
  foyer.membres
    .map((m) => {
      const parties = [`- ${m.id} (${m.prenom}) · ${m.type}`];
      if (m.suivi) parties.push('suivi');
      if (m.regime && m.regime !== 'aucun') parties.push(`régime ${m.regime}`);
      if (m.type === 'enfant') parties.push('mange normalement, portion enfant');
      if (m.id === profil.id) {
        const cible = profil.poidsObjectif != null ? ` vers ${kg(profil.poidsObjectif)} kg` : '';
        parties.push(`objectif : ${OBJECTIFS_PROMPT[profil.objectif.type]}${cible}`);
        const corps = [
          profil.dateNaissance ? `${ageDepuis(profil.dateNaissance)} ans` : '',
          dernierPoids ? `${kg(dernierPoids.kg)} kg` : '',
          profil.taille != null ? `${profil.taille} cm` : '',
        ].filter(Boolean);
        if (corps.length) parties.push(corps.join(', '));
        if (profil.complements.length) parties.push(`compléments : ${profil.complements.join(', ')}`);
      }
      return parties.join(' · ');
    })
    .join('\n');

const semaineType = (foyer: ReglagesFoyer): string =>
  ordreJours(foyer.jourCourses)
    .map((jour) => {
      const j = foyer.semaine[jour];
      const dej = Object.entries(j.dejeuner)
        .map(([id, v]) => `${prenomMembre(foyer.membres, id)}=${v}`)
        .join(', ');
      const parties = [`- ${jour} : déjeuner ${dej || '—'} · dîner ${j.diner}`];
      if (j.plusTard.length)
        parties.push(`${j.plusTard.map((id) => prenomMembre(foyer.membres, id)).join(', ')} dîne plus tard`);
      for (const [id, v] of Object.entries(j.journee ?? {}))
        if (v !== 'standard') parties.push(`journée ${prenomMembre(foyer.membres, id)} : ${v}`);
      if (j.note) parties.push(j.note);
      return parties.join(' · ');
    })
    .join('\n');

export const assemblePromptIa = (c: ContextePrompt): string => {
  const { foyer, profil } = c;
  const magasin = foyer.magasin || profil.magasin;
  const budget = foyer.budgetMax ?? profil.budgetMax;
  const exceptions = foyer.exceptions.filter((e) => e.actif).map((e) => `${e.regle} → ${e.effet}`);
  const valeurs: Record<string, string> = {
    MEMBRES: membres(c),
    JOUR_COURSES: foyer.jourCourses,
    JOUR_RITUEL: foyer.jourRituel,
    SEMAINE_TYPE: semaineType(foyer),
    EXCEPTIONS: exceptions.length ? exceptions.join(' ; ') : 'aucune',
    COURSES: [
      `Magasin : ${magasin || 'supermarché habituel'}`,
      budget != null
        ? `budget max : ${budget} € par semaine pour TOUT le foyer (extras keto et articles fixes compris)`
        : 'pas de budget max fixé',
    ].join(' · '),
    PREFERENCES: profil.preferences?.length ? profil.preferences.join(', ').toLowerCase() : 'aucune',
    PRECEDENTES: c.precedentes.length ? c.precedentes.join(', ') : 'aucune (premier cycle)',
    REGLE_BUDGET:
      budget != null
        ? `Vise ≤ ${budget} € par semaine (ingrédients + fixes hebdo) en privilégiant les protéines économiques ; si c'est impossible sans trahir les cibles, garde le réalisme et écris-le dans \`remarques\` (estimé, écart, ce qui coûte).`
        : "Reste économique et indique l'estimation hebdomadaire dans `remarques`.",
    SEUIL_KETO: String(SEUIL_KETO_G),
    SCHEMA: schemaContrat(),
  };
  // Forme fonction de replace : le texte utilisateur n'est jamais lu comme un
  // motif ($&, $'…).
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (brut, cle: string) => valeurs[cle] ?? brut);
};
