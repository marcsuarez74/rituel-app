import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// Gate push simulé actif + clé VAPID + URL Supabase : tout le module est
// piloté par ce mock (pattern tests/sync/).
vi.mock('../../../src/lib/push/config', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  VAPID_PUBLIC_KEY: 'BDcDi8ilA-WsWON4Q3V7qzqzJxpKGJHwIVYH8xrHkWaGSqoJTq0RBKx2vB58nEBzYl0K2KFWuO5PkWFoFriN1mY',
  pushActif: vi.fn(() => true),
}));

import { pushActif } from '../../../src/lib/push/config';
import {
  configDefaut,
  desabonner,
  deviceId,
  envoyerEvenement,
  majConfig,
  souscrireEtEnregistrer,
} from '../../../src/lib/push/module';

const PROFIL_MARC = {
  id: 'marc',
  dateNaissance: '1990-01-01',
  taille: 180,
  objectif: { type: 'maintien' },
  complements: [],
  regime: 'aucun',
};

const subJson = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test',
  keys: { p256dh: 'B0p256dh', auth: 'auth16' },
};

const subscription = {
  endpoint: subJson.endpoint,
  keys: subJson.keys,
  toJSON: () => subJson,
  unsubscribe: vi.fn(async () => true),
};

type Sub = typeof subscription;

const getSubscriptionMock = vi.fn<() => Promise<Sub | null>>(async () => subscription);

const registration = {
  pushManager: {
    subscribe: vi.fn<() => Promise<Sub>>(async () => subscription),
    getSubscription: getSubscriptionMock,
  },
};

const fetchMock = vi.fn(async (): Promise<Response> => new Response('ok', { status: 200 }));

const dernierAppel = (): [string, RequestInit] =>
  fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as unknown as [string, RequestInit];

const prepare = (): void => {
  localStorage.setItem('sportapp:profile', JSON.stringify(PROFIL_MARC));
  localStorage.setItem('sportapp:sync:token', 'jeton-foyer');
  localStorage.setItem('sportapp:sync:foyer', 'foyer-1');
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  vi.stubGlobal(
    'Notification',
    { requestPermission: vi.fn(async () => 'granted') },
  );
  vi.stubGlobal('fetch', fetchMock);
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(pushActif).mockReturnValue(true);
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => new Response('ok', { status: 200 }));
  registration.pushManager.subscribe.mockClear();
  getSubscriptionMock.mockClear();
  getSubscriptionMock.mockImplementation(async () => subscription);
  subscription.unsubscribe.mockClear();
  (pushActif as Mock).mockClear();
  (pushActif as Mock).mockReturnValue(true);
});

describe('push: deviceId', () => {
  it('génère un uuid une fois puis le relit', () => {
    const id = deviceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(localStorage.getItem('sportapp:push:device')).toBe(id);
    expect(deviceId()).toBe(id);
  });
});

describe('push: configDefaut', () => {
  it('tous les événements OFF, aucun rappel', () => {
    expect(configDefaut()).toEqual({
      evenements: { diner: false, pesee: false, courses: false },
      rappels: [],
    });
  });
});

describe('push: souscrireEtEnregistrer', () => {
  it('souscrit puis POST push-register avec la souscription et le foyer', async () => {
    prepare();
    const ok = await souscrireEtEnregistrer(configDefaut());
    expect(ok).toBe(true);
    expect(Notification.requestPermission).toHaveBeenCalled();
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    const [url, init] = dernierAppel();
    expect(url).toBe('https://example.supabase.co/functions/v1/push-register');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-foyer');
    const corps = JSON.parse(init.body as string);
    expect(corps).toMatchObject({
      endpoint: subJson.endpoint,
      p256dh: 'B0p256dh',
      auth: 'auth16',
      profil: 'marc',
      tz: expect.any(String),
      config: { evenements: { diner: false, pesee: false, courses: false }, rappels: [] },
    });
    expect(corps.device_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refus de permission → pas de souscription, pas de fetch', async () => {
    prepare();
    vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => 'denied') });
    expect(await souscrireEtEnregistrer(configDefaut())).toBe(false);
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('push inactif → no-op silencieux', async () => {
    prepare();
    vi.mocked(pushActif).mockReturnValue(false);
    expect(await souscrireEtEnregistrer(configDefaut())).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('push: majConfig', () => {
  it('réutilise la souscription existante (pas de re-subscribe)', async () => {
    prepare();
    const ok = await majConfig({ ...configDefaut(), evenements: { diner: true, pesee: false, courses: false } });
    expect(ok).toBe(true);
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    const corps = JSON.parse(dernierAppel()[1].body as string);
    expect(corps.config.evenements.diner).toBe(true);
  });

  it('sans souscription existante → souscription complète', async () => {
    prepare();
    getSubscriptionMock.mockImplementation(async () => null);
    await majConfig(configDefaut());
    expect(registration.pushManager.subscribe).toHaveBeenCalled();
  });
});

describe('push: desabonner', () => {
  it('unsubscribe + DELETE serveur', async () => {
    prepare();
    await desabonner();
    expect(subscription.unsubscribe).toHaveBeenCalled();
    const [url, init] = dernierAppel();
    expect((init.method as string).toUpperCase()).toBe('DELETE');
    expect(url).toBe('https://example.supabase.co/functions/v1/push-register');
    expect(JSON.parse(init.body as string)).toEqual({ device_id: deviceId() });
  });

  it('sans souscription → no-op', async () => {
    prepare();
    getSubscriptionMock.mockImplementation(async () => null);
    await desabonner();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('push: envoyerEvenement', () => {
  it('POST push-notifier avec auteur, device et label', async () => {
    prepare();
    await envoyerEvenement('diner', 'Omelette au champignons');
    const [url, init] = dernierAppel();
    expect(url).toBe('https://example.supabase.co/functions/v1/push-notifier');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-foyer');
    expect(JSON.parse(init.body as string)).toMatchObject({
      type: 'diner',
      auteur: 'marc',
      label: 'Omelette au champignons',
    });
  });

  it('push inactif → no-op', async () => {
    prepare();
    vi.mocked(pushActif).mockReturnValue(false);
    await envoyerEvenement('pesee', '82,4 kg');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
