import { describe, expect, it } from 'vitest';
import { hashCode, signerToken, verifierCode, verifierToken } from '../src/auth.js';

const SECRET = 'secret-de-test-0123456789abcdef';

describe('server: auth — code foyer (PBKDF2)', () => {
  it('hashCode produit le format pbkdf2-sha256$100000$salt$hash, jamais le code en clair', () => {
    const hash = hashCode('romarin-basilic-3f9a2c7e');
    expect(hash).toMatch(/^pbkdf2-sha256\$100000\$[\w-]{22}\$[\w-]{43}$/);
    expect(hash).not.toContain('romarin');
  });

  it('verifierCode : vrai code OK, faux code refusé, hash malformé refusé', () => {
    const hash = hashCode('romarin-basilic-3f9a2c7e');
    expect(verifierCode('romarin-basilic-3f9a2c7e', hash)).toBe(true);
    expect(verifierCode('thym-menthe-00000000', hash)).toBe(false);
    expect(verifierCode('x', 'nimporte-quoi')).toBe(false);
  });

  it('deux hash du même code diffèrent (salt aléatoire) mais se vérifient tous deux', () => {
    const h1 = hashCode('code-de-foyer-long');
    const h2 = hashCode('code-de-foyer-long');
    expect(h1).not.toBe(h2);
    expect(verifierCode('code-de-foyer-long', h2)).toBe(true);
  });
});

describe('server: auth — JWT HS256', () => {
  it('signerToken puis verifierToken rend le foyerId', () => {
    const token = signerToken('foyer-1', SECRET);
    expect(token.split('.')).toHaveLength(3);
    expect(verifierToken(token, SECRET)).toBe('foyer-1');
  });

  it('mauvais secret → null', () => {
    expect(verifierToken(signerToken('foyer-1', SECRET), 'autre-secret')).toBeNull();
  });

  it('token expiré → null', () => {
    const token = signerToken('foyer-1', SECRET, -10); // exp dans le passé
    expect(verifierToken(token, SECRET)).toBeNull();
  });

  it('payload altéré → null', () => {
    const token = signerToken('foyer-1', SECRET);
    const [entete, , signature] = token.split('.');
    const corps = Buffer.from(JSON.stringify({ foyerId: 'foyer-2', exp: 9999999999 })).toString('base64url');
    expect(verifierToken(`${entete}.${corps}.${signature}`, SECRET)).toBeNull();
  });

  it('token malformé → null', () => {
    expect(verifierToken('abc', SECRET)).toBeNull();
  });
});
