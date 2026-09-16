import { describe, expect, it } from 'vitest';
import { messageConnexion } from '../../src/lib/sync/messages';

// L'engine distingue code refusé / indisponible — l'UI parle utilisateur
// (message partagé ProfilScreen + onboarding étape 6).
describe('messageConnexion', () => {
  it('code-refuse : message de refus du code', () => {
    expect(messageConnexion(new Error('code-refuse'))).toMatch(/refusé/i);
  });

  it('autre erreur (indisponible, réponse invalide, inconnue) : connexion impossible', () => {
    const attente = 'Connexion impossible pour le moment. Réessaie plus tard.';
    expect(messageConnexion(new Error('indisponible'))).toBe(attente);
    expect(messageConnexion(new Error('reponse-invalide'))).toBe(attente);
    expect(messageConnexion('boom')).toBe(attente); // pas une Error
  });
});
