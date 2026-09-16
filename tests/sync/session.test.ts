import { definirSession, effacerSession, lireSession } from '../../src/lib/sync/session';

describe('sync: session foyer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lireSession est null sans connexion', () => {
    expect(lireSession()).toBeNull();
  });

  it('definirSession puis lireSession restitue token et foyer', () => {
    definirSession('jwt.xxx.yyy', '11111111-2222-3333-4444-555555555555');
    expect(lireSession()).toEqual({
      token: 'jwt.xxx.yyy',
      foyerId: '11111111-2222-3333-4444-555555555555',
    });
  });

  it('effacerSession supprime tout', () => {
    definirSession('t', 'f');
    effacerSession();
    expect(lireSession()).toBeNull();
  });

  it('lireSession est null si un seul des deux champs manque', () => {
    localStorage.setItem('sportapp:sync:token', 't');
    expect(lireSession()).toBeNull();
  });
});
