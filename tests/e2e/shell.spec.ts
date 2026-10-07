import { expect, test } from '@playwright/test';

const OVERFLOW_TOLERANCE = 1; // arrondis de sous-pixel
const ORIGIN = process.env.E2E_PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173';

const ONGLETS = ["Aujourd'hui", 'Menu', 'Courses', 'Rituel', 'Suivi'];

test.describe('Shell v2 — barre du bas', () => {
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

  for (const largeur of [320, 375]) {
    test(`5 onglets sous le pouce, aucun débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await expect(page.getByText(/Cycle d'exemple/)).toBeVisible();

      // Barre collée en bas de l'écran, cibles ≥ 48 px.
      const boite = (await nav.boundingBox())!;
      expect(Math.round(boite.y + boite.height)).toBe(667);
      for (const nom of ONGLETS) {
        const b = (await nav.getByRole('button', { name: nom, exact: true }).boundingBox())!;
        expect(b.height, `${nom} : cible ≥ 48 px`).toBeGreaterThanOrEqual(48);
      }

      for (const nom of ONGLETS) {
        await nav.getByRole('button', { name: nom, exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: nom })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${nom} : pas de scroll horizontal`).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      }
    });
  }

  test('ligne semaine : navigue dans le cycle, l’avatar ouvre le profil', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await nav.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByText(/Sem\. 1 ·/)).toBeVisible();
    await page.getByRole('button', { name: 'Semaine suivante' }).click();
    await expect(page.getByText(/Sem\. 2 ·/)).toContainText('Menu B');

    await page.getByRole('button', { name: /Mon profil/ }).click();
    await expect(page.getByRole('button', { name: /Mes infos/ })).toBeVisible();
    await expect(nav).toHaveCount(0);
  });
});
