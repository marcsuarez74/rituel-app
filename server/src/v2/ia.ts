import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { AppelIA, ReponseIA } from './generer.js';
import { PROMPT_FIXE } from './prompt.js';
import { schemaSortieMenus, schemaSortiePlatFrais, schemaSortiePlatRituel } from './schema.js';

// Adaptateur Claude de la génération (plan 2026-10-16-app-native §A.7) : la seule pièce qui
// parle à l'API. Streaming (4 semaines = sortie longue), sortie structurée, prompt fixe en cache,
// repli serveur si le modèle décline. Le texte est relu par generer.ts : on ne laisse pas le SDK
// parser lui-même (il lèverait avant qu'on lise stop_reason sur une sortie coupée).

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

/** IA_EFFORT de l'environnement ; absent ou inconnu = medium. */
export const lireEffort = (v: string | undefined): Effort => EFFORTS.find((e) => e === v) ?? 'medium';
export const MODELE_PAR_DEFAUT = 'claude-opus-5-5';

export interface OptionsClaude {
  client: Pick<Anthropic, 'beta'>;
  modele: string;
  effort: Effort;
}

const MAX_TOKENS = 64_000;
const BETA_REPLI = 'server-side-fallback-2026-07-01';

// Schéma JSON sans la fonction parse du helper : on garde la main sur la lecture.
const FORMATS = {
  menus: {
    type: 'json_schema',
    schema: betaZodOutputFormat(schemaSortieMenus).schema,
  },
  'plat-frais': {
    type: 'json_schema',
    schema: betaZodOutputFormat(schemaSortiePlatFrais).schema,
  },
  'plat-rituel': {
    type: 'json_schema',
    schema: betaZodOutputFormat(schemaSortiePlatRituel).schema,
  },
} as const;

export const creerAppelClaude = ({ client, modele, effort }: OptionsClaude): AppelIA => {
  return async ({ format, messages }): Promise<ReponseIA> => {
    const message = await client.beta.messages
      .stream({
        model: modele,
        max_tokens: MAX_TOKENS,
        betas: [BETA_REPLI],
        fallbacks: 'default',
        // Le prompt fixe d'abord, en cache ; le cache automatique couvre en plus la conversation
        // (les corrections renvoient la longue sortie précédente).
        system: [
          {
            type: 'text',
            text: PROMPT_FIXE,
            cache_control: { type: 'ephemeral' },
          },
        ],
        cache_control: { type: 'ephemeral' },
        output_config: { effort, format: FORMATS[format] },
        messages,
      })
      .finalMessage();

    const u = message.usage;
    const jetons = {
      entree: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      sortie: u.output_tokens,
      cacheLu: u.cache_read_input_tokens ?? 0,
      cacheEcrit: u.cache_creation_input_tokens ?? 0,
    };
    if (message.stop_reason === 'refusal') return { fin: 'refus', texte: '', jetons };
    if (message.stop_reason !== 'end_turn') return { fin: 'coupe', texte: '', jetons };
    // Après un repli, seul le texte du modèle qui a terminé compte.
    const dernierRepli = message.content.reduce((d, b, i) => (b.type === 'fallback' ? i : d), -1);
    const texte = message.content
      .slice(dernierRepli + 1)
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');
    return { fin: 'ok', texte, jetons };
  };
};
