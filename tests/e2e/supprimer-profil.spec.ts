import { expect, test, type Page } from '@playwright/test';
import { stateAvec, verifierPasDeDebordement } from './fixtures';

// Dev : VITE_SYNC_URL posé (playwright.config.ts) → variante foyer connecté avec API mockée.
// Build de prod de la CI : pas de sync → suppression locale seule.
const SYNC = !process.env.E2E_PREVIEW;

const ouvrirDialogue = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Mon profil' }).click();
  await page.getByRole('button', { name: /Supprimer mon profil/ }).click();
  await expect(page.getByRole('alertdialog', { name: /Supprimer mon profil/ })).toBeVisible();
};

const confirmer = async (page: Page) => {
  await page.getByLabel(/Tape SUPPRIMER/).fill('SUPPRIMER');
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
};

const cles = (page: Page) =>
  page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('sportapp:')));

test.describe('Supprimer mon profil', () => {
  test.use({ storageState: stateAvec({ 'sportapp:weights:marc': [{ date: '2026-10-01', kg: 80 }] }) });

  test('annuler ne supprime rien ; zéro débordement 320/375', async ({ page }) => {
    await ouvrirDialogue(page);
    await verifierPasDeDebordement(page, 'Supprimer mon profil (dialogue)');
    await page.getByLabel(/Tape SUPPRIMER/).fill('SUPPRIMER');
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(await cles(page)).toContain('sportapp:profile');
    await verifierPasDeDebordement(page, 'Profil (zone dangereuse)');
  });

  test('confirmation : localStorage vidé, retour à l’onboarding, pas de crash', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await ouvrirDialogue(page);
    const supprimer = page.getByRole('button', { name: 'Supprimer définitivement' });
    await expect(supprimer).toBeDisabled();
    await confirmer(page);
    await expect(page.getByLabel("Comment tu t'appelles ?")).toBeVisible();
    expect(await cles(page)).toEqual([]);
    await verifierPasDeDebordement(page, 'Onboarding après suppression');
    expect(erreurs).toEqual([]);
  });

  test.describe('avec un foyer connecté', () => {
    test.use({
      storageState: stateAvec({ 'sportapp:sync:token': 'jeton-e2e', 'sportapp:sync:foyer': 'foyer-e2e' }),
    });

    const corps: Array<string | null> = [];
    const mockerApi = async (page: Page, supprimer: (n: number) => { status: number } | 'abort') => {
      let appels = 0;
      corps.length = 0;
      await page.route((u) => u.pathname.startsWith('/sync/'), (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: '{"rows":[]}' }),
      );
      await page.route((u) => u.pathname === '/evenements', (r) => r.abort());
      await page.route((u) => u.pathname === '/foyers/moi', async (route) => {
        expect(route.request().method()).toBe('DELETE');
        expect(route.request().headers().authorization).toMatch(/^Bearer .*jeton-e2e/); // la fixture JSON-encode la valeur
        appels += 1;
        corps.push(route.request().postData());
        const issue = supprimer(appels);
        if (issue === 'abort') return route.abort('connectionfailed');
        return route.fulfill({
          status: issue.status,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, foyerSupprime: true }),
        });
      });
      return () => appels;
    };

    test('appelle DELETE /foyers/moi puis revient à l’onboarding, session effacée', async ({ page }) => {
      test.skip(!SYNC, 'nécessite la sync');
      const appels = await mockerApi(page, () => ({ status: 200 }));
      await ouvrirDialogue(page);
      await expect(page.getByRole('alertdialog')).toContainText(/quitte aussi le foyer/);
      await confirmer(page);
      await expect(page.getByLabel("Comment tu t'appelles ?")).toBeVisible();
      expect(appels()).toBe(1);
      expect(await cles(page)).toEqual([]);
    });

    test('case « dernier appareil » : visible, décochée par défaut, sans débordement 320/375', async ({ page }) => {
      test.skip(!SYNC, 'nécessite la sync');
      await mockerApi(page, () => ({ status: 200 }));
      await ouvrirDialogue(page);
      const caseTout = page.getByRole('checkbox', { name: /dernier appareil de ce foyer/ });
      await expect(caseTout).toBeVisible();
      await expect(caseTout).not.toBeChecked();
      await expect(page.getByRole('alertdialog')).toContainText(/autres membres perdront l’accès/);
      await caseTout.check();
      await verifierPasDeDebordement(page, 'Supprimer mon profil (case dernier appareil)');
    });

    test('case décochée : DELETE sans corps', async ({ page }) => {
      test.skip(!SYNC, 'nécessite la sync');
      await mockerApi(page, () => ({ status: 200 }));
      await ouvrirDialogue(page);
      await confirmer(page);
      await expect(page.getByLabel("Comment tu t'appelles ?")).toBeVisible();
      expect(corps).toEqual([null]);
    });

    test('case cochée : DELETE porte { toutSupprimer: true }', async ({ page }) => {
      test.skip(!SYNC, 'nécessite la sync');
      await mockerApi(page, () => ({ status: 200 }));
      await ouvrirDialogue(page);
      await page.getByRole('checkbox', { name: /dernier appareil de ce foyer/ }).check();
      await confirmer(page);
      await expect(page.getByLabel("Comment tu t'appelles ?")).toBeVisible();
      expect(corps.map((c) => (c ? JSON.parse(c) : c))).toEqual([{ toutSupprimer: true }]);
      expect(await cles(page)).toEqual([]);
    });

    test('réseau coupé : rien n’est effacé, « supprimer quand même » finit en local', async ({ page }) => {
      test.skip(!SYNC, 'nécessite la sync');
      const appels = await mockerApi(page, () => 'abort');
      await ouvrirDialogue(page);
      await confirmer(page);
      await expect(page.getByRole('alert')).toContainText(/Impossible de joindre le serveur/);
      expect(await cles(page)).toContain('sportapp:profile');
      expect(await cles(page)).toContain('sportapp:sync:token');
      await verifierPasDeDebordement(page, 'Suppression : erreur réseau');

      await page.getByRole('button', { name: /Supprimer quand même sur ce téléphone/ }).click();
      await expect(page.getByLabel("Comment tu t'appelles ?")).toBeVisible();
      expect(appels()).toBe(1);
      expect(await cles(page)).toEqual([]);
    });
  });
});
