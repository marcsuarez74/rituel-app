import { describe, expect, it } from 'vitest';
import { creerAppelClaude, type OptionsClaude } from '../src/v2/ia.js';
import { PROMPT_FIXE } from '../src/v2/prompt.js';

// Adaptateur Claude (plan 2026-10-16-app-native §A.7) : le client du SDK est simulé, on vérifie
// la requête envoyée et la lecture de la réponse.

const usage = { input_tokens: 100, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 50 };

const simuler = (reponse: Record<string, unknown>) => {
  const params: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream: (p: Record<string, unknown>) => {
          params.push(p);
          return { finalMessage: async () => ({ usage, ...reponse }) };
        },
      },
    },
  } as unknown as OptionsClaude['client'];
  return { appel: creerAppelClaude({ client, modele: 'claude-opus-5-5', effort: 'medium' }), params };
};

const requete = { format: 'menus' as const, messages: [{ role: 'user' as const, content: 'profil' }] };

describe('creerAppelClaude', () => {
  it('envoie le prompt fixe en cache, la sortie structurée, l’effort et le repli serveur', async () => {
    const { appel, params } = simuler({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] });
    await appel(requete);
    const p = params[0];
    expect(p).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
      system: [{ type: 'text', text: PROMPT_FIXE, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
      messages: requete.messages,
    });
    expect(JSON.stringify(p.output_config)).toContain('semaines');
  });

  it('format recette → schéma d’une recette', async () => {
    const { appel, params } = simuler({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] });
    await appel({ ...requete, format: 'recette' });
    const schema = JSON.stringify(params[0].output_config);
    expect(schema).toContain('etapes');
    expect(schema).not.toContain('semaines');
  });

  it('texte et jetons (cache compris)', async () => {
    const { appel } = simuler({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] });
    expect(await appel(requete)).toEqual({ fin: 'ok', texte: '{"a":1}', jetons: { entree: 150, sortie: 50 } });
  });

  it('après un repli, seul le texte du modèle qui a fini compte', async () => {
    const { appel } = simuler({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"semai' }, { type: 'fallback' }, { type: 'text', text: '{"ok":1}' }],
    });
    expect((await appel(requete)).texte).toBe('{"ok":1}');
  });

  it('refus → « refus » ; max_tokens ou autre arrêt → « coupe »', async () => {
    expect((await simuler({ stop_reason: 'refusal', content: [] }).appel(requete)).fin).toBe('refus');
    for (const stop_reason of ['max_tokens', 'model_context_window_exceeded'])
      expect((await simuler({ stop_reason, content: [{ type: 'text', text: '{"se' }] }).appel(requete)).fin).toBe('coupe');
  });
});
