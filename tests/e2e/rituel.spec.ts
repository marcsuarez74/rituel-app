import { expect, test } from '@playwright/test';
import { allerA, attendrePolices, stateAvec, verifierPasDeDebordement } from './fixtures';

// Un dimanche simulé de bout en bout (spec refonte §8, T8) : explication,
// cuisiner avec minuteurs en parallèle, On range, écran de fin — le tout
// sans débordement horizontal et sans le mot « cycle » à l'écran.
test.describe('Un dimanche de rituel de bout en bout', () => {
  test.use({ storageState: stateAvec() });

  for (const [largeur, hauteur] of [
    [375, 667],
    [320, 667],
  ] as const) {
    test(`explication → cuisiner (6 minuteurs) → On range → fin, sans débordement à ${largeur}px`, async ({
      page,
    }) => {
      await page.clock.install({ time: new Date('2026-10-11T10:00:00') }); // dimanche, jour du rituel
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.goto('/');
      await attendrePolices(page);
      const debord = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

      // Écran Rituel, première visite : la feuille des 3 vignettes.
      await allerA(page, 'Rituel');
      const feuille = page.getByRole('dialog');
      await expect(feuille).toBeVisible();
      await expect(page.getByRole('main')).not.toContainText(/cycle/i);
      await page.getByRole('button', { name: "J'ai compris" }).click();
      await expect(feuille).toBeHidden();
      expect(await debord()).toBeLessThanOrEqual(2);

      // Jour du rituel : résumé chiffré, grille et plats à cuisiner.
      await expect(page.getByRole('heading', { name: 'Ce dimanche, tu prépares' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'À cuisiner dimanche' })).toBeVisible();

      // Mode guidé : 5 étapes de cuisine + « On range ».
      await page.getByRole('button', { name: 'Commencer' }).click();
      await expect(page.getByText(/^Étape 1 sur 6$/)).toBeVisible();

      await page.getByRole('button', { name: /Préchauffage du four · 5 min/ }).click();
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(page.getByText(/^Étape 2 sur 6$/)).toBeVisible();
      await page.getByRole('button', { name: /Cuisses au four · 50 min/ }).click();
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      // Deux minuteurs tournent déjà en parallèle dans la barre collée.
      await expect(page.locator('.puce-min')).toHaveCount(2);
      expect(await debord()).toBeLessThanOrEqual(2);

      await page.getByRole('button', { name: /Muffins au four · 22 min/ }).click();
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(page.getByText(/^Étape 4 sur 6$/)).toBeVisible();
      await page.getByRole('button', { name: /Mijotage de la sauce · 25 min/ }).click();
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(page.getByText(/^Étape 5 sur 6$/)).toBeVisible();
      // Deux minuteurs sur la même étape (lentilles + œufs).
      await page.getByRole('button', { name: /Lentilles · 25 min/ }).click();
      await page.getByRole('button', { name: /Œufs durs · 10 min/ }).click();
      await expect(page.locator('.puce-min')).toHaveCount(6);
      await verifierPasDeDebordement(page, `Mode guidé (6 minuteurs, ${largeur})`);
      await expect(page.getByRole('main')).not.toContainText(/cycle/i);

      await page.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(page.getByRole('heading', { name: 'On range' })).toBeVisible();
      const aRanger = page.locator('.contenant[aria-pressed="false"], .boite[aria-pressed="false"]');
      const toutRange = page.getByRole('button', { name: /à ranger$|Tout est rangé/ });
      for (let i = 0; i < 20 && (await toutRange.isDisabled()); i += 1) {
        await aRanger.first().click();
      }
      await expect(toutRange).toBeEnabled();
      await verifierPasDeDebordement(page, `On range (${largeur})`);
      await expect(page.getByRole('main')).not.toContainText(/cycle/i);

      await toutRange.click();
      await expect(page.getByRole('heading', { name: 'Ta semaine est prête !' })).toBeVisible();
      await expect(page.getByRole('main')).not.toContainText(/cycle/i);
      await page.getByRole('button', { name: /Voir ce qu.il y a au frigo/ }).click();

      // Retour sur l'écran Rituel : toujours le jour du rituel, tout cochable à nouveau.
      await expect(page.getByRole('heading', { name: 'Ce dimanche, tu prépares' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Revoir le mode guidé' })).toBeVisible();
      expect(await debord()).toBeLessThanOrEqual(2);
    });
  }
});
