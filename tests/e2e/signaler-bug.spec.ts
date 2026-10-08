import { expect, test, type Page } from '@playwright/test';
import { stateAvec, verifierPasDeDebordement } from './fixtures';

// Le mode dev est lancé avec VITE_SYNC_URL (playwright.config.ts) : parcours complet,
// POST /bugs intercepté. Le build de prod de la CI n'a pas de sync : on y vérifie
// l'écran explicatif (pas de crash, pas de débordement).
const SYNC = !process.env.E2E_PREVIEW;

const ouvrirSignalement = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Mon profil' }).click();
  await page.getByRole('button', { name: /Signaler un bug/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Signaler un bug' })).toBeVisible();
};

test.describe('Signaler un bug', () => {
  test.use({
    storageState: stateAvec({}),
  });

  test('sans sync : écran explicatif, sans débordement', async ({ page }) => {
    test.skip(SYNC, 'parcours sync couvert ci-dessous');
    await ouvrirSignalement(page);
    await expect(page.getByText(/pas disponible dans cette version/)).toBeVisible();
    await verifierPasDeDebordement(page, 'Signaler un bug (sans sync)');
    await page.getByRole('button', { name: /Profil/ }).click();
    await expect(page.getByRole('button', { name: /Mes infos/ })).toBeVisible();
  });

  test('sans foyer connecté : explique Profil › Foyer', async ({ page }) => {
    test.skip(!SYNC, 'nécessite la sync');
    await ouvrirSignalement(page);
    await expect(page.getByText(/Profil › Foyer/)).toBeVisible();
    await expect(page.getByLabel('Titre')).toHaveCount(0);
    await verifierPasDeDebordement(page, 'Signaler un bug (sans foyer)');
  });

  test.describe('avec un foyer connecté', () => {
    test.use({
      storageState: stateAvec({ 'sportapp:sync:token': 'jeton-e2e', 'sportapp:sync:foyer': 'foyer-e2e' }),
    });

    test('formulaire : bornes, envoi mocké, écran de succès, zéro débordement', async ({ page }) => {
      test.skip(!SYNC, 'nécessite la sync');
      // Le moteur de sync ne doit pas bruiter : tout sauf /bugs répond vide.
      await page.route('**/foyer/**', (r) => r.fulfill({ status: 404, body: '{}' }));
      let corps = '';
      await page.route('**/bugs', async (route) => {
        corps = route.request().postData() ?? '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, issueUrl: 'https://github.com/o/r/issues/7', issueNumber: 7 }),
        });
      });

      await ouvrirSignalement(page);
      await verifierPasDeDebordement(page, 'Signaler un bug (formulaire)');

      const envoyer = page.getByRole('button', { name: 'Envoyer' });
      await expect(envoyer).toBeDisabled();
      await page.getByLabel('Titre').fill('Ab');
      await page.getByLabel('Description').fill('court');
      await expect(envoyer).toBeDisabled();

      await page.getByLabel('Titre').fill('Le bouton ne répond pas');
      await page.getByLabel('Description').fill('Je touche le bouton et rien ne se passe.');
      await page.getByText('Informations envoyées').click();
      await verifierPasDeDebordement(page, 'Signaler un bug (infos ouvertes)');
      await expect(envoyer).toBeEnabled();
      await envoyer.click();

      await expect(page.getByRole('heading', { name: /Merci/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Voir le signalement/ })).toHaveAttribute(
        'href',
        'https://github.com/o/r/issues/7',
      );
      expect(corps).toContain('Le bouton ne répond pas');
      expect(corps).not.toContain('foyer-e2e');
      await verifierPasDeDebordement(page, 'Signaler un bug (succès)');
    });
  });
});
