import { expect, test } from '@playwright/test';
import {
  PROFIL_MARC,
  allerA,
  attendrePolices,
  lirePrefixe,
  lireStockage,
  stateAvec,
  verifierPasDeDebordement,
} from './fixtures';

// Parcours courses / pesée / profil : chaque action doit laisser une trace
// durable dans localStorage (données réelles des téléphones).

test.describe('Parcours courses, pesée et profil', () => {
  test.use({ storageState: stateAvec() });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await attendrePolices(page);
    await expect(page.getByText(/Cycle d'exemple/)).toBeVisible();
  });

  test('Courses : mode magasin puis « J’ai payé » enregistre la dépense et met à jour le budget', async ({ page }) => {
    await allerA(page, 'Courses');
    const budget = page.getByRole('region', { name: 'Budget et progression' });
    await expect(budget.getByText('Payé').locator('xpath=following-sibling::b')).toHaveText('—');

    await page.getByRole('button', { name: /Mode magasin/ }).click();
    await expect(page.getByRole('button', { name: /Tout revoir/ })).toBeVisible();
    await verifierPasDeDebordement(page, 'Courses (mode magasin)');

    await page.getByRole('button', { name: /J'ai payé/ }).click();
    await page.getByLabel('Total du ticket (€)').fill('87,50');
    await verifierPasDeDebordement(page, 'Courses (saisie du ticket)');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByLabel('Total du ticket (€)')).toBeHidden();
    await expect(budget.getByText('Payé').locator('xpath=following-sibling::b')).toContainText('87,50');

    const depenses = (await lireStockage(page, 'sportapp:depenses')) as { date: string; magasin: string; total: number }[];
    expect(depenses).toHaveLength(1);
    expect(depenses[0].total).toBeCloseTo(87.5, 2);
    expect(depenses[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Persistant après rechargement.
    await page.reload();
    await allerA(page, 'Courses');
    await expect(budget.getByText('Payé').locator('xpath=following-sibling::b')).toContainText('87,50');
  });

  test('Courses : un total invalide est refusé sans rien écrire', async ({ page }) => {
    await allerA(page, 'Courses');
    await page.getByRole('button', { name: /J'ai payé/ }).click();
    await page.getByLabel('Total du ticket (€)').fill('abc');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('alert')).toHaveText('Montant invalide.');
    expect(await lireStockage(page, 'sportapp:depenses')).toBeNull();
  });

  test('Suivi : une pesée apparaît dans le héro et l’historique, et est persistée', async ({ page }) => {
    await allerA(page, 'Suivi');
    await verifierPasDeDebordement(page, 'Suivi');
    await page.getByLabel('Poids (kg)').fill('82.4');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    await expect(page.locator('.weight-list li').first()).toContainText('82.4 kg');
    await expect(page.locator('.suivi-hero')).toContainText('82,4');

    const pesees = (await lireStockage(page, 'sportapp:weights:marc')) as { date: string; kg: number }[];
    expect(pesees).toHaveLength(1);
    expect(pesees[0].kg).toBe(82.4);

    await page.reload();
    await allerA(page, 'Suivi');
    await expect(page.locator('.weight-list li').first()).toContainText('82.4 kg');
    expect(Object.keys(await lirePrefixe(page, 'sportapp:weights:'))).toEqual(['sportapp:weights:marc']);
  });

  test('Suivi : un poids invalide est refusé', async ({ page }) => {
    await allerA(page, 'Suivi');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByRole('alert')).toHaveText('Poids invalide.');
    expect(await lireStockage(page, 'sportapp:weights:marc')).toBeNull();
  });

  test('Profil › Objectif & régime : objectif et poids visé conservés après rechargement', async ({ page }) => {
    await page.getByRole('button', { name: /Mon profil/ }).click();
    await page.getByRole('button', { name: /Objectif & régime/ }).click();
    await verifierPasDeDebordement(page, 'Objectif & régime');

    // Choisit un cap différent de l'actuel (« perte »).
    const nonCoches = page.locator('.rcards [role="radio"][aria-checked="false"]');
    const choisi = nonCoches.first();
    const nomChoisi = (await choisi.locator('.rcard-t').innerText()).trim();
    await choisi.click();
    await page.getByLabel('Poids visé (kg)').fill('74.5');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

    const profil = (await lireStockage(page, 'sportapp:profile')) as typeof PROFIL_MARC & { poidsObjectif?: number };
    expect(profil.poidsObjectif).toBe(74.5);
    expect(profil.objectif.type).not.toBe('perte');

    await page.reload();
    await page.getByRole('button', { name: /Mon profil/ }).click();
    await page.getByRole('button', { name: /Objectif & régime/ }).click();
    await expect(page.getByLabel('Poids visé (kg)')).toHaveValue('74.5');
    await expect(page.locator('.rcards [role="radio"][aria-checked="true"] .rcard-t')).toHaveText(nomChoisi);
  });

  test('Profil › Mes infos : taille et prénom conservés après rechargement', async ({ page }) => {
    await page.getByRole('button', { name: /Mon profil/ }).click();
    await page.getByRole('button', { name: /Mes infos/ }).click();
    await verifierPasDeDebordement(page, 'Mes infos');
    await page.getByLabel('Prénom').fill('Marc');
    await page.getByLabel('Taille (cm)').fill('180');
    await page.getByRole('button', { name: 'Enregistrer mes infos' }).click();

    const profil = (await lireStockage(page, 'sportapp:profile')) as { taille: number; prenom: string };
    expect(profil.taille).toBe(180);
    expect(profil.prenom).toBe('Marc');

    await page.reload();
    await page.getByRole('button', { name: /Mon profil/ }).click();
    await page.getByRole('button', { name: /Mes infos/ }).click();
    await expect(page.getByLabel('Taille (cm)')).toHaveValue('180');
  });
});
