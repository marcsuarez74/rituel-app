import { expect, test } from '@playwright/test';
import {
  allerA,
  attendrePolices,
  fichiersCycle,
  lireStockage,
  stateAvec,
  verifierPasDeDebordement,
} from './fixtures';

test.describe('Parcours rituel guidé et import de cycle', () => {
  test.use({ storageState: stateAvec() });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await attendrePolices(page);
    await expect(page.getByText(/Cycle d'exemple/)).toBeVisible();
  });

  test('Rituel › mode guidé : le minuteur démarre et décompte', async ({ page }) => {
    await page.clock.install();
    await page.reload();
    await allerA(page, 'Rituel');
    await verifierPasDeDebordement(page, 'Rituel');
    await page.getByRole('button', { name: /Lancer le mode guidé/ }).click();
    await expect(page.getByText(/^Étape 1 sur \d+$/)).toBeVisible();
    await verifierPasDeDebordement(page, 'Mode guidé');

    // Avance d'étape en étape jusqu'à la première qui porte un minuteur.
    const minuteur = page.locator('button.minuteur');
    for (let i = 0; i < 30 && !(await minuteur.isVisible()); i += 1) {
      await page.getByRole('button', { name: 'Suivant', exact: true }).click();
    }
    await expect(minuteur).toBeVisible();
    await expect(minuteur).toHaveText(/Minuteur \d+ min/);

    await minuteur.click();
    await expect(minuteur).toHaveText(/\d{2}:\d{2} · Arrêter/);
    const avant = await minuteur.innerText();
    await page.clock.runFor(3000);
    const apres = await minuteur.innerText();
    expect(apres, 'le décompte avance').not.toBe(avant);
    await verifierPasDeDebordement(page, 'Mode guidé (minuteur lancé)');

    await minuteur.click(); // Arrêter
    await expect(minuteur).toHaveText(/Minuteur \d+ min/);
  });

  test('Mon cycle : importer 4 fichiers valides puis démarrer le cycle', async ({ page }) => {
    await page.getByRole('button', { name: /Mon profil/ }).click();
    await page.getByRole('button', { name: /Mon cycle/ }).click();
    await page.getByRole('button', { name: /Créer mon premier cycle/ }).click();
    await verifierPasDeDebordement(page, 'Mon cycle (import)');

    await page.locator('input[type="file"]').setInputFiles(fichiersCycle('Cycle importé e2e'));

    await expect(page.getByText(/Aperçu des 4 semaines/)).toBeVisible();
    await expect(page.getByText(/À corriger avant de démarrer/)).toHaveCount(0);
    await verifierPasDeDebordement(page, 'Mon cycle (aperçu)');

    const demarrer = page.getByRole('button', { name: 'Démarrer le cycle' });
    await expect(demarrer).toBeEnabled();
    await demarrer.click();

    await expect(page.getByRole('heading', { name: /Cycle \d+ prêt/ })).toBeVisible();
    await verifierPasDeDebordement(page, 'Mon cycle (prêt)');

    const cycle = (await lireStockage(page, 'sportapp:cycle')) as { cycle: { titre: string; menus: unknown[] } };
    expect(cycle.cycle.titre).toBe('Cycle importé e2e');
    expect(cycle.cycle.menus).toHaveLength(4);

    // Le nouveau cycle remplace l'exemple après rechargement.
    await page.reload();
    await attendrePolices(page);
    await expect(page.getByText(/Cycle d'exemple/)).toHaveCount(0);
    await allerA(page, 'Menu');
    await verifierPasDeDebordement(page, 'Menu (cycle importé)');
  });
});
