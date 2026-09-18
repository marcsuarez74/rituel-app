import { expect, test } from '@playwright/test';

const ORIGIN = process.env.E2E_PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173';
const OVERFLOW_TOLERANCE = 1; // arrondis de sous-pixel

async function assertPasDeDebordement(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'la page ne doit pas scroller horizontalement').toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
}

test.describe('Mon suivi — bloc objectif et carte Poids', () => {
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
                poidsObjectif: 74,
                objectif: { type: 'perte', echeance: '2026-12-15' },
                complements: ['Whey', 'Créatine'],
                regime: 'keto',
              }),
            },
            {
              name: 'sportapp:weights:marc',
              value: JSON.stringify([
                { date: '2026-08-12', kg: 82.8 },
                { date: '2026-09-07', kg: 79.1 },
                { date: '2026-09-09', kg: 78.4 },
              ]),
            },
          ],
        },
      ],
    },
  });

  test('bloc objectif, carte Poids et séances en liste libre', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 37')).toBeVisible();
    await page.getByRole('button', { name: 'Mon suivi' }).click();

    const obj = page.locator('.suivi-hero');
    await expect(obj).toBeVisible();
    await expect(obj).toContainText('Perte de poids');
    await expect(obj).toContainText('Keto');
    await expect(obj).toContainText('Échéance :');
    await expect(obj).toContainText('restants');

    // delta 7 j dans la carte héro ; les anciennes stat-cards ont disparu
    await expect(obj).toContainText('vs 7 jours');
    await expect(page.getByText('Kcal du jour')).toHaveCount(0);

    // séances : pastilles conseillé, compte dans le titre
    await expect(page.locator('.seance-rec').first()).toContainText(/conseillé/);
    await expect(page.getByText(/Séances de la semaine · \d+\/\d+/)).toBeVisible();
  });

  for (const largeur of [320, 375]) {
    test(`zéro débordement horizontal sur le suivi à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.goto(ORIGIN);
      await expect(page.getByText('Semaine 37')).toBeVisible();
      // document.fonts.ready fixe le layout avant la mesure (pattern dock.spec).
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: 'Mon suivi' }).click();

      // le contenu dense est rendu avant l'assert : carte héro + pastilles
      await expect(page.locator('.suivi-hero')).toBeVisible();
      await expect(page.locator('.seance-rec').first()).toBeVisible();
      await assertPasDeDebordement(page);
    });
  }
});
