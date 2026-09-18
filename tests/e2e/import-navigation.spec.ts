import { expect, test } from '@playwright/test';

const ORIGIN = process.env.E2E_PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173';
const OVERFLOW_TOLERANCE = 1; // arrondis de sous-pixel

async function assertPasDeDebordement(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'la page ne doit pas scroller horizontalement').toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
}

test.describe('Import du cycle & navigation semaines', () => {
  // Profil seul : la semaine d'exemple se charge en fallback, chevrons désactivés.
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: ORIGIN,
          localStorage: [
            {
              name: 'sportapp:profile',
              value: JSON.stringify({
                id: 'marc',
                dateNaissance: '1985-04-12',
                taille: 178,
                objectif: { type: 'perte', echeance: '2026-12-15' },
                complements: [],
                regime: 'aucun',
              }),
            },
          ],
        },
      ],
    },
  });

  test('une seule semaine : chevrons désactivés', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 37')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Semaine suivante' })).toBeDisabled();
    await assertPasDeDebordement(page);
  });

  test('import groupé des 2 fixtures puis navigation chevrons', async ({ page }) => {
    await page.goto(ORIGIN);
    await page.getByRole('button', { name: 'Mon profil' }).click();

    await page.setInputFiles('input[type="file"]', [
      'tests/e2e/fixtures/2026-S38-menu-b.md',
      'tests/e2e/fixtures/2026-S39-menu-c.md',
    ]);

    // Le profil se referme, la semaine affichée est celle contenant aujourd'hui
    // (E2E-S1 : du plus ancien, contient toujours aujourd'hui).
    await expect(page.getByText('Semaine 1')).toBeVisible();
    await expect(page.locator('.menu-pill')).toHaveText('A');

    // Les 2 semaines sont stockées
    const ids = await page.evaluate(
      () => Object.keys(JSON.parse(localStorage.getItem('sportapp:weeks') ?? '{}').semaines ?? {}),
    );
    expect(ids.sort()).toEqual(['E2E-S1', 'E2E-S2']);

    // Navigation : suivante -> E2E-S2 (Menu Z), précédente -> retour, bornes
    await page.getByRole('button', { name: 'Semaine suivante' }).click();
    await expect(page.getByText('Semaine 2')).toBeVisible();
    await expect(page.locator('.menu-pill')).toHaveText('Z');
    await expect(page.getByRole('button', { name: 'Semaine suivante' })).toBeDisabled();
    await page.getByRole('button', { name: 'Semaine précédente' }).click();
    await expect(page.getByText('Semaine 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled();

    // La navigation est en session : rechargement -> retour à l'auto (E2E-S1)
    await page.getByRole('button', { name: 'Semaine suivante' }).click();
    await expect(page.getByText('Semaine 2')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Semaine 1')).toBeVisible();

    await assertPasDeDebordement(page);
  });
});
