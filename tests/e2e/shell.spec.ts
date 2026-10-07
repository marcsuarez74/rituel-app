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

  for (const largeur of [320, 375]) {
    test(`menu → fiche recette → retour, sans débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await nav.getByRole('button', { name: 'Menu', exact: true }).click();
      await expect(page.getByRole('tablist', { name: 'Jours' })).toBeVisible();
      const debord = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);

      await page.locator('.carte-repas-corps').first().click();
      await expect(page.getByRole('heading', { name: 'Préparation' })).toBeVisible();
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      await page.getByRole('button', { name: /Retour/ }).click();
      await expect(page.getByRole('tablist', { name: 'Jours' })).toBeVisible();
    });
  }

  for (const largeur of [320, 375]) {
    test(`courses : carte budget, coche, mode magasin, sans débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('button', { name: 'Courses', exact: true })
        .click();
      await expect(page.getByText('Estimé')).toBeVisible();
      const premiere = page.locator('.rayon .ligne-cochable').first();
      await premiere.click();
      await expect(premiere).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: /Mode magasin/ }).click();
      await page.getByRole('button', { name: /J'ai payé/ }).click();
      await expect(page.getByLabel('Total du ticket (€)')).toBeVisible();
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(debord).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    });
  }

  for (const largeur of [320, 375]) {
    test(`rituel : 3 onglets, mode guidé jusqu'à la fin, sans débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('button', { name: 'Rituel', exact: true })
        .click();
      const debord = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      for (const onglet of ['En semaine', 'Réserve']) {
        await page.getByRole('tab', { name: onglet }).click();
        expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      }
      await page.getByRole('tab', { name: 'Dimanche' }).click();
      await page.getByRole('button', { name: /Lancer le mode guidé/ }).click();
      await expect(page.getByText(/Étape 1 sur/)).toBeVisible();
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      const terminer = page.getByRole('button', { name: 'Terminer' });
      while (!(await terminer.isVisible())) await page.getByRole('button', { name: 'Suivant' }).click();
      await terminer.click();
      await expect(page.getByRole('heading', { name: 'Rituel terminé !' })).toBeVisible();
      await page.getByRole('button', { name: 'Voir la réserve' }).click();
      await expect(page.getByRole('tab', { name: 'Réserve', selected: true })).toBeVisible();
    });
  }

  for (const largeur of [320, 375]) {
    test(`mon cycle : profil → génération en 3 étapes → import refusé expliqué, à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: /Mon profil/ }).click();
      await page.getByRole('button', { name: /Mon cycle/ }).click();
      await page.getByRole('button', { name: 'Créer mon premier cycle' }).click();
      await expect(page.getByRole('heading', { name: '3 · Importe les fichiers' })).toBeVisible();
      const debord = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);

      await page.locator('input[type="file"]').setInputFiles({
        name: 'menu-A.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{"format":"rituel-cycle"'),
      });
      await expect(page.getByRole('heading', { name: 'À corriger avant de démarrer' })).toBeVisible();
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    });
  }

  test('report : la feuille tient à 320 px, le toast permet d’annuler', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('button', { name: 'Menu', exact: true })
      .click();
    await page.getByRole('button', { name: 'Pas ce soir : reporter' }).first().click();
    const feuille = page.getByRole('dialog');
    await expect(feuille).toBeVisible();
    const debord = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(debord).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    await feuille.getByRole('button', { name: 'On ne le fera pas' }).click();
    await expect(page.getByRole('status')).toContainText('Retiré du menu');
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  for (const largeur of [320, 375]) {
    test(`semaine type : depuis le profil, jour déplié, sans débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: /Mon profil/ }).click();
      await page.getByRole('button', { name: /Ma semaine type/ }).click();
      await page.locator('summary', { hasText: 'Lundi' }).click();
      await expect(page.getByRole('radiogroup', { name: 'Journée de Marc' })).toBeVisible();
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(debord).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('button', { name: /Ma semaine type/ })).toBeVisible();
    });
  }
});
