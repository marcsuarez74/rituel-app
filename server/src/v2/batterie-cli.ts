import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { executerBatterie, PROFILS_DIFFICILES, rapport, TARIFS } from './batterie.js';
import { creerAppelClaude, lireEffort, MODELE_PAR_DEFAUT } from './ia.js';

// `npm run batterie` (dans server/) : la batterie contre l'API réelle — PAYANT, jamais en CI.
// Env : ANTHROPIC_API_KEY (obligatoire), IA_MODELE, IA_EFFORT, IA_QUOTA_JOUR,
// BATTERIE_REPETITIONS (défaut 1). Les menus obtenus vont dans batterie-resultats/ (git-ignoré).

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY manquante : la batterie appelle l’API réelle (payant).');
  process.exit(1);
}
const modele = process.env.IA_MODELE || MODELE_PAR_DEFAUT;
const effort = lireEffort(process.env.IA_EFFORT);
const repetitions = Math.max(1, Number(process.env.BATTERIE_REPETITIONS) || 1);
const quotaJour = Number(process.env.IA_QUOTA_JOUR) || 3;

console.log(`Batterie : ${modele}, effort ${effort}, ${PROFILS_DIFFICILES.length} profils × ${repetitions}.`);
const appel = creerAppelClaude({ client: new Anthropic(), modele, effort });
const mesures = await executerBatterie(appel, PROFILS_DIFFICILES, repetitions, Date.now, (m) =>
  console.log(
    `- ${m.profil} : ${m.ok ? 'ok' : `échec (${m.raison})`}, ${m.appels} appel(s), ${Math.round(m.dureeMs / 1000)} s`,
  ),
);
console.log(`\n${rapport(mesures, TARIFS[modele], quotaJour)}`);

const dossier = 'batterie-resultats';
mkdirSync(dossier, { recursive: true });
const fichier = `${dossier}/${new Date().toISOString().replace(/[:.]/g, '-')}-${modele}-${effort}.json`;
writeFileSync(fichier, JSON.stringify({ modele, effort, repetitions, mesures }, null, 2));
console.log(`\nMenus et mesures : ${fichier}`);
