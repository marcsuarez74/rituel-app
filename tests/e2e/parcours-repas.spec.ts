import { expect, test } from '@playwright/test';
import { allerA, attendrePolices, lirePrefixe, stateAvec, verifierPasDeDebordement } from './fixtures';

// Parcours repas : cocher depuis Aujourd'hui, depuis la fiche recette, et
// reporter. Sans cycle stocké, l'app charge le cycle d'exemple (bandeau).

test.describe('Parcours repas', () => {
  test.use({ storageState: stateAvec() });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await attendrePolices(page);
    await expect(page.getByText(/Cycle d'exemple/)).toBeVisible();
  });

  test("Aujourd'hui : cocher un repas le montre coché dans Menu et le persiste", async ({ page }) => {
    await verifierPasDeDebordement(page, "Aujourd'hui");
    const coche = page.getByRole('button', { name: /: marquer comme fait$/ }).first();
    const label = (await coche.getAttribute('aria-label'))!;
    const titre = label.replace(/ : marquer comme fait$/, '');
    await coche.click();
    await expect(page.getByRole('button', { name: `${titre} : fait, annuler` }).first()).toBeVisible();

    const checks = await lirePrefixe(page, 'sportapp:checks:');
    const valeurs = Object.values(checks) as Record<string, boolean>[];
    expect(valeurs.some((v) => Object.values(v).some(Boolean)), 'une coche est persistée').toBe(true);

    await allerA(page, 'Menu');
    await expect(page.getByRole('button', { name: `${titre} : fait, annuler` }).first()).toBeVisible();
    await verifierPasDeDebordement(page, 'Menu');

    // Survit à un rechargement.
    await page.reload();
    await allerA(page, 'Menu');
    await expect(page.getByRole('button', { name: `${titre} : fait, annuler` }).first()).toBeVisible();
  });

  test('Fiche recette : « C’est fait » coche le repas dans le Menu', async ({ page }) => {
    await allerA(page, 'Menu');
    const carte = page.locator('button.carte-repas-corps').first();
    await carte.click();
    await expect(page.getByRole('heading', { name: 'Préparation' })).toBeVisible();
    await verifierPasDeDebordement(page, 'Fiche recette');

    const fait = page.getByRole('button', { name: "C'est fait" });
    await fait.click();
    await expect(page.getByRole('button', { name: 'Fait ✓' })).toBeVisible();

    await page.getByRole('button', { name: /Retour/ }).click();
    await expect(page.getByRole('button', { name: /: fait, annuler$/ }).first()).toBeVisible();
    const checks = Object.values(await lirePrefixe(page, 'sportapp:checks:')) as Record<string, boolean>[];
    expect(checks.some((v) => Object.values(v).some(Boolean))).toBe(true);
  });

  test('Menu : « Pas ce soir » reporte le repas à la semaine prochaine', async ({ page }) => {
    await allerA(page, 'Menu');
    const reporter = page.getByRole('button', { name: /Pas ce soir/ }).first();
    await reporter.click();
    const feuille = page.getByRole('dialog');
    await expect(feuille).toBeVisible();
    await verifierPasDeDebordement(page, 'Feuille de report');
    await feuille.getByRole('button', { name: /Semaine prochaine/ }).click();

    await expect(page.getByRole('status').filter({ hasText: /report/i })).toBeVisible();
    const reports = Object.entries(await lirePrefixe(page, 'sportapp:reports:'));
    expect(reports).toHaveLength(1);
    const [cle, liste] = reports[0] as [string, { repas: string; vers: { semaine: number }; cree: string }[]];
    expect(cle.startsWith('sportapp:reports:')).toBe(true);
    expect(liste).toHaveLength(1);
    expect(liste[0].vers).toEqual({ semaine: 1 });

    // Le repas reporté n'est plus proposé au report, et le report survit au rechargement.
    await page.reload();
    const apres = Object.values(await lirePrefixe(page, 'sportapp:reports:'))[0] as unknown[];
    expect(apres).toHaveLength(1);
  });
});
